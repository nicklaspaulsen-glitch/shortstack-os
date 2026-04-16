import { NextRequest, NextResponse } from "next/server";

// In-memory notes store (replace with DB in production)
const notes: Array<{
  id: string;
  content: string;
  url: string;
  type: string;
  createdAt: string;
}> = [];

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { content, url, type } = body;

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const note = {
      id: crypto.randomUUID(),
      content,
      url: url || "",
      type: type || "note",
      createdAt: new Date().toISOString(),
    };

    notes.unshift(note);
    // Keep only last 100 notes in memory
    if (notes.length > 100) notes.length = 100;

    console.log("[Extension] Note saved:", note.id);

    return NextResponse.json({ ok: true, note });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, notes: notes.slice(0, 20) });
}
