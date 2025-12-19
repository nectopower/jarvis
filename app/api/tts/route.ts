import { NextResponse } from "next/server";
import OpenAI from "openai";
import { forceLoadEnv } from "@/lib/force-env";

forceLoadEnv();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.openai.com/v1", // MUST be official OpenAI for speech
});

console.log("[TTS] API Key prefix in use:", process.env.OPENAI_API_KEY?.substring(0, 10));

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    console.log("[TTS] Request received for text:", text?.substring(0, 50) + "...");

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: (process.env.OPENAI_VOICE as any) || "onyx",
      input: text,
    });

    console.log("[TTS] Audio generated successfully");
    const buffer = Buffer.from(await mp3.arrayBuffer());

    return new Response(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error: any) {
    console.error("Detailed TTS Error:", {
      message: error.message,
      status: error.status,
      name: error.name,
      stack: error.stack,
    });
    return NextResponse.json({ error: error.message, details: error }, { status: 500 });
  }
}
