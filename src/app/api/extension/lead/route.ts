import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, email, phone, source, detectedFrom } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // TODO: Replace with real DB insert (Supabase / Prisma)
    const lead = {
      id: crypto.randomUUID(),
      name,
      email: email || null,
      phone: phone || null,
      source: source || null,
      detectedFrom: detectedFrom || "extension",
      createdAt: new Date().toISOString(),
    };

    console.log("[Extension] Lead added:", lead);

    return NextResponse.json({ ok: true, lead });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
