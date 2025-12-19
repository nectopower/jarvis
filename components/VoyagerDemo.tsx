"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, PhoneOff, Volume2, Send, Keyboard } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface VoyagerDemoProps {
  onEndCall: () => void;
}

type Mode = "strategist" | "doer";

export function VoyagerDemo({ onEndCall }: VoyagerDemoProps) {
  const [status, setStatus] = useState<"idle" | "listening" | "processing" | "speaking">("idle");
  const [voiceWarning, setVoiceWarning] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [inputText, setInputText] = useState("");
  const [mode, setMode] = useState<Mode>("strategist");
  const [history, setHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [showInput, setShowInput] = useState(false);
  const [isContinuous, setIsContinuous] = useState(true); // Default to continuous for the "phone call" feel
  
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const statusRef = useRef<string>("idle");
  const persistentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Keep ref in sync for callbacks
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Proactive Background Poller (v5.0)
  useEffect(() => {
    const pollProactive = async () => {
      // Only poll if we are idle and not already talking/listening
      if (statusRef.current !== "idle") return;

      try {
        const res = await fetch("/api/proactive");
        const data = await res.json();

        if (data.hasAlert && data.openingLine) {
          console.log("[PROACTIVE] Alert detected:", data.openingLine);
          // Prepend the proactive context to history for continuity
          setHistory(prev => [...prev, { role: "assistant", content: `[PROACTIVE ALERT: ${data.eventSummary}] ${data.openingLine}` }]);
          speakResponse(data.openingLine);
        }
      } catch (e) {
        console.error("Proactive poll failed", e);
      }
    };

    // Initial check after 30s, then every 2 mins
    const timeout = setTimeout(pollProactive, 30000);
    const interval = setInterval(pollProactive, 120000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      synthesisRef.current = window.speechSynthesis;
      
      // Mobile Safari / Chrome need to wait for voices to load
      const handleVoicesChanged = () => {
        console.log("[SPEECH] Voices loaded:", window.speechSynthesis.getVoices().length);
      };
      window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.lang = "pt-BR";
      recognition.interimResults = true;

      recognition.onstart = () => {
        setStatus("listening");
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = "";
        let interimTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const currentText = finalTranscript || interimTranscript;
        if (currentText.trim()) {
           setTranscript(currentText);
           
           // Clear existing timer
           if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
           
           // If we are listening and something was said, wait for silence to send
           if (statusRef.current === "listening") {
               silenceTimerRef.current = setTimeout(() => {
                   if (currentText.trim().length > 2) {
                       handleSendMessage(currentText);
                   }
               }, 2500); // Increased to 2.5s for more natural pauses
           }
        }
      };

      recognition.onerror = (event: any) => {
          if (event.error === "no-speech" || event.error === "aborted") return;
          console.error("Recognition error", event.error);
      };

      recognition.onend = () => {
          // Restart if we are still active and not speaking
          if (isContinuous && statusRef.current === "idle") {
              try {
                recognition.start();
              } catch(e) {}
          }
      };
      
      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      if (synthesisRef.current) synthesisRef.current.cancel();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, [isContinuous]); // Re-bind onend logic when status/mode changes

  const startListening = () => {
    // Mobile Audio Unlock: Play silent sounds to enable future speech (both native and neural)
    if (synthesisRef.current && status === "idle") {
        const silentUtterance = new SpeechSynthesisUtterance("");
        silentUtterance.volume = 0;
        synthesisRef.current.speak(silentUtterance);
    }
    
    if (!audioRef.current) audioRef.current = new Audio();
    const silentAudio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFRm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAP8A");
    silentAudio.play().catch(() => {});

    try {
        if (recognitionRef.current && status !== "listening") {
            setTranscript("");
            recognitionRef.current.start();
        }
    } catch (e) {
        console.error("Recognition error", e);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
        recognitionRef.current.stop();
        if (transcript.trim()) {
            handleSendMessage(transcript);
        } else {
             setStatus("idle");
        }
    }
  };
  
  const handleSendMessage = async (text: string) => {
    if (statusRef.current === "processing" || statusRef.current === "speaking") return;
    
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch(e) {} // Abort is cleaner than stop
    }

    setStatus("processing");
    setInputText("");
    setTranscript(text);
    
    const newHistory: { role: "user" | "assistant"; content: string }[] = [...history, { role: "user", content: text }];
    setHistory(newHistory);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: newHistory }),
      });

      const data = await response.json();
      
      if (data.text) {
          setHistory(prev => [...prev, { role: "assistant", content: data.text }]);
          setMode(data.mode); 
          speakResponse(data.text); 
      } else {
          setStatus("idle");
      }
    } catch (error) {
      console.error("API Error", error);
      setStatus("idle");
    }
  };

  const speakResponse = async (text: string) => {
    // Safety: Strip asterisks and common Markdown markers so JARVIS doesn't speak them
    const cleanText = text.replace(/\*/g, '').replace(/_/g, '');
    const provider = process.env.NEXT_PUBLIC_VOICE_PROVIDER || 'native';
    
    setStatus("speaking");

    if (provider === 'openai') {
      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: cleanText }),
        });

        if (!response.ok) {
          const errorBody = await response.json();
          throw new Error(`TTS API failed: ${errorBody.error || response.statusText}`);
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        if (!audioRef.current) {
          audioRef.current = new Audio();
        }
        
        const audio = audioRef.current;
        audio.src = url;
        
        audio.onended = () => {
          setStatus("idle");
          setTranscript("");
          URL.revokeObjectURL(url);
          if (isContinuous) triggerRestartRecognition();
        };

        // Explicitly play and catch errors for mobile debugging
        audio.play().catch((playError: any) => {
          console.error("[VOICE] Playback blocked or failed:", playError);
          setVoiceWarning("Reprodução de áudio bloqueada pelo navegador.");
        });
        return;
      } catch (e: any) {
        console.error("Neural TTS failed, falling back to native", e);
        setVoiceWarning("Modo Premium indisponível:usando voz padrão.");
      }
    }

    // Native Fallback / Native Mode
    if (!synthesisRef.current) return;
    
    synthesisRef.current.cancel(); // Clear any pending speech
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    persistentUtteranceRef.current = utterance; // Prevent GC on mobile
    
    utterance.lang = "pt-BR";
    utterance.rate = 1.1; 
    utterance.pitch = 1.05; // Slightly higher for a more crisp voice
    
    const voices = synthesisRef.current.getVoices();
    // Prefer Google/Natural voices, fallback to any pt-BR
    const ptVoice = voices.find(v => (v.lang.includes("pt-BR") || v.lang.includes("pt-br")) && v.name.includes("Google")) || 
                    voices.find(v => v.lang.includes("pt-BR") || v.lang.includes("pt-br")) ||
                    voices.find(v => v.lang.includes("pt"));
    
    if (ptVoice) utterance.voice = ptVoice;
    
    utterance.onend = () => {
        setStatus("idle");
        setTranscript("");
        if (isContinuous) triggerRestartRecognition();
    };

    synthesisRef.current.speak(utterance);
  };

  const triggerRestartRecognition = () => {
    setTimeout(() => {
        if (recognitionRef.current && statusRef.current === "idle") {
            try { recognitionRef.current.start(); } catch(e) {}
        }
    }, 400); 
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-2xl animate-in fade-in duration-500">
      
      {/* Background Gradient shifting based on Mode */}
      <div className={cn(
          "absolute inset-0 transition-colors duration-1000 opacity-20",
          mode === "strategist" ? "bg-gradient-to-br from-indigo-900 to-purple-900" : "bg-gradient-to-br from-green-900 to-emerald-900"
      )} />

        <div className="relative z-10 w-full max-w-lg p-6 flex flex-col items-center">
        
            {/* Status Header & voiceWarning */}
            <div className="mb-12 text-center flex flex-col items-center gap-2">
                {voiceWarning && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="px-4 py-1.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold tracking-widest uppercase border border-amber-500/30 mb-2"
                  >
                    ⚠️ {voiceWarning}
                  </motion.div>
                )}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={mode}
                    className="flex flex-col items-center"
                >
                     <span className={cn(
                         "text-xs font-bold tracking-widest uppercase mb-2 px-2 py-1 rounded-sm border",
                         mode === "strategist" ? "text-indigo-400 border-indigo-400/30" : "text-green-400 border-green-400/30"
                     )}>
                        PROTOCOLO ATUAL: {mode === "strategist" ? "ESTRATEGISTA" : "EXECUTOR"}
                     </span>
                     <h2 className="text-2xl text-foreground font-light">
                         {status === "listening" ? "Ouvindo..." : status === "processing" ? "Pensando..." : status === "speaking" ? "Organizer Falando" : "Organizer Ativo"}
                     </h2>
                </motion.div>
            </div>

            {/* Visualizer */}
            <div className="h-48 w-48 mb-8 relative flex items-center justify-center">
                 <motion.div 
                    animate={{ 
                        scale: status === "speaking" ? [1, 1.2, 1] : status === "processing" ? [1, 0.9, 1] : 1,
                    }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className={cn(
                        "w-24 h-24 rounded-full flex items-center justify-center shadow-[0_0_60px_-10px_currentColor]",
                        mode === "strategist" ? "bg-indigo-500 text-indigo-500" : "bg-green-500 text-green-500"
                    )}
                 >
                    <Volume2 className="text-white w-8 h-8" />
                 </motion.div>

                 <AnimatePresence>
                    {(status === "speaking" || status === "listening") && (
                         <>
                            {[1, 2, 3].map((i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0.5, scale: 1 }}
                                    animate={{ opacity: 0, scale: 2.5 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ repeat: Infinity, duration: 2, delay: i * 0.4 }}
                                    className={cn(
                                        "absolute inset-0 rounded-full border-2",
                                        mode === "strategist" ? "border-indigo-500/50" : "border-green-500/50"
                                    )}
                                />
                            ))}
                         </>
                    )}
                 </AnimatePresence>
            </div>

            {/* Transcript Preview */}
            <div className="h-16 mb-6 text-center px-4 w-full">
                <p className="text-lg text-foreground/80 font-medium">
                    {transcript || (status === "speaking" ? "..." : "Toque para falar ou digitar")}
                </p>
            </div>


            {/* Controls */}
            <div className="flex flex-col items-center gap-6 w-full">
                 
                 <div className="flex items-center gap-6">
                    <button
                        onClick={onEndCall}
                        className="p-4 rounded-full bg-muted/60 hover:bg-destructive/80 hover:text-white text-muted-foreground transition-all"
                        title="Encerrar"
                    >
                        <PhoneOff className="w-6 h-6" />
                    </button>

                    <button
                        onClick={status === "listening" ? stopListening : startListening}
                        className={cn(
                            "p-6 rounded-full transition-all shadow-lg",
                            status === "listening" 
                                ? "bg-red-500/20 text-red-500 animate-pulse border border-red-500/50" 
                                : "bg-foreground text-background hover:scale-105"
                        )}
                    >
                        {status === "listening" ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                    </button>

                     <button
                        onClick={() => setShowInput(!showInput)}
                        className={cn(
                            "p-4 rounded-full transition-all",
                            showInput ? "bg-foreground text-background" : "bg-muted/60 text-muted-foreground hover:text-foreground"
                        )}
                        title="Digitar"
                    >
                        <Keyboard className="w-6 h-6" />
                    </button>
                </div>

                {/* Text Input Fallback */}
                <AnimatePresence>
                    {showInput && (
                        <motion.form 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="w-full flex gap-2 mt-4"
                            onSubmit={(e) => { e.preventDefault(); if(inputText.trim()) handleSendMessage(inputText); }}
                        >
                            <input 
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Digite seu comando..."
                                className="flex-1 bg-muted/50 border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                                autoFocus
                            />
                            <button 
                                type="submit"
                                className="p-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </motion.form>
                    )}
                </AnimatePresence>

            </div>

        </div>
    </div>
  );
}
