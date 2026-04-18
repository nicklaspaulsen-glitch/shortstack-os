-- Website Projects & Domains
-- Claude-powered website builder with Vercel deployment + GoDaddy domain purchase.

create table if not exists website_projects (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  name text not null,
  subdomain text,
  custom_domain text,
  godaddy_order_id text,
  vercel_project_id text,
  vercel_deployment_id text,
  vercel_url text,
  status text default 'draft' check (status in ('draft','generating','preview','deploying','live','failed','archived')),
  template_style text,
  industry text,
  business_info jsonb default '{}'::jsonb,
  wizard_answers jsonb default '{}'::jsonb,
  generated_content jsonb default '{}'::jsonb,
  generated_files jsonb default '{}'::jsonb,  -- { "index.html": "...", "styles.css": "...", ... }
  preview_url text,
  analytics jsonb default '{}'::jsonb,
  error_log text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_website_projects_profile on website_projects(profile_id);
create index if not exists idx_website_projects_status on website_projects(status);
alter table website_projects enable row level security;
create policy "Users manage own websites" on website_projects for all using (auth.uid() = profile_id);

create table if not exists website_domains (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  website_id uuid references website_projects(id) on delete cascade,
  domain text unique not null,
  status text default 'pending' check (status in ('pending','purchased','dns_configured','active','expired','transferred')),
  godaddy_order_id text,
  godaddy_customer_id text,
  purchase_price numeric(10,2),
  purchase_currency text default 'USD',
  expires_at timestamptz,
  dns_records jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_domains_profile on website_domains(profile_id);
alter table website_domains enable row level security;
create policy "Users manage own domains" on website_domains for all using (auth.uid() = profile_id);
