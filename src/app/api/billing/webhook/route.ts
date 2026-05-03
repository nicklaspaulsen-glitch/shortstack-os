import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendPaymentFailedEmail, sendWelcomeEmail } from "@/lib/email";
import { sendBrandedEmail } from "@/lib/email-templates/send";
import { type Stripe } from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { claimEvent, completeEvent } from "@/lib/webhooks/idempotency";
import { reportError } from "@/lib/observability/error-reporter";
import { notifyOps } from "@/lib/telegram";

// Unified Stripe Webhook — handles client billing events
// Register this at: https://dashboard.stripe.com/webhooks
// URL: https://app.shortstack.work/api/billing/webhook
// Events: invoice.paid, invoice.payment_failed, customer.subscription.created,
//         customer.subscription.updated, customer.subscription.deleted,
//         checkout.session.completed

export async function POST(request: NextRequest) {
  // Fail-closed: if the secret env var is missing the route must return 503,
  // NOT attempt verification. When the secret is the empty string, Stripe's
  // constructEvent accepts any attacker-forged HMAC-SHA256 payload — verified
  // empirically (sec/batch-4). A missing secret always indicates a misconfigured
  // deployment; surface it clearly rather than silently processing forgeable events.
  const stripeWebhookSecret =
    process.env.STRIPE_BILLING_WEBHOOK_SECRET ||
    process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeWebhookSecret) {
    console.error(
      "[billing/webhook] STRIPE_BILLING_WEBHOOK_SECRET (or STRIPE_WEBHOOK_SECRET) is not set — rejecting request. Configure the secret in Vercel to enable signature verification.",
    );
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 },
    );
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, stripeWebhookSecret);
  } catch (err) {
    // Signature failures are noisy on probe traffic, but we still want
    // to alert on a sustained spike — sample at the reporter level via
    // SENTRY_SAMPLE_RATE rather than inline filtering.
    reportError(err, {
      route: "/api/billing/webhook",
      component: "stripe-signature-verify",
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // CRITICAL idempotency — claim/complete model. Stripe retries up to 3
  // days on any non-2xx and can deliver the same event_id from multiple
  // workers. The claim INSERT marks the event as 'processing' atomically
  // (unique constraint). If we later throw before completeEvent, retries
  // will see a stale 'processing' row and reclaim it, so legit work isn't
  // dropped. After successful processing we mark 'done' so subsequent
  // retries short-circuit to 200.
  const claim = await claimEvent(supabase, "stripe", event.id);
  if (claim === "already_done") {
    return NextResponse.json({ ok: true, deduped: true, event_id: event.id });
  }
  if (claim === "in_flight") {
    return NextResponse.json({ ok: true, deduped: true, in_flight: true, event_id: event.id });
  }

  try {
    switch (event.type) {
    // ── Invoice Paid ──
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      // Check if this is an agency owner renewal first
      const { data: agencyOwner } = await supabase
        .from("profiles")
        .select("id, full_name, email, plan_tier")
        .eq("stripe_customer_id", customerId)
        .single();

      if (agencyOwner) {
        // Agency owner subscription renewal — ensure plan stays active
        await supabase.from("trinity_log").insert({
          action_type: "custom",
          description: `Agency renewal: $${((invoice.amount_paid || 0) / 100).toFixed(2)} — ${agencyOwner.plan_tier} plan`,
          status: "completed",
          user_id: agencyOwner.id,
          result: {
            type: "agency_renewal",
            amount: (invoice.amount_paid || 0) / 100,
            stripe_invoice_id: invoice.id,
          },
        });

        await notifyOps(
          `💰 Agency Renewal!\n\n${agencyOwner.full_name || agencyOwner.email}: $${((invoice.amount_paid || 0) / 100).toFixed(2)}\nPlan: ${agencyOwner.plan_tier}`,
        );
        // Don't break — also check clients table in case they manage client billing too
      }

      // Find the client by stripe_customer_id
      const { data: client } = await supabase
        .from("clients")
        .select("id, business_name, profile_id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (client) {
        // Mark matching invoice as paid in our DB
        if (invoice.id) {
          await supabase
            .from("invoices")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
              stripe_payment_intent: (invoice as unknown as { payment_intent?: string }).payment_intent || null,
            })
            .eq("stripe_invoice_id", invoice.id);
        }

        // Log the payment
        await supabase.from("trinity_log").insert({
          action_type: "custom",
          description: `Payment received: $${((invoice.amount_paid || 0) / 100).toFixed(2)} from ${client.business_name}`,
          client_id: client.id,
          status: "completed",
          result: {
            type: "stripe_payment",
            amount: (invoice.amount_paid || 0) / 100,
            stripe_invoice_id: invoice.id,
          },
        });

        // Queue trigger event so workflow templates can fire on
        // payment_succeeded (e.g., a thank-you / receipt drip).
        if (client.profile_id) {
          await supabase.from("trigger_events").insert({
            user_id: client.profile_id,
            trigger_type: "stripe.payment_succeeded",
            source_table: "invoices",
            source_id: null,
            payload: {
              client_id: client.id,
              client_name: client.business_name,
              amount_paid: invoice.amount_paid,
              currency: invoice.currency,
              invoice_id: invoice.id,
              stripe_customer_id: customerId,
            },
            status: "pending",
          });
        }

        await notifyOps(
          `💰 Payment Received!\n\n${client.business_name}: $${((invoice.amount_paid || 0) / 100).toFixed(2)}\nInvoice: ${invoice.number || invoice.id}`,
        );
      }
      break;
    }

    // ── Invoice Payment Failed ──
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      // Check if this is an agency owner's failed payment
      const { data: failedAgency } = await supabase
        .from("profiles")
        .select("id, full_name, email, plan_tier")
        .eq("stripe_customer_id", customerId)
        .single();

      if (failedAgency) {
        await supabase.from("trinity_log").insert({
          action_type: "custom",
          description: `Agency payment failed: ${failedAgency.full_name || failedAgency.email} — $${((invoice.amount_due || 0) / 100).toFixed(2)}`,
          status: "failed",
          user_id: failedAgency.id,
          result: { type: "agency_payment_failed", stripe_invoice_id: invoice.id },
        });

        await notifyOps(
          `🚨 Agency Payment Failed!\n\n${failedAgency.full_name || failedAgency.email}\nPlan: ${failedAgency.plan_tier}\nAmount: $${((invoice.amount_due || 0) / 100).toFixed(2)}\nACTION NEEDED`,
        );

        // Send payment failed email to the agency owner
        if (failedAgency.email) {
          sendPaymentFailedEmail(
            failedAgency.email,
            failedAgency.full_name || "there"
          ).catch(() => {});
        }
      }

      const { data: client } = await supabase
        .from("clients")
        .select("id, business_name, profile_id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (client) {
        // Update invoice status
        if (invoice.id) {
          await supabase
            .from("invoices")
            .update({ status: "overdue" })
            .eq("stripe_invoice_id", invoice.id);
        }

        // Log and notify
        await supabase.from("trinity_log").insert({
          action_type: "custom",
          description: `Payment failed for ${client.business_name}: $${((invoice.amount_due || 0) / 100).toFixed(2)}`,
          client_id: client.id,
          status: "failed",
          result: { type: "payment_failed", stripe_invoice_id: invoice.id },
        });

        // Queue a workflow trigger event for the failed-payment-recovery template.
        // The cron `/api/cron/process-trigger-events` picks this up within 1 min
        // and fans out to any installed workflows whose trigger_type matches.
        if (client.profile_id) {
          await supabase.from("trigger_events").insert({
            user_id: client.profile_id,
            trigger_type: "stripe.payment_failed",
            source_table: "invoices",
            source_id: null,
            payload: {
              client_id: client.id,
              client_name: client.business_name,
              stripe_invoice_id: invoice.id,
              stripe_customer_id: customerId,
              amount_due: invoice.amount_due,
              currency: invoice.currency,
              invoice_id: invoice.id,
            },
            status: "pending",
          });
        }

        await notifyOps(
          `⚠️ Payment Failed!\n\n${client.business_name}: $${((invoice.amount_due || 0) / 100).toFixed(2)}\nFollow up ASAP.`,
        );
      }
      break;
    }

    // ── Subscription Created/Updated ──
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;

      // Propagate agency-owner plan changes (upgrade / downgrade via Stripe portal,
      // proration, status changes). Without this, a user upgrades in the portal
      // but their profile.plan_tier stays on the old tier — silent failure.
      const subMeta = (sub.metadata || {}) as Record<string, string>;
      if (subMeta.type === "agency_subscription" && subMeta.user_id) {
        // When active/trialing, reflect the new plan_tier; when past_due/unpaid/canceled, null it.
        const isActive = sub.status === "active" || sub.status === "trialing";
        const newPlan = isActive ? (subMeta.plan_tier || null) : null;
        await supabase
          .from("profiles")
          .update({ plan_tier: newPlan })
          .eq("id", subMeta.user_id);

        await supabase.from("trinity_log").insert({
          action_type: "custom",
          description: `Agency subscription ${sub.status}: plan=${newPlan || "(cleared)"}`,
          user_id: subMeta.user_id,
          status: isActive ? "completed" : "failed",
          result: {
            type: "agency_subscription_updated",
            plan_tier: newPlan,
            stripe_status: sub.status,
            stripe_sub_id: sub.id,
          },
        });
      }

      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (client) {
        // Update client MRR based on subscription
        const monthlyAmount = sub.items.data.reduce((sum, item) => {
          const price = item.price;
          if (price.recurring?.interval === "month") return sum + (price.unit_amount || 0);
          if (price.recurring?.interval === "year") return sum + Math.round((price.unit_amount || 0) / 12);
          return sum;
        }, 0) / 100;

        await supabase
          .from("clients")
          .update({
            mrr: monthlyAmount,
            stripe_subscription_id: sub.id,
          })
          .eq("id", client.id);
      }
      break;
    }

    // ── Subscription Deleted ──
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;

      // Check if this is an agency owner's subscription
      const { data: agencyProfile } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("stripe_customer_id", customerId)
        .single();

      if (agencyProfile) {
        // Agency owner cancelled — clear their plan
        await supabase
          .from("profiles")
          .update({ plan_tier: null })
          .eq("id", agencyProfile.id);

        await supabase.from("trinity_log").insert({
          action_type: "custom",
          description: `Agency subscription cancelled: ${agencyProfile.full_name || agencyProfile.email}`,
          status: "completed",
          result: { type: "agency_subscription_cancelled", user_id: agencyProfile.id, stripe_sub_id: sub.id },
        });

        await notifyOps(
          `🚨 Agency Subscription Cancelled!\n\n${agencyProfile.full_name || "Unknown"} (${agencyProfile.email || ""})\nSub: ${sub.id}\nTrigger retention!`,
        );

        // Send cancellation email to the agency owner
        if (agencyProfile.email) {
          const planTier = (sub.metadata?.plan_tier as string | undefined) || "your plan";
          sendBrandedEmail({
            agency_owner_id: agencyProfile.id,
            kind: "plan_cancelled",
            to: agencyProfile.email,
            extra: { plan_name: planTier },
          }).catch(() => {});
        }
        break;
      }

      // Otherwise check if it's a client subscription
      const { data: client } = await supabase
        .from("clients")
        .select("id, business_name, profile_id, email")
        .eq("stripe_customer_id", customerId)
        .single();

      if (client) {
        await supabase
          .from("clients")
          .update({ mrr: 0, stripe_subscription_id: null })
          .eq("id", client.id);

        await supabase.from("trinity_log").insert({
          action_type: "custom",
          description: `Subscription cancelled: ${client.business_name}`,
          client_id: client.id,
          status: "completed",
          result: { type: "subscription_cancelled", stripe_sub_id: sub.id },
        });

        // Queue trigger event for the subscription-canceled-winback template.
        if (client.profile_id) {
          await supabase.from("trigger_events").insert({
            user_id: client.profile_id,
            trigger_type: "stripe.subscription_canceled",
            source_table: "clients",
            source_id: client.id,
            payload: {
              client_id: client.id,
              client_name: client.business_name,
              stripe_sub_id: sub.id,
              stripe_customer_id: customerId,
            },
            status: "pending",
          });
        }

        await notifyOps(
          `🚨 Subscription Cancelled!\n\n${client.business_name} just cancelled. Trigger retention!`,
        );

        // Send branded cancellation email to the client
        if (client.email && client.profile_id) {
          sendBrandedEmail({
            agency_owner_id: client.profile_id,
            kind: "plan_cancelled",
            to: client.email,
            client_id: client.id,
            extra: { plan_name: "your plan" },
          }).catch(() => {});
        }
      }
      break;
    }

    // ── Checkout Completed ──
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const type = session.metadata?.type;

      if (type === "agency_subscription") {
        // Agency owner subscribed to a plan from the pricing page
        const userId = session.metadata?.user_id;
        const planTier = session.metadata?.plan_tier;

        if (userId && planTier) {
          // Activate their plan
          await supabase
            .from("profiles")
            .update({ plan_tier: planTier, role: "admin" })
            .eq("id", userId);

          await supabase.from("trinity_log").insert({
            action_type: "custom",
            description: `New agency subscription: ${planTier} plan ($${((session.amount_total || 0) / 100).toFixed(0)}/mo)`,
            status: "completed",
            result: {
              type: "agency_subscription",
              plan_tier: planTier,
              user_id: userId,
              session_id: session.id,
              amount: session.amount_total ? session.amount_total / 100 : null,
            },
          });

          // Send branded plan-purchase email (congrats + onboarding)
          const { data: prof } = await supabase.from("profiles").select("full_name, email").eq("id", userId).single();
          if (prof?.email) {
            const planAmount = session.amount_total
              ? `$${(session.amount_total / 100).toFixed(0)}/mo`
              : "";
            sendBrandedEmail({
              agency_owner_id: userId,
              kind: "plan_purchase",
              to: prof.email,
              extra: {
                plan_name: planTier,
                plan_amount: planAmount,
                billing_cycle: "monthly",
              },
            }).catch(() => {});
            // Legacy fallback (keeps backward-compat while branded template is confirmed)
            sendWelcomeEmail(
              prof.email,
              prof.full_name || prof.email.split("@")[0] || "there",
              planTier,
            ).catch(() => {});
          }

          await notifyOps(
            `🎉 New Agency Signup!\n\n${prof?.full_name || "Unknown"} (${prof?.email || ""})\nPlan: ${planTier}\nMRR: $${((session.amount_total || 0) / 100).toFixed(0)}`,
          );
        }
      } else if (type === "client_subscription") {
        const clientId = session.metadata?.client_id;
        if (clientId) {
          await supabase.from("trinity_log").insert({
            action_type: "custom",
            description: `New subscription started via Stripe Checkout`,
            client_id: clientId,
            status: "completed",
            result: {
              type: "checkout_completed",
              session_id: session.id,
              amount: session.amount_total ? session.amount_total / 100 : null,
            },
          });

          // Send branded plan-purchase email to the client
          const { data: clientRow } = await supabase
            .from("clients")
            .select("id, profile_id, email, contact_name")
            .eq("id", clientId)
            .maybeSingle();
          if (clientRow?.email && clientRow.profile_id) {
            const planAmount = session.amount_total
              ? `$${(session.amount_total / 100).toFixed(0)}/mo`
              : "";
            const planLabel = session.metadata?.plan_name || planAmount || "your plan";
            sendBrandedEmail({
              agency_owner_id: clientRow.profile_id,
              kind: "plan_purchase",
              to: clientRow.email,
              client_id: clientId,
              extra: {
                plan_name: planLabel,
                plan_amount: planAmount,
                billing_cycle: session.metadata?.billing_cycle || "monthly",
              },
            }).catch(() => {});
          }
        }
      } else if (type === "website_subscription") {
        // Per-website subscription from the website builder pricing modal.
        const websiteId = session.metadata?.website_id;
        const profileId = session.metadata?.profile_id;
        const tier = session.metadata?.tier;
        const billingCycle = session.metadata?.billing_cycle || "monthly";
        const addonsRaw = session.metadata?.addons || "";
        const addons = addonsRaw ? addonsRaw.split(",").filter(Boolean) : [];
        const includesWhiteLabel = addons.includes("white_label");

        if (websiteId && profileId) {
          // Promote the site to live and (optionally) strip the watermark.
          await supabase.from("website_projects").update({
            status: "live",
            watermark_enabled: !includesWhiteLabel,
            demo_expires_at: null,
            pricing_tier: tier,
            updated_at: new Date().toISOString(),
          }).eq("id", websiteId);

          // Update the most-recent pending subscription row with the Stripe IDs.
          const { data: latest } = await supabase
            .from("website_subscriptions")
            .select("id")
            .eq("website_id", websiteId)
            .eq("profile_id", profileId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (latest?.id) {
            await supabase.from("website_subscriptions").update({
              stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : null,
              status: "active",
              current_period_end: new Date(Date.now() + (billingCycle === "yearly" ? 365 : 30) * 86_400_000).toISOString(),
              updated_at: new Date().toISOString(),
            }).eq("id", latest.id);
          }

          await supabase.from("trinity_log").insert({
            action_type: "custom",
            description: `Website went live: ${tier} tier ($${((session.amount_total || 0) / 100).toFixed(2)}/${billingCycle === "yearly" ? "yr" : "mo"})`,
            user_id: profileId,
            status: "completed",
            result: {
              type: "website_subscription",
              website_id: websiteId,
              tier,
              billing_cycle: billingCycle,
              addons,
              session_id: session.id,
            },
          });
        }
      } else if (type === "demo_extension") {
        const websiteId = session.metadata?.website_id;
        const newExpiry = session.metadata?.new_expires_at;
        if (websiteId && newExpiry) {
          await supabase.from("website_projects").update({
            demo_expires_at: newExpiry,
            status: "preview",
            updated_at: new Date().toISOString(),
          }).eq("id", websiteId);
        }
      } else if (type === "token_purchase") {
        // One-time AI token top-up — credit bonus tokens to the user.
        const userId = session.metadata?.user_id;
        const tokens = Number(session.metadata?.tokens || 0);
        const packId = session.metadata?.pack_id || "";

        if (userId && tokens > 0) {
          const key = `bonus_tokens_${userId}`;
          const { data: existing } = await supabase
            .from("system_health")
            .select("metadata")
            .eq("integration_name", key)
            .single();

          const current = (existing?.metadata as Record<string, number> | null)?.tokens || 0;
          const newTotal = current + tokens;

          if (existing) {
            await supabase
              .from("system_health")
              .update({
                metadata: {
                  tokens: newTotal,
                  last_purchase: new Date().toISOString(),
                  pack_id: packId,
                },
              })
              .eq("integration_name", key);
          } else {
            await supabase.from("system_health").insert({
              integration_name: key,
              status: "healthy",
              metadata: {
                tokens: newTotal,
                last_purchase: new Date().toISOString(),
                pack_id: packId,
              },
              last_check_at: new Date().toISOString(),
            });
          }

          await supabase.from("trinity_log").insert({
            action_type: "token_purchase",
            description: `Purchased ${tokens.toLocaleString()} tokens ($${((session.amount_total || 0) / 100).toFixed(2)})`,
            user_id: userId,
            status: "completed",
            result: { type: "token_purchase", tokens, pack_id: packId, new_balance: newTotal },
          });
        }
      } else if (type === "domain_purchase") {
        // Client paid for a custom domain subscription. Auto-purchase the
        // domain + attach to Vercel + set DNS so they never touch registrar UI.
        const domain = session.metadata?.domain;
        const projectId = session.metadata?.project_id;
        const userId = session.metadata?.user_id;

        if (domain && userId) {
          // Update domain row status + link Stripe IDs
          await supabase.from("website_domains").update({
            status: "processing",
            stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : null,
            stripe_checkout_session_id: session.id,
            updated_at: new Date().toISOString(),
          }).eq("profile_id", userId).eq("domain", domain);

          // Fire the auto-configure endpoint — does GoDaddy purchase + Vercel
          // attach + DNS config. Best-effort; status is tracked on the row.
          const origin = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";
          fetch(`${origin}/api/websites/domains/auto-configure`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              domain,
              project_id: projectId || undefined,
              user_id: userId,
            }),
          }).catch(() => {});

          await supabase.from("trinity_log").insert({
            action_type: "custom",
            description: `Domain purchased: ${domain} ($${((session.amount_total || 0) / 100).toFixed(2)})`,
            user_id: userId,
            status: "completed",
            result: {
              type: "domain_purchase",
              domain,
              project_id: projectId,
              session_id: session.id,
              billing_cycle: session.metadata?.billing_cycle,
            },
          });
        }
      }
      break;
    }

    // ── Charge Refunded ──
    // Used by the `refund-acknowledgment` workflow template. Stripe fires
    // charge.refunded after a refund posts; we map customer → client to know
    // which agency owner gets the trigger event.
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const customerId =
        typeof charge.customer === "string"
          ? charge.customer
          : (charge.customer?.id ?? null);
      if (!customerId) break;

      const { data: client } = await supabase
        .from("clients")
        .select("id, business_name, profile_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
      if (client?.profile_id) {
        await supabase.from("trigger_events").insert({
          user_id: client.profile_id,
          trigger_type: "stripe.refund_issued",
          source_table: "charges",
          source_id: null,
          payload: {
            client_id: client.id,
            client_name: client.business_name,
            stripe_charge_id: charge.id,
            stripe_customer_id: customerId,
            refund_amount:
              typeof charge.amount_refunded === "number"
                ? charge.amount_refunded / 100
                : null,
            currency: charge.currency,
            refund_date: new Date().toISOString(),
            refund_reason:
              charge.refunds?.data?.[0]?.reason ?? "requested_by_customer",
          },
          status: "pending",
        });
      }
      break;
    }
  }

    // Mark the event as fully processed so future retries see 'done' and
    // short-circuit. If we threw above, this line is skipped and the row
    // stays 'processing' — provider retry will reclaim it after the stale
    // window (5 min) and re-run.
    await completeEvent(supabase, "stripe", event.id);
    return NextResponse.json({ received: true });
  } catch (err) {
    // Surface to Sentry/GlitchTip so a regression in webhook handling
    // pages immediately. Re-throw so the idempotency row stays in
    // 'processing' state and Stripe retries will reclaim it after the
    // 5-min stale window.
    reportError(err, {
      route: "/api/billing/webhook",
      component: "stripe-handler",
      eventId: event.id,
      eventType: event.type,
    });
    throw err;
  }
}
