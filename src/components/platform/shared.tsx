"use client";

import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckStatus } from "@/lib/battery/model";

export function StatCard({
  label,
  value,
  unit,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad" | "accent";
}) {
  const toneCls = {
    default: "text-foreground",
    good: "text-emerald-400",
    warn: "text-amber-400",
    bad: "text-red-400",
    accent: "text-accent",
  }[tone];
  return (
    <Card className="bg-card/70 border-border/70">
      <CardContent className="p-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
        <div className={cn("mt-1 font-mono text-xl font-semibold tabular-nums leading-none", toneCls)}>
          {value}
          {unit ? <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span> : null}
        </div>
        {hint ? <div className="mt-1.5 text-[11px] text-muted-foreground leading-snug">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4">
      {eyebrow ? (
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/90">{eyebrow}</div>
      ) : null}
      <h2 className="text-lg font-semibold tracking-tight mt-0.5">{title}</h2>
      {children ? <div className="mt-1 text-sm text-muted-foreground max-w-3xl leading-relaxed">{children}</div> : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: CheckStatus }) {
  const map = {
    pass: { label: "PASS", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    warn: { label: "WARN", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    fail: { label: "FAIL", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  } as const;
  const m = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide",
        m.cls,
      )}
    >
      {m.label}
    </span>
  );
}

export function scoreColor(s: number): string {
  if (s >= 80) return "#34d399";
  if (s >= 60) return "#a3e635";
  if (s >= 40) return "#fbbf24";
  if (s >= 20) return "#fb923c";
  return "#f87171";
}

export function ScoreChip({ label, score, weight }: { label: string; score: number; weight?: number }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/40 px-2.5 py-1.5">
      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: scoreColor(score) }} />
      <span className="text-xs text-muted-foreground">{label}</span>
      {weight ? <span className="text-[10px] text-muted-foreground/60">×{weight}</span> : null}
      <span className="ml-auto font-mono text-xs font-semibold tabular-nums">{score.toFixed(0)}</span>
    </div>
  );
}

export function tempColor(t: number): string {
  // 20 °C → teal, 45 °C → amber, 60+ °C → red
  if (t < 25) return "#14b8a6";
  if (t < 32) return "#34d399";
  if (t < 40) return "#a3e635";
  if (t < 48) return "#fbbf24";
  if (t < 56) return "#fb923c";
  return "#f87171";
}

export function CellGrid({
  series,
  parallel,
  temps,
  limitC,
}: {
  series: number;
  parallel: number;
  temps: number[];
  limitC: number;
}) {
  // columns = series string positions, rows = parallel groups
  return (
    <div className="overflow-x-auto pb-1">
      <div
        className="grid gap-1.5 min-w-max mx-auto"
        style={{ gridTemplateColumns: `repeat(${Math.min(series, 18)}, minmax(14px, 1fr))` }}
      >
        {Array.from({ length: Math.min(series, 18) * parallel }).map((_, idx) => {
          const row = Math.floor(idx / Math.min(series, 18));
          const col = idx % Math.min(series, 18);
          const t = temps[Math.min(col, temps.length - 1)] ?? 25;
          const hot = t > limitC;
          return (
            <div key={idx} className="group relative">
              <div
                className={cn(
                  "h-7 w-4 rounded-full border transition-transform hover:scale-110",
                  hot ? "border-red-400/80 ring-1 ring-red-400/40" : "border-black/30",
                )}
                style={{ background: tempColor(t) }}
                title={`Cell S${col + 1}P${row + 1} — est. ${t.toFixed(1)} °C`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#14b8a6" }} /> cool
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#a3e635" }} /> warm
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#fbbf24" }} /> hot
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#f87171" }} /> over limit
        </span>
        <span className="ml-2 font-mono">{series}S × {parallel}P = {series * parallel} cells</span>
      </div>
    </div>
  );
}

export function KeyValue({ k, v, mono = true }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground">{k}</span>
      <span className={cn("text-xs text-right", mono && "font-mono tabular-nums")}>{v}</span>
    </div>
  );
}

export function TechBadge({ children }: { children: ReactNode }) {
  return (
    <Badge variant="outline" className="border-border/60 bg-secondary/30 text-[10px] font-mono text-muted-foreground">
      {children}
    </Badge>
  );
}
