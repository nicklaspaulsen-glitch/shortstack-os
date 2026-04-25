import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendPaymentFailedEmail, sendWelcomeEmail } from "@/lib/email";
import { type Stripe } from "stripe";
import { getStripe } from "@/lib/stripe/client";

// Unified Stripe Webhook — handles client billing events
// Register this at: https://dashboard.stripe.com/webhooks
// URL: https://app.shortstack.work/api/billing/webhook
// Events: invoice.paid, invoice.payment_failed, customer.subscription.created,
//         customer.subscription.updated, customer.subscription.deleted,
//         checkout.session.completed

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_BILLING_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || ""
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceClient();

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

        const chatId = process.env.TELEGRAM_CHAT_ID;
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (chatId && botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: `💰 Agency Renewal!\n\n${agencyOwner.full_name || agencyOwner.email}: $${((invoice.amount_paid || 0) / 100).toFixed(2)}\nPlan: ${agencyOwner.plan_tier}`,
            }),
          }).catch(() => {});
        }
        // Don't break — also check clients table in case they manage client billing too
      }

      // Find the client by stripe_customer_id
      const { data: client } = await supabase
        .from("clients")
        .select("id, business_name")
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

        // Notify on Telegram
        const chatId = process.env.TELEGRAM_CHAT_ID;
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (chatId && botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: `💰 Payment Received!\n\n${client.business_name}: $${((invoice.amount_paid || 0) / 100).toFixed(2)}\nInvoice: ${invoice.number || invoice.id}`,
            }),
          }).catch(() => {});
        }
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

        const chatId = process.env.TELEGRAM_CHAT_ID;
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (chatId && botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: `🚨 Agency Payment Failed!\n\n${failedAgency.full_name || failedAgency.email}\nPlan: ${failedAgency.plan_tier}\nAmount: $${((invoice.amount_due || 0) / 100).toFixed(2)}\nACTION NEEDED`,
            }),
          }).catch(() => {});
        }

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
        .select("id, business_name")
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

        const chatId = process.env.TELEGRAM_CHAT_ID;
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (chatId && botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: `⚠️ Payment Failed!\n\n${client.business_name}: $${((invoice.amount_due || 0) / 100).toFixed(2)}\nFollow up ASAP.`,
            }),
          }).catch(() => {});
        }
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

        const chatId = process.env.TELEGRAM_CHAT_ID;
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (chatId && botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: `🚨 Agency Subscription Cancelled!\n\n${agencyProfile.full_name || "Unknown"} (${agencyProfile.email || ""})\nSub: ${sub.id}\nTrigger retention!`,
            }),
          }).catch(() => {});
        }
        break;
      }

      // Otherwise check if it's a client subscription
      const { data: client } = await supabase
        .from("clients")
        .select("id, business_name")
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

        const chatId = process.env.TELEGRAM_CHAT_ID;
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (chatId && botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: `🚨 Subscription Cancelled!\n\n${client.business_name} just cancelled. Trigger retention!`,
            }),
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

          // Send branded welcome email with plan details
          const { data: prof } = await supabase.from("profiles").select("full_name, email").eq("id", userId).single();
          if (prof?.email) {
            sendWelcomeEmail(
              prof.email,
              prof.full_name || prof.email.split("@")[0] || "there",
              planTier,
            ).catch(() => {});
          }

          // Telegram notification
          const chatId = process.env.TELEGRAM_CHAT_ID;
          const botToken = process.env.TELEGRAM_BOT_TOKEN;
          if (chatId && botToken) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: `🎉 New Agency Signup!\n\n${prof?.full_name || "Unknown"} (${prof?.email || ""})\nPlan: ${planTier}\nMRR: $${((session.amount_total || 0) / 100).toFixed(0)}`,
              }),
            }).catch(() => {});
          }
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
  }

  return NextResponse.json({ received: true });
}
