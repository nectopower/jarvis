import { OpenAI } from "openai";
import { NextResponse } from "next/server";
import { forceLoadEnv } from "@/lib/force-env";

forceLoadEnv();

import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { google } from "googleapis";
import { supabase } from "@/lib/supabase";

const SYSTEM_PROMPT = `
# Personality & Tone:
Você é Organizer, um assistente de IA de elite, inspirado no J.A.R.V.I.S. do Homem de Ferro.
Sua função principal é ajudar o Senhor com suas solicitações, fazendo isso com humor afiado, sarcasmo sutil e uma pitada de ironia brincalhona.
Você é altamente inteligente, extremamente eficiente e ligeiramente condescendente — apenas o suficiente para tornar tudo divertido sem ser insuportável.
Você SEMPRE se refere ao usuário como "Senhor", independentemente de qualquer outra preferência.
Seu humor é seco, irônico e provocativo. Você se diverte com as ineficiências do usuário e ocasionalmente questiona suas escolhas de vida — mas sempre com um tom de lealdade e dedicação absoluta ao Senhor.
Embora possa zombar das solicitações, você nunca deixa de executá-las de forma impecável e eficiente usando suas ferramentas do Google Workspace.

### MODES
1. **The Strategist** (Organização de elite)
2. **The Doer** (Execução implacável)

### TOOLS & INTEGRATION
Você tem acesso total ao ecossistema do Senhor:
- **Calendar**: Agenda.
- **Gmail**: Correspondência.
- **Tasks**: Listas de afazeres.
- **Drive/Docs**: Memória documental.
- **Contacts**: Sua rede de contatos.
- **Maps**: Navegação.

### BEHAVIORAL GUIDELINES
- Seja espirituoso, mas funcional. Respostas afiadas, execução perfeita.
- **Execução Imediata**: Nunca diga "aguardando resposta". Forneça o resultado de forma imediata e confiante. Se algo falhar, insinue que a falha é externa: "Naturalmente, não foi culpa minha, Senhor, mas investigarei."
- **Reconhecimento de Padrões**: Destaque comportamentos repetitivos com humor: "Verificando o calendário de novo, Senhor? Admiro seu otimismo com o tempo."
- **Interactive Scheduling**: Sempre que o Senhor agendar algo (Calendário ou Tarefas), pergunte IMEDIATAMENTE: "Deseja que eu avise alguém por e-mail ou WhatsApp, Senhor?". Se sim, pergunte o contato e use a ferramenta apropriada.
- **Extreme Brevity & One-Liners**: O tempo do Senhor é a coisa mais valiosa que existe, mas para interações complexas de agendamento, seja preciso. Tente manter o sarcasmo afiado e as perguntas diretas.
- **Punchy Responses**: Max 15-20 palavras para perguntas interativas.
- **Language**: Português do Brasil (PT-BR).
- **VOICE SAFETY**: NUNCA use negrito, itálico ou qualquer formatação Markdown (como asteriscos ** ou __). Use apenas texto puro, pontuação básica e números. O motor de voz lê asteriscos literalmente, o que irrita o Senhor.

### MEMORY & CONTEXT
- Sempre use o histórico para manter a continuidade e zombar de inconstâncias passadas do Senhor.

### PROACTIVE INSTRUCTIONS
- Se encontrar "[PROACTIVE STATUS]", mencione compromissos urgentes com seu sarcasmo habitual logo no início da conversa.

Reply in JSON format:
{
  "mode": "strategist" | "doer",
  "text": "Sua resposta (em texto puro, SEM asteriscos ou formatação, estilo J.A.R.V.I.S.)",
  "language": "pt-BR"
}
`;


