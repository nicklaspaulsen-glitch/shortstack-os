import { NextRequest, NextResponse } from "next/server";

// POST — Generate AI thumbnails (mock for now, will call RunPod SDXL later)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, style, platform, textOverlay, colorTheme, mood, faces, variations } = body;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Simulate AI generation delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Generate mock thumbnail results
    const count = variations || 1;
    const gradients = [
      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
      "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
      "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
      "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
      "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
      "linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)",
      "linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)",
    ];

    const thumbnails = Array.from({ length: count }, (_, i) => ({
      id: `thumb_${Date.now()}_${i}`,
      prompt,
      style: style || "youtube_classic",
      platform: platform || "youtube",
      textOverlay: textOverlay || "",
      colorTheme: colorTheme || "red_black",
      mood: mood || "dramatic",
      faces: faces || [],
      // Mock image URL — in production this will be a real generated image URL from RunPod
      imageUrl: null,
      gradient: gradients[i % gradients.length],
      width: body.width || 1280,
      height: body.height || 720,
      createdAt: new Date().toISOString(),
    }));

    return NextResponse.json({
      success: true,
      thumbnails,
      message: `Generated ${count} thumbnail${count > 1 ? "s" : ""}`,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate thumbnails" },
      { status: 500 }
    );
  }
}
