"use client";

import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, ArrowRight, CheckCircle2, Lock, Pause, Play, RotateCcw } from "lucide-react";
import { useLabStore } from "@/lib/lab/store";
import { cn } from "@/lib/utils";

// Ordered workflow — ids match the store's activeTab values.
export const WIZARD = [
  { id: "design", label: "Design" },
  { id: "connection", label: "Connection" },
  { id: "model", label: "Modeling" },
  { id: "simulate", label: "Simulation" },
  { id: "thermal", label: "Thermal" },
  { id: "monitor", label: "Monitor" },
  { id: "analysis", label: "Analysis" },
  { id: "engineering", label: "Engineering" },
] as const;

/** mm:ss (or h:mm:ss) clock used by every playback bar. */
export function fmtClock(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  const hh = Math.floor(m / 60);
  return hh > 0
    ? `${hh}:${String(m % 60).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

/**
 * Bottom-of-page wizard bar: shows progress through the 7-step workflow,
 * a one-line summary of the configuration carried forward, and Back/Next
 * buttons. All tab state lives in the shared store, so the next step
 * always opens with everything the user configured so far. `nextDisabled`
 * (with an optional `nextHint`) gates navigation on a required condition.
 */
export function WizardNav({
  step,
  summary,
  onBeforeNext,
  nextDisabled,
  nextHint,
}: {
  step: number;
  summary?: ReactNode;
  onBeforeNext?: () => void;
  nextDisabled?: boolean;
  nextHint?: string;
}) {
  const setActiveTab = useLabStore((s) => s.setActiveTab);
  const prev = step > 0 ? WIZARD[step - 1] : null;
  const next = step < WIZARD.length - 1 ? WIZARD[step + 1] : null;
  const last = step === WIZARD.length - 1;

  return (
    <div className="rounded-lg border bg-card px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 shadow-sm">
      <div className="flex items-center gap-1.5 shrink-0" aria-hidden>
        {WIZARD.map((w, i) => (
          <span
            key={w.id}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === step ? "w-6 bg-gradient-to-r from-primary to-cyan-600 shadow-sm shadow-primary/40" : i < step ? "w-1.5 bg-primary/40" : "w-1.5 bg-border"
            )}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 gap-y-1.5 ml-auto sm:ml-0 max-w-full">
        {prev && (
          <Button size="sm" variant="ghost" onClick={() => setActiveTab(prev.id)}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
        )}
        {last ? (
          <>
            <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CheckCircle2 className="h-3 w-3" /> Workflow complete
            </Badge>
            <Button size="sm" variant="outline" onClick={() => setActiveTab("design")}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> New design
            </Button>
          </>
        ) : (
          next && (
            <Button
              size="sm"
              disabled={nextDisabled}
              title={nextDisabled ? nextHint : undefined}
              onClick={() => {
                onBeforeNext?.();
                setActiveTab(next.id);
              }}
            >
              Next: {next.label}
              {nextDisabled ? <Lock className="h-3.5 w-3.5 ml-1" /> : <ArrowRight className="h-3.5 w-3.5 ml-1" />}
            </Button>
          )
        )}
      </div>
      <div className="text-xs min-w-0 w-full sm:w-auto sm:flex-1 order-last sm:order-none">
        <span className="font-medium text-foreground">Step {step + 1} of {WIZARD.length} · {WIZARD[step].label}</span>
        {summary != null && <span className="text-muted-foreground"> — {summary}</span>}
      </div>
    </div>
  );
}

/**
 * Shared playback controls (play / restart / speed / scrub / clock / chart-sync)
 * for every live view that replays a run: the Simulation test bench, the
 * Thermal scopes + pack map and the Monitor dashboard. One clock everywhere.
 */
export function PlaybackBar({
  tick,
  len,
  playing,
  speed,
  syncCharts,
  clock,
  onPlayPause,
  onRestart,
  onSpeed,
  onScrub,
  onSyncToggle,
}: {
  tick: number;
  len: number;
  playing: boolean;
  speed: number;
  syncCharts: boolean;
  clock: ReactNode;
  onPlayPause: () => void;
  onRestart: () => void;
  onSpeed: (v: number) => void;
  onScrub: (v: number) => void;
  onSyncToggle?: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={onPlayPause} disabled={len < 2} className="bg-primary hover:bg-primary/90">
        {playing ? <Pause className="h-3.5 w-3.5 mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />}
        {playing ? "Pause" : "Play"}
      </Button>
      <Button size="sm" variant="outline" onClick={onRestart} disabled={len < 2}>
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
      <div className="flex items-center gap-0.5 rounded-md border bg-muted/40 p-0.5" role="group" aria-label="Playback speed">
        {[0.5, 1, 2, 4].map((v) => (
          <button
            key={v}
            onClick={() => onSpeed(v)}
            className={cn(
              "rounded px-2 py-1 text-[11px] font-semibold tabular-nums transition-colors",
              speed === v ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {v}×
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 min-w-[140px] flex-1 max-w-[340px]">
        <Slider
          value={[tick]}
          min={0}
          max={Math.max(1, len - 1)}
          step={1}
          disabled={len < 2}
          onValueChange={([v]) => onScrub(v)}
          aria-label="Scrub through the test"
        />
      </div>
      <span className="text-[11px] tabular-nums text-muted-foreground font-medium">{clock}</span>
      {onSyncToggle && (
        <Button size="sm" variant={syncCharts ? "default" : "outline"} className="ml-auto h-7 px-2.5 text-[11px]" onClick={() => onSyncToggle(!syncCharts)}>
          {syncCharts ? "Charts: follow playback" : "Charts: full data"}
        </Button>
      )}
    </div>
  );
}

export function SectionTitle({ title, desc, icon }: { title: string; desc?: string; icon?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      {icon && (
        <div
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary/15 via-primary/10 to-cyan-500/10 text-primary ring-1 ring-primary/20 shadow-sm"
        >
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight leading-tight">{title}</h2>
        {desc && <p className="text-[13px] text-muted-foreground mt-0.5">{desc}</p>}
      </div>
    </div>
  );
}

export function StatCard({ label, value, unit, hint, tone }: { label: string; value: ReactNode; unit?: string; hint?: ReactNode; tone?: "default" | "warn" | "fail" }) {
  return (
    <div
      className={cn(
        "card-lift rounded-lg border bg-card p-2.5 relative overflow-hidden",
        tone === "warn" && "border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10",
        tone === "fail" && "border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10"
      )}
    >
      {/* accent edge on the tone cards */}
      {(tone === "warn" || tone === "fail") && (
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-0 top-0 h-0.5",
            tone === "warn" ? "bg-gradient-to-r from-amber-400 to-amber-500" : "bg-gradient-to-r from-red-400 to-red-500"
          )}
        />
      )}
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="text-lg font-semibold tabular-nums leading-tight">{value}</span>
        {unit && <span className="text-[11px] text-muted-foreground">{unit}</span>}
      </div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: "ok" | "warn" | "fail" }) {
  if (status === "ok") return <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 font-semibold">PASS</Badge>;
  if (status === "warn") return <Badge className="bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-50 font-semibold">WARN</Badge>;
  return <Badge className="bg-red-50 text-red-700 border border-red-200 hover:bg-red-50 font-semibold">FAIL</Badge>;
}

export function ChartCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="card-lift rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[13px] font-semibold">{title}</h3>
        {action}
      </div>
      <div className="h-64">{children}</div>
    </div>
  );
}

export const CHART_COLORS = {
  blue: "#1e5a96",
  cyan: "#0e7490",
  amber: "#b45309",
  red: "#dc2626",
  slate: "#64748b",
  violet: "#7c3aed",
};

export const COOLING_PRESETS = [
  { label: "None (adiabatic)", h: 0 },
  { label: "Natural air", h: 8 },
  { label: "Forced air (fan)", h: 35 },
  { label: "Liquid cold plate", h: 150 },
];
