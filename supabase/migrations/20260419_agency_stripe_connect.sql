-- Migration: Agency Stripe Connect — per-agency connected Stripe accounts
-- Date: 2026-04-19
-- Each agency (auth user) can connect their OWN Stripe account to bill their
-- clients through Trinity. Separate from Trinity's platform Stripe (which
-- bills agencies for the SaaS).

-- ── agency_stripe_accounts ─────────────────────────────────────────
-- One row per connected Stripe account. Keyed on user_id — an agency can
-- connect exactly one Stripe account at a time.
create table if not exists agency_stripe_accounts (
  user_id uuid primary key references profiles(id) on delete cascade,
  stripe_account_id text not null unique,
  account_type text not null default 'express' check (account_type in ('express', 'standard')),
  charges_enabled boolean default false,
  payouts_enabled boolean default false,
  details_submitted boolean default false,
  country text,
  default_currency text,
  business_name text,
  dashboard_url text,
  created_at timestamptz default now(),
  connected_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_agency_stripe_accounts_stripe_id
  on agency_stripe_accounts(stripe_account_id);

alter table agency_stripe_accounts enable row level security;

drop policy if exists "Users manage own stripe connect account" on agency_stripe_accounts;
create policy "Users manage own stripe connect account"
  on agency_stripe_accounts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── clients: new column for agency-scoped Stripe Customer ID ──────
-- Separate from existing clients.stripe_customer_id (which is on Trinity's
-- platform Stripe). This one lives on the agency's connected Stripe.
alter table clients
  add column if not exists agency_stripe_customer_id text;

create index if not exists idx_clients_agency_stripe_customer_id
  on clients(agency_stripe_customer_id);

-- ── client_invoices ───────────────────────────────────────────────
-- Invoices issued by an agency to a client on the AGENCY's connected Stripe.
create table if not exists client_invoices (
  id uuid primary key default gen_random_uuid(),
  agency_user_id uuid not null references profiles(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  agency_stripe_invoice_id text not null,
  amount_cents integer not null,
  currency text not null default 'usd',
  status text not null default 'draft',
  hosted_invoice_url text,
  due_date timestamptz,
  paid_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(agency_user_id, agency_stripe_invoice_id)
);

create index if not exists idx_client_invoices_agency on client_invoices(agency_user_id);
create index if not exists idx_client_invoices_client on client_invoices(client_id);
create index if not exists idx_client_invoices_status on client_invoices(status);

alter table client_invoices enable row level security;

drop policy if exists "Users manage own client invoices" on client_invoices;
create policy "Users manage own client invoices"
  on client_invoices for all
  using (auth.uid() = agency_user_id)
  with check (auth.uid() = agency_user_id);

-- ── client_payment_links ──────────────────────────────────────────
-- Stripe Payment Links scoped to a client, issued on the agency's connected
-- Stripe account. Useful when the agency wants a shareable checkout URL for
-- a one-off project fee, add-on, or deposit.
create table if not exists client_payment_links (
  id uuid primary key default gen_random_uuid(),
  agency_user_id uuid not null references profiles(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  stripe_payment_link_id text not null,
  url text not null,
  amount_cents integer not null,
  currency text not null default 'usd',
  product_name text,
  active boolean default true,
  created_at timestamptz default now(),
  expires_at timestamptz,
  unique(agency_user_id, stripe_payment_link_id)
);

create index if not exists idx_client_payment_links_agency on client_payment_links(agency_user_id);
create index if not exists idx_client_payment_links_client on client_payment_links(client_id);
create index if not exists idx_client_payment_links_active on client_payment_links(active) where active = true;

alter table client_payment_links enable row level security;

drop policy if exists "Users manage own client payment links" on client_payment_links;
create policy "Users manage own client payment links"
  on client_payment_links for all
  using (auth.uid() = agency_user_id)
  with check (auth.uid() = agency_user_id);

-- ── updated_at triggers ───────────────────────────────────────────
create or replace function set_agency_stripe_accounts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_agency_stripe_accounts_updated on agency_stripe_accounts;
create trigger trg_agency_stripe_accounts_updated
  before update on agency_stripe_accounts
  for each row
  execute function set_agency_stripe_accounts_updated_at();

create or replace function set_client_invoices_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_client_invoices_updated on client_invoices;
create trigger trg_client_invoices_updated
  before update on client_invoices
  for each row
  execute function set_client_invoices_updated_at();
