"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Mic, Plane, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { VoyagerDemo } from "@/components/VoyagerDemo";
import { signIn, signOut, useSession } from "next-auth/react";

export default function Home() {
  const [isDemoActive, setIsDemoActive] = useState(false);
  const { data: session } = useSession();

  return (
    <main className="flex min-h-screen flex-col items-center justify-between overflow-hidden bg-background">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-secondary/10 blur-[120px]" />
      </div>

      {/* Navbar */}
      <nav className="w-full max-w-7xl mx-auto px-6 py-6 flex justify-between items-center relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <Plane className="text-white w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight">Organizer</span>
        </div>
        {session ? (
            <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-muted-foreground">
                    Hello, {session.user?.name?.split(" ")[0]}
                </span>
                <button 
                    onClick={() => signOut()}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                    Log out
                </button>
            </div>
        ) : (
            <button 
                onClick={() => signIn("google")}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
                Log in
            </button>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 w-full max-w-5xl mx-auto px-6 pt-16 pb-24 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50 border border-border mb-8 backdrop-blur-sm"
        >
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            Seu Assistente Executivo de Elite com IA
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-muted-foreground/70"
        >
          Organize sua vida <br /> na velocidade da voz.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-12"
        >
          Gerencie sua Agenda, E-mails, Tarefas e Documentos em tempo real.
          O Organizer trabalha enquanto você fala.
        </motion.p>

        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
        >
            {session ? (
                <button
                  onClick={() => setIsDemoActive(true)}
                  className="group relative inline-flex h-14 items-center gap-3 overflow-hidden rounded-full bg-foreground px-8 font-medium text-background transition-all hover:bg-foreground/90 hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]"
                >
                  <Mic className="w-5 h-5 transition-transform group-hover:scale-110" />
                  <span className="text-lg">Ativar Assistente</span>
                  <div className="absolute inset-0 -z-10 translate-x-[-100%] group-hover:translate-x-[100%] bg-gradient-to-r from-transparent via-black/10 to-transparent transition-transform duration-1000" />
                </button>
            ) : (
                 <button
                  onClick={() => signIn("google")}
                  className="group relative inline-flex h-14 items-center gap-3 overflow-hidden rounded-full bg-muted/20 border border-muted-foreground/30 px-8 font-medium text-muted-foreground transition-all hover:bg-muted/30 hover:text-foreground hover:border-foreground/50"
                >
                  <span className="text-lg">Faça Login para Ativar</span>
                </button>
            )}
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 w-full max-w-6xl mx-auto px-6 pb-24 grid md:grid-cols-2 gap-8">
        <motion.div
           initial={{ opacity: 0, x: -20 }}
           animate={{ opacity: 1, x: 0 }}
           transition={{ delay: 0.8 }}
           className="p-8 rounded-3xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
        >
            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center mb-6">
                <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-2xl font-bold mb-3">O Estrategista</h3>
            <p className="text-muted-foreground">
                Para planejamento e trabalho profundo. Redija documentos, organize sua semana e priorize sua caixa de entrada.
            </p>
            <div className="mt-6 p-4 rounded-xl bg-background/50 border border-border/50 text-sm italic text-muted-foreground">
                "Vamos redigir uma proposta no Docs sobre as metas do Q4."
            </div>
        </motion.div>

        <motion.div
           initial={{ opacity: 0, x: 20 }}
           animate={{ opacity: 1, x: 0 }}
           transition={{ delay: 1.0 }}
           className="p-8 rounded-3xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
        >
             <div className="w-12 h-12 rounded-2xl bg-destructive/20 flex items-center justify-center mb-6">
                <ShieldCheck className="w-6 h-6 text-destructive" />
            </div>
            <h3 className="text-2xl font-bold mb-3">O Executor</h3>
            <p className="text-muted-foreground">
                Para execução e velocidade. Envie e-mails, agende reuniões e crie tarefas instantaneamente.
            </p>
             <div className="mt-6 p-4 rounded-xl bg-background/50 border border-border/50 text-sm italic text-muted-foreground">
                "Envie um e-mail para o João sobre a reunião e adicione às Tarefas."
            </div>
        </motion.div>
      </section>

        {/* Demo Modal / Overlay */}
        <AnimatePresence>
          {isDemoActive && (
             <VoyagerDemo onEndCall={() => setIsDemoActive(false)} />
          )}
        </AnimatePresence>

    </main>
  );
}
