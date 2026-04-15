import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/*
  Notifications table schema:

  create table notifications (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    title       text not null,
    message     text not null,
    type        text not null default 'info',  -- info, warning, success, error
    read        boolean not null default false,
    link        text,                           -- optional navigation link
    created_at  timestamptz not null default now()
  );

  create index idx_notifications_user on notifications(user_id, created_at desc);
  create index idx_notifications_unread on notifications(user_id) where read = false;
  alter table notifications enable row level security;
  create policy "Users see own notifications" on notifications
    for select using (auth.uid() = user_id);
  create policy "Users update own notifications" on notifications
    for update using (auth.uid() = user_id);
*/

// GET /api/notifications — fetch notifications for the current user
export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ notifications: data });
}

// PATCH /api/notifications — mark notification(s) as read
// Body: { id: string }          — mark single notification as read
// Body: { all: true }           — mark all as read for current user
export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  if (body.all) {
    // Mark all unread notifications as read
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, marked: "all" });
  }

  if (body.id) {
    // Mark single notification as read
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", body.id)
      .eq("user_id", user.id);

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, marked: body.id });
  }

  return NextResponse.json(
    { error: "Provide { id } or { all: true }" },
    { status: 400 }
  );
}
