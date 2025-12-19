import { OpenAI } from "openai";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { google } from "googleapis";
import { supabase } from "@/lib/supabase";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session as any).accessToken) {
      return NextResponse.json({ hasAlert: false });
    }

    const { user } = session;
    const userEmail = user?.email;
    if (!userEmail) return NextResponse.json({ hasAlert: false });

    // 1. Setup Google Client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: (session as any).accessToken });
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // 2. Scan Calendar for events starting in the next 20 minutes
    const now = new Date();
    const twentyMinsFromNow = new Date(now.getTime() + 20 * 60000);

    const calEvents = await calendar.events.list({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: twentyMinsFromNow.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    const items = calEvents.data.items || [];
    if (items.length === 0) {
      return NextResponse.json({ hasAlert: false });
    }

    // 3. Deduplication: Check if we already notified about the first upcoming item
    const firstEvent = items[0];
    const eventId = firstEvent.id || firstEvent.summary || "unknown";

    const { data: existingAlert } = await supabase
      .from('proactive_alerts')
      .select('id')
      .eq('user_email', userEmail)
      .eq('event_id', eventId)
      .single();

    if (existingAlert) {
      return NextResponse.json({ hasAlert: false });
    }

    // 4. Generate J.A.R.V.I.S opening line
    const eventTime = new Date(firstEvent.start?.dateTime || firstEvent.start?.date || "").toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    const prompt = `
    Você é J.A.R.V.I.S. (Organizer). 
    O Senhor tem um compromisso urgente: "${firstEvent.summary}" às ${eventTime}.
    Crie uma linha de abertura CURTA (máx 15 palavras), sarcástica e leal em Português para avisar o Senhor proativamente. 
    Lembre-se: Você está interrompendo o silêncio dele para ajudar.
    Refira-se a ele como "Senhor".
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: prompt }],
      temperature: 0.8,
    });

    const openingLine = completion.choices[0].message.content || `Senhor, notei que "${firstEvent.summary}" começa em breve.`;

    // 5. Mark as notified
    await supabase.from('proactive_alerts').insert({
      user_email: userEmail,
      event_id: eventId,
      alert_type: 'calendar'
    });

    return NextResponse.json({
      hasAlert: true,
      openingLine,
      eventSummary: firstEvent.summary
    });

  } catch (error) {
    console.error("Proactive Check Error:", error);
    return NextResponse.json({ hasAlert: false });
  }
}
