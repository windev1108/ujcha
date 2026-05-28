import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const TTS_URL = "https://viettelai.vn/tts/speech_synthesis";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
    if (!body.text || typeof body.text !== "string") {
      return new NextResponse("Missing text", { status: 400 });
    }
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const text = body.text as string;
  const speed = typeof body.speed === "number" ? body.speed : 1;
  const voice = typeof body.voice === "string" ? body.voice : "hcm-diemmy";
  const tts_return_option = typeof body.tts_return_option === "number" ? body.tts_return_option : 3;
  const without_filter = typeof body.without_filter === "boolean" ? body.without_filter : false;

  const payload: Record<string, unknown> = {
    speed,
    voice,
    text,
    tts_return_option,
    without_filter,
  };

  if (process.env.VIETTEL_TTS_TOKEN) {
    payload.token = process.env.VIETTEL_TTS_TOKEN;
  }

  try {
    const upstream = await fetch(TTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Connection": "keep-alive",
      },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok) {
      return new NextResponse("TTS upstream error", { status: 502 });
    }

    const audio = await upstream.arrayBuffer();
    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new NextResponse("TTS fetch failed", { status: 502 });
  }
}
