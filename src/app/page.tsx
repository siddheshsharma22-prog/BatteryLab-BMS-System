"use client";

import { useEffect, useState } from "react";
import { Battery, BookOpen, Check } from "lucide-react";
import { useLabStore } from "@/lib/lab/store";
import { designIssues } from "@/lib/lab/engine";
import { DesignTab } from "@/components/lab/design-tab";
import { LibraryTab } from "@/components/lab/library-tab";
import { ConnectionTab } from "@/components/lab/connection-tab";
import { ModelTab } from "@/components/lab/model-tab";
import { SimulateTab } from "@/components/lab/simulate-tab";
import { ThermalTab } from "@/components/lab/thermal-tab";
import { MonitorTab } from "@/components/lab/monitor-tab";
import { AnalysisTab } from "@/components/lab/analysis-tab";
import { EngineeringTab } from "@/components/lab/engineering-tab";
import { Copilot } from "@/components/lab/copilot";
import { ThemeToggle } from "@/components/lab/theme-toggle";

const STEPS = [
  { id: "design", label: "Design" },
  { id: "connection", label: "Connection" },
  { id: "model", label: "Modeling" },
  { id: "simulate", label: "Simulation" },
  { id: "thermal", label: "Thermal" },
  { id: "monitor", label: "Monitor" },
  { id: "analysis", label: "Analysis" },
  { id: "engineering", label: "Engineering" },
];

export default function Home() {
  const activeTab = useLabStore((s) => s.activeTab);
  const setActiveTab = useLabStore((s) => s.setActiveTab);
  // Reading-progress hairline under the header — scroll depth 0..1
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  // Step completion — derived from live store state so checkmarks stay
  // truthful: design valid, schematic connected, step visited, run stored.
  // (Primitive selectors only — object selectors break useSyncExternalStore.)
  const done: Record<string, boolean> = {
    design: useLabStore((s) => designIssues(s.design).length === 0),
    connection: useLabStore((s) => s.build.stage === 3 && s.build.s === s.pack.series && s.build.p === s.pack.parallel),
    model: useLabStore((s) => s.visitedSteps.includes("model")),
    simulate: useLabStore((s) => s.lastResult !== null),
    thermal: useLabStore((s) => s.visitedSteps.includes("thermal")),
    monitor: useLabStore((s) => s.visitedSteps.includes("monitor")),
    analysis: useLabStore((s) => s.visitedSteps.includes("analysis")),
    engineering: useLabStore((s) => s.alternatives.length >= 2),
  };

  const navBtn = (active: boolean) =>
    `flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition-all duration-200 active:scale-95 ${
      active
        ? "bg-gradient-to-br from-primary to-primary/85 text-white shadow-sm shadow-primary/40"
        : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card/85 backdrop-blur-xl supports-[backdrop-filter]:bg-card/75">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="shine h-8 w-8 rounded-md bg-gradient-to-br from-primary to-cyan-700 grid place-items-center shadow-md shadow-primary/30 transition-transform duration-300 hover:scale-105 hover:rotate-3">
                <Battery className="h-4.5 w-4.5 text-white" />
              </div>
              <div className="leading-none tracking-tight text-[15px]">
                <span className="font-bold">Battery</span>
                <span className="font-bold text-gradient">Lab</span>
              </div>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <nav aria-label="Workflow steps" className="flex items-center gap-0.5 rounded-lg bg-muted p-1 overflow-x-auto scrollbar-none">
              {STEPS.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setActiveTab(s.id)}
                  aria-current={activeTab === s.id ? "page" : undefined}
                  title={done[s.id as keyof typeof done] ? `${s.label} complete` : s.label}
                  className={navBtn(activeTab === s.id)}
                >
                  {done[s.id as keyof typeof done] ? (
                    <Check className={`h-3.5 w-3.5 ${activeTab === s.id ? "text-white" : "text-emerald-600"}`} strokeWidth={3} />
                  ) : (
                    <span className={`text-[10px] tabular-nums ${activeTab === s.id ? "opacity-70" : "opacity-50"}`}>{i + 1}</span>
                  )}
                  {s.label}
                </button>
              ))}
              <span className="mx-0.5 h-4 w-px bg-border shrink-0" aria-hidden />
              <button
                onClick={() => setActiveTab("library")}
                aria-current={activeTab === "library" ? "page" : undefined}
                className={navBtn(activeTab === "library")}
              >
                <BookOpen className="h-3.5 w-3.5" />
                Library
              </button>
              </nav>
              <ThemeToggle />
            </div>
          </div>
        </div>
        {/* reading-progress hairline + animated gradient accent */}
        <div className="h-[2px] w-full bg-border/60">
          <div
            className="h-full bg-gradient-to-r from-primary via-cyan-600 to-primary transition-[width] duration-150 ease-out"
            style={{ width: `${Math.max(2, progress * 100)}%` }}
            aria-hidden
          />
        </div>
      </header>

      {/* Main content — keyed on the tab so every step slides/fades in on switch */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 py-6">
        <div key={activeTab} className="animate-fade-up">
          {activeTab === "design" && <DesignTab />}
          {activeTab === "library" && <LibraryTab />}
          {activeTab === "connection" && <ConnectionTab />}
          {activeTab === "model" && <ModelTab />}
          {activeTab === "simulate" && <SimulateTab />}
          {activeTab === "thermal" && <ThermalTab />}
          {activeTab === "monitor" && <MonitorTab />}
          {activeTab === "analysis" && <AnalysisTab />}
          {activeTab === "engineering" && <EngineeringTab />}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Battery className="h-3 w-3 text-primary" />
            BatteryLab — virtual battery design &amp; test platform
          </span>
          <span>Model estimates — validate with physical testing.</span>
        </div>
      </footer>

      {/* Real-time AI copilot (all tabs) */}
      <Copilot />
    </div>
  );
}
