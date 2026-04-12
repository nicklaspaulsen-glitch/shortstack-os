import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Notion Integration — sync databases, create pages, manage tasks
// Requires: NOTION_API_KEY (internal integration token)
// Docs: https://developers.notion.com/reference

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function notionHeaders() {
  return {
    Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.NOTION_API_KEY) {
    return NextResponse.json({ error: "Notion not configured", connected: false }, { status: 500 });
  }

  const action = request.nextUrl.searchParams.get("action") || "databases";

  try {
    if (action === "databases") {
      const res = await fetch(`${NOTION_API}/search`, {
        method: "POST",
        headers: notionHeaders(),
        body: JSON.stringify({ filter: { property: "object", value: "database" }, page_size: 50 }),
      });
      const data = await res.json();
      const databases = (data.results || []).map((db: Record<string, unknown>) => ({
        id: db.id,
        title: ((db.title as Array<{ plain_text: string }>)?.[0]?.plain_text) || "Untitled",
        url: db.url,
        created_time: db.created_time,
        last_edited_time: db.last_edited_time,
      }));
      return NextResponse.json({ success: true, databases });
    }

    if (action === "pages") {
      const databaseId = request.nextUrl.searchParams.get("database_id");
      if (!databaseId) return NextResponse.json({ error: "database_id required" }, { status: 400 });

      const res = await fetch(`${NOTION_API}/databases/${databaseId}/query`, {
        method: "POST",
        headers: notionHeaders(),
        body: JSON.stringify({ page_size: 50 }),
      });
      const data = await res.json();
      const pages = (data.results || []).map((p: Record<string, unknown>) => ({
        id: p.id,
        url: p.url,
        created_time: p.created_time,
        last_edited_time: p.last_edited_time,
        properties: p.properties,
      }));
      return NextResponse.json({ success: true, pages });
    }

    if (action === "page") {
      const pageId = request.nextUrl.searchParams.get("page_id");
      if (!pageId) return NextResponse.json({ error: "page_id required" }, { status: 400 });

      const [pageRes, blocksRes] = await Promise.all([
        fetch(`${NOTION_API}/pages/${pageId}`, { headers: notionHeaders() }),
        fetch(`${NOTION_API}/blocks/${pageId}/children?page_size=100`, { headers: notionHeaders() }),
      ]);
      const page = await pageRes.json();
      const blocks = await blocksRes.json();
      return NextResponse.json({ success: true, page, blocks: blocks.results || [] });
    }

    if (action === "search") {
      const query = request.nextUrl.searchParams.get("q") || "";
      const res = await fetch(`${NOTION_API}/search`, {
        method: "POST",
        headers: notionHeaders(),
        body: JSON.stringify({ query, page_size: 20 }),
      });
      const data = await res.json();
      return NextResponse.json({ success: true, results: data.results || [] });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: `Notion error: ${err}` }, { status: 500 });
  }
}

// Create pages, update properties, append blocks
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.NOTION_API_KEY) {
    return NextResponse.json({ error: "Notion not configured" }, { status: 500 });
  }

  const { action, client_id, ...params } = await request.json();

  try {
    if (action === "create_page") {
      const { database_id, properties, content } = params;
      if (!database_id) return NextResponse.json({ error: "database_id required" }, { status: 400 });

      const body: Record<string, unknown> = {
        parent: { database_id },
        properties: properties || {},
      };

      // Add content blocks if provided
      if (content) {
        body.children = Array.isArray(content) ? content : [{
          object: "block",
          type: "paragraph",
          paragraph: { rich_text: [{ type: "text", text: { content } }] },
        }];
      }

      const res = await fetch(`${NOTION_API}/pages`, {
        method: "POST",
        headers: notionHeaders(),
        body: JSON.stringify(body),
      });
      const page = await res.json();

      if (client_id) {
        await supabase.from("trinity_log").insert({
          action_type: "custom",
          description: `Notion page created`,
          client_id,
          status: "completed",
          result: { type: "notion_page", page_id: page.id, url: page.url },
        });
      }

      return NextResponse.json({ success: true, page_id: page.id, url: page.url });
    }

    if (action === "update_page") {
      const { page_id, properties } = params;
      if (!page_id) return NextResponse.json({ error: "page_id required" }, { status: 400 });

      const res = await fetch(`${NOTION_API}/pages/${page_id}`, {
        method: "PATCH",
        headers: notionHeaders(),
        body: JSON.stringify({ properties }),
      });
      const page = await res.json();
      return NextResponse.json({ success: true, page_id: page.id });
    }

    if (action === "append_blocks") {
      const { page_id, blocks } = params;
      if (!page_id || !blocks) return NextResponse.json({ error: "page_id and blocks required" }, { status: 400 });

      const res = await fetch(`${NOTION_API}/blocks/${page_id}/children`, {
        method: "PATCH",
        headers: notionHeaders(),
        body: JSON.stringify({ children: blocks }),
      });
      const data = await res.json();
      return NextResponse.json({ success: true, results: data.results || [] });
    }

    if (action === "sync_clients") {
      // Sync ShortStack clients to a Notion database
      const { database_id } = params;
      if (!database_id) return NextResponse.json({ error: "database_id required" }, { status: 400 });

      const { data: clients } = await supabase
        .from("clients")
        .select("id, business_name, contact_name, email, package_tier, mrr, health_score, is_active")
        .eq("is_active", true);

      let synced = 0;
      for (const client of clients || []) {
        await fetch(`${NOTION_API}/pages`, {
          method: "POST",
          headers: notionHeaders(),
          body: JSON.stringify({
            parent: { database_id },
            properties: {
              Name: { title: [{ text: { content: client.business_name } }] },
              Contact: { rich_text: [{ text: { content: client.contact_name || "" } }] },
              Email: { email: client.email },
              Package: { select: { name: client.package_tier || "Growth" } },
              MRR: { number: client.mrr || 0 },
              Health: { number: client.health_score || 0 },
            },
          }),
        });
        synced++;
      }

      return NextResponse.json({ success: true, synced });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: `Notion error: ${err}` }, { status: 500 });
  }
}
