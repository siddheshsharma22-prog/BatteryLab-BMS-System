"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, X, Send, Loader2, Wand2, Trash2 } from "lucide-react";
import { useLabStore, extractApplyPatch } from "@/lib/lab/store";
import { cn } from "@/lib/utils";

export function Copilot() {
  const { copilotOpen, copilotMessages, copilotBusy, setCopilotOpen, sendCopilotMessage, clearCopilot, applyAiPatch, activeTab } = useLabStore();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [copilotMessages, copilotBusy]);

  const send = () => {
    if (!draft.trim() || copilotBusy) return;
    sendCopilotMessage(draft);
    setDraft("");
  };

  return (
    <>
      {/* Floating launcher — glow ping + lift on hover */}
      {!copilotOpen && (
        <button
          onClick={() => setCopilotOpen(true)}
          className="glow-ping fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-gradient-to-br from-primary to-cyan-700 text-white pl-3.5 pr-4 py-2.5 shadow-lg shadow-primary/30 transition-all duration-200 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 active:scale-95"
          aria-label="Open the AI copilot"
        >
          <Sparkles className="h-4 w-4 animate-float" />
          <span className="text-sm font-semibold">AI Copilot</span>
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
        </button>
      )}

      {/* Panel */}
      {copilotOpen && (
        <div className="animate-scale-in origin-bottom-right fixed bottom-5 right-5 z-50 w-[min(92vw,380px)] rounded-xl border bg-card shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b px-3.5 py-2.5 bg-muted/40">
            <Sparkles className="h-4 w-4 text-primary" />
            <div className="font-semibold text-sm">VoltAI Copilot</div>
            <span className="text-[10px] text-muted-foreground hidden sm:inline">· {activeTab}</span>
            <div className="ml-auto flex items-center gap-0.5">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={clearCopilot} aria-label="Clear conversation">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCopilotOpen(false)} aria-label="Close copilot">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div ref={scrollRef} className="h-80 overflow-y-auto px-3.5 py-3 space-y-3">
            {copilotMessages.length === 0 && (
              <div className="text-sm text-muted-foreground space-y-2 py-4">
                <p className="font-medium text-foreground">Hi — I&apos;m VoltAI. I can see your live design, pack, tests and results.</p>
                <p>Try: <em>&ldquo;Recommend a cell for a 48V 10Ah e-bike pack&rdquo;</em>, <em>&ldquo;Why did my last run overheat?&rdquo;</em> or <em>&ldquo;What C-rate should I use?&rdquo;</em></p>
              </div>
            )}
            {copilotMessages.map((m, i) => {
              const patch = m.role === "assistant" ? extractApplyPatch(m.content) : null;
              return (
                <div key={i} className={cn("flex animate-fade-up", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap",
                      m.role === "user" ? "bg-primary text-white" : "bg-muted"
                    )}
                  >
                    {patch ? patch.stripped : m.content}
                    {patch && (
                      <div className="mt-2">
                        <Button
                          size="sm"
                          className="h-7 bg-primary hover:bg-primary/90 text-white"
                          onClick={() => {
                            applyAiPatch(patch.patch);
                            setCopilotOpen(false);
                          }}
                        >
                          <Wand2 className="h-3 w-3 mr-1" /> Apply to design
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {copilotBusy && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
              </div>
            )}
          </div>

          <div className="border-t p-2.5 flex items-center gap-2">
            <Input
              className="h-9"
              placeholder="Ask about cells, packs, tests…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              aria-label="Message the copilot"
            />
            <Button size="icon" className="h-9 w-9 shrink-0 bg-primary hover:bg-primary/90" onClick={send} disabled={copilotBusy || !draft.trim()} aria-label="Send message">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
