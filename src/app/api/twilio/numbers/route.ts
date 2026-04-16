import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

export async function GET(_request: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceSupabase = createServiceClient();

    const { data: clients, error } = await serviceSupabase
      .from("clients")
      .select("id, business_name, twilio_phone_number, twilio_phone_sid, created_at")
      .not("twilio_phone_number", "is", null);

    if (error) {
      console.error("Error fetching provisioned numbers:", error);
      return NextResponse.json(
        { error: "Failed to fetch phone numbers" },
        { status: 500 }
      );
    }

    const numbers = (clients ?? []).map((client) => ({
      id: client.id,
      number: client.twilio_phone_number,
      sid: client.twilio_phone_sid ?? null,
      client_name: client.business_name,
      type: "local" as const,
      status: "active" as const,
      capabilities: ["Voice", "SMS"],
      monthlyCost: 1.5,
      country: "US",
      purchasedDate: client.created_at
        ? client.created_at.split("T")[0]
        : null,
    }));

    return NextResponse.json({ numbers });
  } catch (err) {
    console.error("Unexpected error in GET /api/twilio/numbers:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