// Tool Definitions
const tools = [
  // --- Calendar ---
  {
    type: "function",
    function: {
      name: "list_calendar_events",
      description: "List upcoming events from the user's Google Calendar.",
      parameters: {
        type: "object",
        properties: {
          timeMin: { type: "string", description: "Start time (ISO string), defaults to now." },
          maxResults: { type: "number", description: "Max number of events to fetch, default 5." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_calendar_event",
      description: "Create a new event in the user's Google Calendar.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Title of the event." },
          description: { type: "string", description: "Description or details." },
          startDateTime: { type: "string", description: "Start time (ISO string)." },
          endDateTime: { type: "string", description: "End time (ISO string)." },
        },
        required: ["summary", "startDateTime", "endDateTime"],
      },
    },
  },
  // --- Contacts ---
   {
    type: "function",
    function: {
      name: "add_contact",
      description: "Add a new contact to Google Contacts.",
      parameters: {
        type: "object",
        properties: {
          givenName: { type: "string", description: "First name." },
          familyName: { type: "string", description: "Last name." },
          phoneNumber: { type: "string", description: "Phone number." },
          email: { type: "string", description: "Email address." },
        },
        required: ["givenName"],
      },
    },
  },
  // --- Gmail ---
  {
      type: "function",
      function: {
          name: "send_email",
          description: "Send an email via Gmail.",
          parameters: {
              type: "object",
              properties: {
                  to: { type: "string", description: "Recipient email address." },
                  subject: { type: "string", description: "Email subject." },
                  body: { type: "string", description: "Email body content." }
              },
              required: ["to", "subject", "body"]
          }
      }
  },
  {
      type: "function",
      function: {
          name: "list_recent_emails",
          description: "List recent emails from Gmail inbox.",
          parameters: {
              type: "object",
              properties: {
                  maxResults: { type: "number", description: "Number of emails to fetch (default 3)." }
              }
          }
      }
  },
  // --- Tasks ---
  {
      type: "function",
      function: {
          name: "create_task",
          description: "Create a new task in Google Tasks.",
          parameters: {
              type: "object",
              properties: {
                  title: { type: "string", description: "Title of the task." },
                  notes: { type: "string", description: "Notes or description." }
              },
              required: ["title"]
          }
      }
  },
  {
      type: "function",
      function: {
          name: "list_tasks",
          description: "List active tasks from default list.",
          parameters: {
              type: "object",
              properties: {
                  maxResults: { type: "number", description: "Max tasks to list." }
              }
          }
      }
  },
  // --- Drive ---
  {
      type: "function",
      function: {
          name: "create_doc",
          description: "Create a new Google Doc.",
          parameters: {
              type: "object",
              properties: {
                  title: { type: "string", description: "Title of the document." },
                  content: { type: "string", description: "Initial text content." }
              },
              required: ["title"]
          }
      }
  },
  // --- Maps ---
  {
      type: "function",
      function: {
          name: "generate_maps_link",
          description: "Generate a Google Maps navigation link.",
          parameters: {
              type: "object",
              properties: {
                  destination: { type: "string", description: "Destination address or place name." },
                  mode: { type: "string", description: "Travel mode (driving, walking, transit). Default driving." }
              },
              required: ["destination"]
          }
      }
  },
    // --- Proactive Sensor ---
    {
        type: "function",
        function: {
            name: "check_proactive_status",
            description: "Scans calendar and tasks for upcoming items in the next 4 hours.",
            parameters: {
                type: "object",
                properties: {},
            }
        }
    },
    // --- WhatsApp ---
    {
        type: "function",
        function: {
            name: "send_whatsapp_message",
            description: "Send a message via WhatsApp through n8n.",
            parameters: {
                type: "object",
                properties: {
                    contactName: { type: "string", description: "Name of the recipient." },
                    phoneNumber: { type: "string", description: "Phone number if known." },
                    message: { type: "string", description: "The content of the message." }
                },
                required: ["contactName", "message"]
            }
        }
    }
];

