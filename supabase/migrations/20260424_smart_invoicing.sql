-- Smart invoicing: extends the existing `invoices` table with the columns
-- the new UI + API expect. The table already exists (see supabase/schema.sql
-- and the original sprint-1 migrations), so we use ADD COLUMN IF NOT EXISTS
-- for every change to stay idempotent.
--
-- Columns being added to match the new API shape:
--   org_id            — soft org tag (nullable today, required later)
--   invoice_number    — human-readable number, unique per org
--   issue_date        — separate from created_at so back-dating works
--   line_items        — jsonb array of {description, qty, unit_price_cents}
--   subtotal_cents    — pre-tax total in cents
--   tax_cents         — tax in cents
--   total_cents       — grand total in cents (mirrors amount, in cents)
--   notes             — memo surfaced in the hosted invoice footer
--   stripe_payment_link — cached payment-link URL when created
--   sent_at           — when the invoice was emailed
--   updated_at        — auto-updated timestamp

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  created_at timestamptz default now()
);

alter table invoices add column if not exists org_id uuid;
alter table invoices add column if not exists invoice_number text;
alter table invoices add column if not exists issue_date date default current_date;
alter table invoices add column if not exists due_date date;
alter table invoices add column if not exists status text default 'draft';
alter table invoices add column if not exists line_items jsonb not null default '[]';
alter table invoices add column if not exists subtotal_cents int default 0;
alter table invoices add column if not exists tax_cents int default 0;
alter table invoices add column if not exists total_cents int default 0;
alter table invoices add column if not exists currency text default 'USD';
alter table invoices add column if not exists notes text;
alter table invoices add column if not exists stripe_payment_link text;
alter table invoices add column if not exists sent_at timestamptz;
alter table invoices add column if not exists paid_at timestamptz;
alter table invoices add column if not exists updated_at timestamptz default now();

-- Status check (dropped + recreated so the existing enum, if any, stays happy).
-- Runs only if `status` is a plain text column — if it was already typed as
-- the original invoice_status enum, this is a no-op.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'invoices' and column_name = 'status' and data_type = 'text'
  ) then
    alter table invoices drop constraint if exists invoices_status_check;
    alter table invoices add constraint invoices_status_check
      check (status in ('draft','sent','paid','overdue','cancelled'));
  end if;
end $$;

-- Org-scoped unique invoice numbers (nullable org_id rows won't conflict
-- because a unique index with nulls allows many nulls by default).
create unique index if not exists idx_invoices_org_number
  on invoices(org_id, invoice_number)
  where invoice_number is not null;

create index if not exists idx_invoices_status on invoices(status);
create index if not exists idx_invoices_client on invoices(client_id);
create index if not exists idx_invoices_issue_date on invoices(issue_date desc);

-- Make sure RLS is on. Existing policies (if any) are untouched; add owner
-- policies keyed on the agency user that owns the parent client, since the
-- baseline schema uses that pattern everywhere.
alter table invoices enable row level security;

drop policy if exists invoices_owner_all on invoices;
create policy invoices_owner_all on invoices
  for all
  using (
    client_id is null
    or exists (
      select 1 from clients c
      where c.id = invoices.client_id
        and c.profile_id = auth.uid()
    )
  )
  with check (
    client_id is null
    or exists (
      select 1 from clients c
      where c.id = invoices.client_id
        and c.profile_id = auth.uid()
    )
  );

-- Touch updated_at on every update.
create or replace function touch_invoices_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_invoices_updated_at on invoices;
create trigger trg_invoices_updated_at
  before update on invoices
  for each row execute function touch_invoices_updated_at();
