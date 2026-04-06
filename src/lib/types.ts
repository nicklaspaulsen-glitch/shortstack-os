export type UserRole = "admin" | "team_member" | "client";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: UserRole;
  phone: string | null;
  country: string | null;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type LeadStatus = "new" | "called" | "not_interested" | "booked" | "converted";
export type OutreachPlatform = "instagram" | "linkedin" | "facebook" | "tiktok";
export type OutreachStatus = "sent" | "delivered" | "replied" | "no_reply" | "bounced";
export type FollowupStatus = "pending" | "sent" | "completed" | "cancelled";
export type ContractStatus = "draft" | "sent" | "viewed" | "signed" | "expired" | "declined";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";
export type ContentStatus = "idea" | "scripted" | "in_production" | "editing" | "ready_to_publish" | "scheduled" | "published" | "failed";
export type PublishPlatform = "youtube" | "youtube_shorts" | "tiktok" | "instagram_reels" | "facebook_reels" | "linkedin_video";
export type CampaignPlatform = "meta_ads" | "tiktok_ads" | "google_ads";
export type CampaignStatus = "draft" | "active" | "paused" | "completed" | "archived";
export type IntegrationStatus = "healthy" | "degraded" | "down" | "unknown";
export type TrinityActionType = "website" | "ai_receptionist" | "chatbot" | "automation" | "discord" | "social_setup" | "email_campaign" | "sms_campaign" | "lead_gen" | "custom";
export type BrandIdeaType = "long_form" | "short_form";
export type DealStatus = "open" | "won" | "lost";

export interface Lead {
  id: string;
  business_name: string;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  google_rating: number | null;
  review_count: number;
  industry: string | null;
  category: string | null;
  source: string;
  source_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
  tiktok_url: string | null;
  status: LeadStatus;
  ghl_contact_id: string | null;
  ghl_sync_status: string;
  ghl_synced_at: string | null;
  assigned_to: string | null;
  scraped_at: string;
  created_at: string;
}

export interface OutreachEntry {
  id: string;
  lead_id: string | null;
  platform: OutreachPlatform;
  business_name: string;
  recipient_handle: string | null;
  message_text: string;
  status: OutreachStatus;
  reply_text: string | null;
  replied_at: string | null;
  sent_at: string;
}

export interface FollowUp {
  id: string;
  outreach_id: string;
  lead_id: string | null;
  platform: OutreachPlatform;
  followup_number: number;
  scheduled_date: string;
  status: FollowupStatus;
  message_text: string | null;
  sent_at: string | null;
}

export interface Client {
  id: string;
  profile_id: string | null;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  website: string | null;
  industry: string | null;
  package_tier: string | null;
  services: string[];
  mrr: number;
  contract_status: ContractStatus;
  pandadoc_contract_id: string | null;
  ghl_contact_id: string | null;
  stripe_customer_id: string | null;
  health_score: number;
  notes: string | null;
  is_active: boolean;
  onboarded_at: string | null;
  created_at: string;
}

export interface Contract {
  id: string;
  client_id: string;
  pandadoc_id: string | null;
  title: string;
  status: ContractStatus;
  value: number | null;
  start_date: string | null;
  end_date: string | null;
  signed_at: string | null;
  document_url: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  client_id: string;
  stripe_invoice_id: string | null;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  due_date: string | null;
  paid_at: string | null;
  invoice_url: string | null;
  description: string | null;
  created_at: string;
}

export interface ClientTask {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  completed_at: string | null;
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
}

export interface TeamMember {
  id: string;
  profile_id: string | null;
  full_name: string;
  email: string;
  role: string;
  base_pay: number;
  commission_rate: number;
  payment_method: string | null;
  payment_details: Record<string, string>;
  country: string | null;
  is_active: boolean;
  started_at: string | null;
  created_at: string;
}

export interface Deal {
  id: string;
  client_id: string | null;
  client_name: string;
  service: string;
  amount: number;
  status: DealStatus;
  closed_by: string | null;
  cold_called_by: string | null;
  closed_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface Payroll {
  id: string;
  team_member_id: string;
  month: string;
  base_amount: number;
  commission_amount: number;
  total_amount: number;
  deals_closed: number;
  status: string;
  paid_at: string | null;
  payslip_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface ContentScript {
  id: string;
  client_id: string;
  title: string;
  script_type: string;
  brand_voice: string | null;
  script_body: string | null;
  hook: string | null;
  outline: Record<string, unknown> | null;
  seo_title: string | null;
  description: string | null;
  hashtags: string[] | null;
  keywords: string[] | null;
  chapters: Record<string, unknown> | null;
  thumbnail_idea: string | null;
  target_platform: PublishPlatform | null;
  status: ContentStatus;
  drive_folder_url: string | null;
  assigned_editor: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface ContentCalendarEntry {
  id: string;
  client_id: string;
  content_script_id: string | null;
  title: string;
  platform: PublishPlatform;
  scheduled_at: string | null;
  published_at: string | null;
  status: ContentStatus;
  live_url: string | null;
  content_type?: string;
  notes: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface ContentRequest {
  id: string;
  client_id: string | null;
  requester_name: string;
  source: string | null;
  request_text: string;
  ai_brief: string | null;
  status: string;
  assigned_editor: string | null;
  reviewed_by: string | null;
  created_at: string;
}

export interface PublishQueueItem {
  id: string;
  client_id: string;
  content_script_id: string | null;
  video_title: string;
  description: string | null;
  hashtags: string[] | null;
  thumbnail_text: string | null;
  scheduled_at: string | null;
  publish_now: boolean;
  platforms: PublishPlatform[];
  status: string;
  published_urls: Record<string, string>;
  error_message: string | null;
  approved_by: string | null;
  approved_at: string | null;
  published_at: string | null;
  created_at: string;
}

export interface PersonalBrandIdea {
  id: string;
  idea_type: BrandIdeaType;
  title: string;
  hook: string | null;
  outline: Record<string, unknown> | null;
  thumbnail_concept: string | null;
  estimated_length: string | null;
  target_keyword: string | null;
  platform_recommendation: string | null;
  trending_angle: string | null;
  core_concept: string | null;
  is_approved: boolean;
  added_to_calendar: boolean;
  batch_date: string;
  created_at: string;
}

export interface Campaign {
  id: string;
  client_id: string;
  name: string;
  platform: CampaignPlatform;
  external_campaign_id: string | null;
  status: CampaignStatus;
  budget_daily: number | null;
  budget_total: number | null;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  roas: number;
  start_date: string | null;
  end_date: string | null;
  settings: Record<string, unknown>;
  ai_suggestions: string | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface AdCreative {
  id: string;
  campaign_id: string;
  client_id: string;
  canva_design_id: string | null;
  title: string;
  headline: string | null;
  body_text: string | null;
  cta_text: string | null;
  image_url: string | null;
  video_url: string | null;
  platform: CampaignPlatform;
  status: string;
  performance: Record<string, unknown>;
  created_at: string;
}

export interface TrinityLogEntry {
  id: string;
  action_type: TrinityActionType;
  description: string;
  command: string | null;
  client_id: string | null;
  status: string;
  result: Record<string, unknown>;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface SystemHealthEntry {
  id: string;
  integration_name: string;
  status: IntegrationStatus;
  last_check_at: string;
  last_healthy_at: string | null;
  error_message: string | null;
  response_time_ms: number | null;
  uptime_percentage: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Briefing {
  id: string;
  user_id: string;
  content: Record<string, unknown>;
  summary: string | null;
  generated_at: string;
  read_at: string | null;
  created_at: string;
}