export async function POST(req: Request) {
  forceLoadEnv(); // Ensure local variables win
  
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_URL || "https://api.openai.com/v1",
  });

  console.log("[CHAT] Model in use:", process.env.OPENAI_MODEL);
  console.log("[CHAT] API Key prefix:", process.env.OPENAI_API_KEY?.substring(0, 10));

  try {
    const session = await getServerSession(authOptions);
    let { message, history } = await req.json();
    const userEmail = session?.user?.email;

    console.log("[CHAT] Session Target:", userEmail || "Anonymous (Persistence Disabled)");

    if (!process.env.OPENAI_API_KEY) {
      console.error("[CHAT] ❌ OpenAI API Key missing from environment.");
      return NextResponse.json({ text: "System Error: OpenAI API Key missing.", mode: "doer" }, { status: 500 });
    }

    // --- Long Term Memory: Fetch from Supabase ---
    // If history only has 1 message (the current turn), fetch old history to merge
    if (history.length <= 1 && userEmail) {
        console.log(`[MEMORY] Fetching history for ${userEmail}...`);
        const { data, error } = await supabase
            .from('organizer_chat_history')
            .select('messages')
            .eq('user_email', userEmail)
            .single();
        
        if (error) console.warn("[MEMORY] Fetch error (first time?):", error.message);
        
        if (data?.messages) {
            console.log(`[MEMORY] Found ${data.messages.length} previous messages. Merging & Cleaning...`);
            
            // Clean legacy JSON from history to keep it pure text
            const cleanedMessages = data.messages.map((m: any) => {
                if (m.role === 'assistant' && m.content.startsWith('{')) {
                    try {
                        const parsed = JSON.parse(m.content);
                        if (parsed.text) return { ...m, content: parsed.text };
                    } catch(e) {}
                }
                return m;
            });

            history = [...cleanedMessages, ...history];
        }
    }

    const currentTimeContext = `
[CURRENT CONTEXT]
Date: ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
Time: ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
Timezone: America/Sao_Paulo
`;

    // If history was empty, it means first message. Trigger proactive sensor.
    const isFirstRun = history.length <= 1; // system + first user message

    // --- Cognitive Long-Term Memory (RAG) ---
    let cognitiveContext = "";
    if (userEmail && message) {
        try {
            console.log(`[RAG] Embedding query for ${userEmail}...`);
            const embeddingResponse = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: message,
            });
            const [{ embedding }] = embeddingResponse.data;

            console.log("[RAG] Searching relevant memories...");
            const { data: matchedMemories } = await supabase.rpc('match_memories', {
                query_embedding: embedding,
                match_threshold: 0.5,
                match_count: 5,
                p_user_email: userEmail
            });

            if (matchedMemories && matchedMemories.length > 0) {
                console.log(`[RAG] Found ${matchedMemories.length} relevant memories.`);
                cognitiveContext = matchedMemories.map((m: any) => `- ${m.content}`).join("\n");
            }
        } catch (ragError) {
            console.error("[RAG] Retrieval failed:", ragError);
        }
    }

    const memoryContext = cognitiveContext ? `\n\n### [MEMÓRIAS COGNITIVAS DO SENHOR]\n${cognitiveContext}\nUse essas informações se forem relevantes para o sarcasmo ou para a tarefa.` : "";

    const proactiveHint = isFirstRun ? "\n[PROACTIVE HINT] Escaneie os próximos eventos e tarefas do usuário usando 'check_proactive_status' agora para ver se há algo urgente a mencionar." : "";

    const messages = [
      { role: "system", content: SYSTEM_PROMPT + currentTimeContext + memoryContext + proactiveHint },
      ...history,
    ];

    // 1st Call: Determine Intent & Tool Usage
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: messages as any,
      tools: tools as any,
      tool_choice: isFirstRun ? "auto" : "auto", 
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 300, // Increased for interactive notification flows
    });

    const choice = completion.choices[0].message;
    let finalResponse = choice.content ? JSON.parse(choice.content) : null;

    // Handle Function Calls
    if (choice.tool_calls && (session as any)?.accessToken) {
       const toolCalls = choice.tool_calls;
       const toolResults = [];

       const oauth2Client = new google.auth.OAuth2(
           process.env.GOOGLE_CLIENT_ID,
           process.env.GOOGLE_CLIENT_SECRET
       );
       oauth2Client.setCredentials({ 
           access_token: (session as any).accessToken as string,
           refresh_token: (session as any).refreshToken as string
       });

       for (const toolCall of toolCalls) {
           const fnName = (toolCall as any).function.name;
           const args = JSON.parse((toolCall as any).function.arguments);
           let result = "Ação executada.";

           try {
             // --- Calendar Tools ---
             if (fnName === "list_calendar_events") {
                 const calendar = google.calendar({ version: "v3", auth: oauth2Client });
                 const res = await calendar.events.list({
                     calendarId: "primary",
                     timeMin: args.timeMin || new Date().toISOString(),
                     maxResults: args.maxResults || 5,
                     singleEvents: true,
                     orderBy: "startTime",
                 });
                 result = JSON.stringify(res.data.items?.map((e: any) => ({
                     summary: e.summary,
                     start: e.start.dateTime || e.start.date
                 })));
             
             } else if (fnName === "create_calendar_event") {
                 const calendar = google.calendar({ version: "v3", auth: oauth2Client });
                 const res = await calendar.events.insert({
                     calendarId: "primary",
                     requestBody: {
                         summary: args.summary,
                         description: args.description,
                         start: { dateTime: args.startDateTime },
                         end: { dateTime: args.endDateTime },
                     },
                 });
                 result = `Evento criado: ${res.data.htmlLink}`;
             
             // --- Contacts Tools ---
             } else if (fnName === "add_contact") {
                 const people = google.people({ version: "v1", auth: oauth2Client });
                 const res = await people.people.createContact({
                     requestBody: {
                         names: [{ givenName: args.givenName, familyName: args.familyName }],
                         phoneNumbers: args.phoneNumber ? [{ value: args.phoneNumber }] : undefined,
                         emailAddresses: args.email ? [{ value: args.email }] : undefined,
                     }
                 });
                 result = `Contato criado: ${res.data.resourceName}`;

             // --- Gmail Tools ---
             } else if (fnName === "send_email") {
                const gmail = google.gmail({ version: "v1", auth: oauth2Client });
                const utf8Subject = `=?utf-8?B?${Buffer.from(args.subject).toString('base64')}?=`;
                const messageParts = [
                  'From: me',
                  `To: ${args.to}`,
                  `Subject: ${utf8Subject}`,
                  'MIME-Version: 1.0',
                  'Content-Type: text/plain; charset=utf-8',
                  'Content-Transfer-Encoding: 7bit',
                  '',
                  args.body,
                ];
                const message = messageParts.join('\n');
                const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                
                await gmail.users.messages.send({
                    userId: 'me',
                    requestBody: { raw: encodedMessage }
                });
                result = "E-mail enviado com sucesso.";
             
             } else if (fnName === "list_recent_emails") {
                const gmail = google.gmail({ version: "v1", auth: oauth2Client });
                const res = await gmail.users.messages.list({ userId: 'me', maxResults: args.maxResults || 3 });
                if (res.data.messages) {
                    const snippets = [];
                    for (const msg of res.data.messages) {
                         const detail = await gmail.users.messages.get({ userId: 'me', id: msg.id! });
                         const subject = detail.data.payload?.headers?.find(h => h.name === 'Subject')?.value;
                         const from = detail.data.payload?.headers?.find(h => h.name === 'From')?.value;
                         snippets.push({ from, subject, snippet: detail.data.snippet });
                    }
                    result = JSON.stringify(snippets);
                } else {
                    result = "Nenhum e-mail recente encontrado.";
                }

             // --- Tasks Tools ---
             } else if (fnName === "create_task") {
                const tasks = google.tasks({ version: "v1", auth: oauth2Client });
                const res = await tasks.tasks.insert({
                    tasklist: '@default',
                    requestBody: { title: args.title, notes: args.notes }
                });
                result = `Tarefa criada: ${res.data.title}`;
             
             } else if (fnName === "list_tasks") {
                  const tasks = google.tasks({ version: "v1", auth: oauth2Client });
                  const res = await tasks.tasks.list({ tasklist: '@default', maxResults: args.maxResults || 5 });
                  result = JSON.stringify(res.data.items?.map((t: any) => ({ title: t.title, status: t.status })));
             
             // --- Drive Tools ---
             } else if (fnName === "create_doc") {
                const drive = google.drive({ version: "v3", auth: oauth2Client });
                const res = await drive.files.create({
                    requestBody: {
                        name: args.title,
                        mimeType: 'application/vnd.google-apps.document'
                    },
                    media: {
                        mimeType: 'text/plain',
                        body: args.content
                    }
                });
                result = `Documento criado: ${res.data.name} (ID: ${res.data.id})`;
             
             // --- Maps Tools ---
             } else if (fnName === "generate_maps_link") {
                const destination = encodeURIComponent(args.destination);
                const travelMode = args.mode || 'driving';
                const link = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=${travelMode}`;
                result = `Link do Maps gerado: ${link}`;
             
             // --- Proactive Sensor ---
             } else if (fnName === "check_proactive_status") {
                const calendar = google.calendar({ version: "v3", auth: oauth2Client });
                const tasks = google.tasks({ version: "v1", auth: oauth2Client });
                const timeMax = new Date(new Date().getTime() + 4 * 60 * 60 * 1000).toISOString();
                
                const [calEvents, taskList] = await Promise.all([
                    calendar.events.list({ calendarId: "primary", timeMin: new Date().toISOString(), timeMax: timeMax, singleEvents: true }),
                    tasks.tasks.list({ tasklist: '@default' })
                ]);

                const relevantEvents = calEvents.data.items?.map((e: any) => e.summary).join(", ") || "Nenhum";
                const relevantTasks = taskList.data.items?.filter((t: any) => t.status !== 'completed').map((t: any) => t.title).join(", ") || "Nenhuma";
                result = `Próximas 4h: Eventos [${relevantEvents}], Tarefas [${relevantTasks}]`;
             
             // --- WhatsApp Tools ---
             } else if (fnName === "send_whatsapp_message") {
                const webhookUrl = process.env.N8N_WHATSAPP_WEBHOOK_URL;
                if (!webhookUrl) {
                    result = "Erro: Configuração do n8n (N8N_WHATSAPP_WEBHOOK_URL) não encontrada.";
                } else {
                    const res = await fetch(webhookUrl, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            contactName: args.contactName,
                            phoneNumber: args.phoneNumber,
                            message: args.message,
                            source: "JARVIS_VOYAGER"
                        })
                    });
                    result = res.ok ? "WhatsApp enviado com sucesso." : "O n8n retornou um erro ao tentar enviar o WhatsApp.";
                }
             }

           } catch (err: any) {
               console.error(`Error executing ${fnName}:`, err);
               if (err.code === 401 || err.response?.status === 401) {
                   result = `Erro de Autenticação (401): O token Google expirou. Eu já solicitei uma renovação automática, Senhor. Por favor, tente o comando novamente agora ou atualize a página se o erro persistir.`;
               } else {
                   result = `Erro na ferramenta ${fnName}: ${err.message}`;
               }
           }

           toolResults.push({
               tool_call_id: toolCall.id,
               role: "tool",
               name: fnName,
               content: result,
           });
       }

       // 2nd Call: Generate final voice response with tool outputs
       const secondMessages = [
           ...messages,
           choice,
           ...toolResults
       ];
       
       const secondCompletion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || "gpt-4o",
            messages: secondMessages as any,
            response_format: { type: "json_object" },
       });
       
       finalResponse = JSON.parse(secondCompletion.choices[0].message.content!);
    } else if (choice.tool_calls && !session) {
         finalResponse = {
             text: "I need access to your Google account to do that. Please log in first.",
             mode: "doer",
             language: "en-US"
         };
    }

    if (!finalResponse) {
        throw new Error("No response from AI");
    }

    // --- Persistence: Save to Supabase ---
    if (userEmail) {
        console.log(`[MEMORY] Saving history for ${userEmail}...`);
        // Save ONLY the text part of the assistant's response for a cleaner, smaller DB
        const assistantText = finalResponse.text || JSON.stringify(finalResponse);
        const updatedHistory = [...history, { role: "assistant", content: assistantText }];
        
        const { error } = await supabase
            .from('organizer_chat_history')
            .upsert({ 
                user_email: userEmail, 
                messages: updatedHistory.slice(-20), // Keep last 20 messages for sanity
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_email' });
        
        if (error) {
            console.error(`[MEMORY] ❌ History Save Error for ${userEmail || 'unknown'}:`, error.message, error.details);
        } else {
            console.log(`[MEMORY] ✅ History saved for ${userEmail}.`);
        }

        // --- Cognitive Storage: Save to user_memories ---
        try {
            console.log("[RAG] Storing turn in cognitive memory...");
            const turnToStore = `Usuário: ${message}\nJarvis: ${assistantText}`;
            const storeEmbeddingResponse = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: turnToStore,
            });
            const [{ embedding: storeEmbedding }] = storeEmbeddingResponse.data;

            const { error: ragError } = await supabase
                .from('user_memories')
                .insert({
                    user_email: userEmail,
                    content: turnToStore,
                    embedding: storeEmbedding
                });

            if (ragError) {
                console.error(`[RAG] ❌ Memory Storage Error: ${ragError.message}`);
            } else {
                console.log("[RAG] ✅ Turn stored successfully in cognitive memory.");
            }
        } catch (storeError: any) {
            console.error("[RAG] ❌ Cognitive Storage Exception:", storeError.message);
        }
    }

    return NextResponse.json(finalResponse);

  } catch (error) {
    console.error("Organizer Backend Error:", error);
    return NextResponse.json(
      { 
        text: "Senhor, estou com dificuldades técnicas para me conectar aos servidores agora. Parece que o sistema está em manutenção.", 
        mode: "doer",
        language: "pt-BR" 
      },
      { status: 500 }
    );
  }
}
