"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Network, Minus, Plus, Sparkles, Calculator, Check, RotateCcw } from "lucide-react";
import { useLabStore } from "@/lib/lab/store";
import { packMath } from "@/lib/lab/engine";
import { SectionTitle, StatCard, WizardNav } from "./shared";
import { cn } from "@/lib/utils";

const MAX_G = 10; // series groups drawn
const MAX_C = 6; // parallel cells drawn per group
const SPACING = 26; // x distance between parallel cells
const GAP = 34; // x gap between groups (room for the series bracket)
const CELL0 = 16; // first cell centre inside a group
const RAIL_TOP = 34;
const RAIL_BOT = 176;
const BMS_Y = 216; // BMS box top
const BMS_H = 26;
const SVG_H = 258;
const STEPS = ["Cells placed", "Parallel bus bars", "Series links", "Terminals + BMS"];

interface Group {
  idx: number;
  left: number;
  right: number;
}
interface Layout {
  groups: Group[];
  gap: { left: number; right: number; n: number } | null;
  width: number;
  slots: number;
  hasPlus: boolean;
  truncated: boolean;
}

export function ConnectionTab() {
  const { design, pack, setPack, build, setBuildStage, sendCopilotMessage, copilotBusy } = useLabStore();
  const pm = packMath(design, pack);
  const [targetV, setTargetV] = useState("");

  // Build state records which S×P the drawn connection belongs to — changing
  // the cell count invalidates it (stage reads 0 = cells placed, unconnected).
  // 0 cells placed · 1 parallel connected · 2 series connected · 3 terminals + BMS
  const stage = build.s === pack.series && build.p === pack.parallel ? build.stage : 0;
  const setStage = setBuildStage;

  const cellNominalV = design.nominalV > 0
    ? design.nominalV
    : design.vmax > 0 && design.vmin > 0 ? (design.vmax + design.vmin) / 2 + 0.05 : 0;
  const targetNum = parseFloat(targetV);
  const suggestedS = cellNominalV > 0 && Number.isFinite(targetNum) && targetNum > 0
    ? Math.max(1, Math.round(targetNum / cellNominalV))
    : null;

  // Targets set in the Design tab pre-load the cell count here
  const expS = pack.targetV > 0 && cellNominalV > 0 ? Math.max(1, Math.round(pack.targetV / cellNominalV)) : null;
  const expP = pack.targetAh > 0 && design.capacityAh > 0 ? Math.max(1, Math.ceil(pack.targetAh / design.capacityAh)) : null;
  const drift = (expS !== null && expS !== pack.series) || (expP !== null && expP !== pack.parallel);

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={<Network className="h-5 w-5" />}
        title="2 · Pack Connection"
        desc="Cell count loaded from your design — build the schematic connection."
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Controls */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Configuration</CardTitle>
            <CardDescription>S cells in series × P cells in parallel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {(pack.targetV > 0 || pack.targetAh > 0) && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/[0.05] px-3 py-2">
                <Network className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="text-xs text-muted-foreground">
                  From your design:{" "}
                  <span className="font-medium text-foreground">
                    {[pack.targetV > 0 ? `${pack.targetV} V` : null, pack.targetAh > 0 ? `${pack.targetAh} Ah` : null].filter(Boolean).join(" · ")}
                  </span>{" → "}
                  <span className="font-semibold text-primary">{expS ?? "?"}S{expP ?? "?"}P</span>
                </span>
                {drift && (
                  <Button
                    size="sm" variant="outline"
                    className="ml-auto h-6 px-2 text-[11px]"
                    onClick={() => setPack({ ...(expS ? { series: expS } : {}), ...(expP ? { parallel: expP } : {}) })}
                  >
                    Re-apply
                  </Button>
                )}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Series (S) — voltage multiplier</span>
                <Badge className="bg-primary text-white border-0 text-sm">{pack.series}S</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="outline" onClick={() => setPack({ series: Math.max(1, pack.series - 1) })} aria-label="Decrease series">
                  <Minus className="h-4 w-4" />
                </Button>
                <Slider
                  value={[pack.series]}
                  min={1}
                  max={200}
                  step={1}
                  onValueChange={([v]) => setPack({ series: v })}
                />
                <Button size="icon" variant="outline" onClick={() => setPack({ series: Math.min(200, pack.series + 1) })} aria-label="Increase series">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Parallel (P) — capacity multiplier</span>
                <Badge className="bg-slate-600 text-white border-0 text-sm">{pack.parallel}P</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="outline" onClick={() => setPack({ parallel: Math.max(1, pack.parallel - 1) })} aria-label="Decrease parallel">
                  <Minus className="h-4 w-4" />
                </Button>
                <Slider
                  value={[pack.parallel]}
                  min={1}
                  max={50}
                  step={1}
                  onValueChange={([v]) => setPack({ parallel: v })}
                />
                <Button size="icon" variant="outline" onClick={() => setPack({ parallel: Math.min(50, pack.parallel + 1) })} aria-label="Increase parallel">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">Target-voltage helper</div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="number" min={0} step={1} placeholder="e.g. 48"
                  className="h-9 w-28" value={targetV} aria-label="Target pack voltage in volts"
                  onChange={(e) => setTargetV(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">V target</span>
                {suggestedS && cellNominalV > 0 && (
                  <Badge className="bg-primary text-white border-0">Suggested: {suggestedS}S</Badge>
                )}
                {suggestedS && (
                  <Button size="sm" variant="outline" onClick={() => setPack({ series: suggestedS })}>
                    <Calculator className="h-3.5 w-3.5 mr-1" /> Apply S
                  </Button>
                )}
              </div>
              {cellNominalV > 0 ? (
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Cell nominal {cellNominalV.toFixed(2)} V → S = round(target ÷ {cellNominalV.toFixed(2)}) · P = target Ah ÷ {design.capacityAh || "?"} Ah.
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Define your cell voltage window in the Design tab to enable the helper.
                </p>
              )}
              <button
                onClick={() => sendCopilotMessage("Help me size my pack: here is my target voltage and capacity (I'll describe it). Recommend series × parallel and check the current per cell.")}
                disabled={copilotBusy}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Ask copilot to size my pack
              </button>
            </div>

            <div className="rounded-lg bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">Formulas: </span>
              V<sub>pack</sub> = S·V<sub>cell</sub> · Ah<sub>pack</sub> = P·Ah<sub>cell</sub> · R<sub>pack</sub> = S·R/P · per-cell current ÷ P
            </div>
          </CardContent>
        </Card>

        {/* Schematic builder */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-sm">Schematic — {pack.series}S{pack.parallel}P</CardTitle>
              {stage === 3 ? (
                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">Pack connected</Badge>
              ) : (
                <Badge variant="outline" className="border-amber-300 text-amber-600">Not connected</Badge>
              )}
            </div>
            <CardDescription>{pm.cellCount} cells loaded from your design</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Build steps */}
            <div className="flex flex-wrap items-center gap-1.5">
              {STEPS.map((label, i) => (
                <span
                  key={label}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    stage > i
                      ? "border-primary/30 bg-primary/[0.07] text-primary"
                      : stage === i
                        ? "border-foreground/30 text-foreground"
                        : "border-border/60 text-muted-foreground"
                  )}
                >
                  {stage > i ? <Check className="h-3 w-3" /> : <span className="tabular-nums opacity-60">{i + 1}</span>}
                  {label}
                </span>
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {stage === 0 && <Button size="sm" onClick={() => setStage(1)}>Connect parallel</Button>}
              {stage === 1 && <Button size="sm" onClick={() => setStage(2)}>Connect series</Button>}
              {stage === 2 && <Button size="sm" onClick={() => setStage(3)}>Terminals + BMS</Button>}
              {stage < 3 && <Button size="sm" variant="outline" onClick={() => setStage(3)}>Connect all</Button>}
              {stage > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setStage(0)}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Rebuild
                </Button>
              )}
            </div>

            <PackSchematic series={pack.series} parallel={pack.parallel} stage={stage} vmax={pm.packVmax} />

            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
              <span>{pack.series}S{pack.parallel}P · {pm.cellCount} cells</span>
              {pack.series > MAX_G && <span>showing {MAX_G} of {pack.series} groups</span>}
              {pack.parallel > MAX_C && <span>showing {MAX_C} of {pack.parallel} cells per group</span>}
              {stage === 3 && <span className="font-medium text-emerald-600">circuit complete</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pack KPIs */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Pack electrical summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 stagger">
          <StatCard label="Nominal V" value={pm.packNominalV} unit="V" />
          <StatCard label="V max" value={pm.packVmax} unit="V" />
          <StatCard label="V min" value={pm.packVmin} unit="V" />
          <StatCard label="Capacity" value={pm.packCapacityAh} unit="Ah" />
          <StatCard label="Energy" value={pm.packEnergyWh} unit="Wh" />
          <StatCard label="R₀ pack" value={pm.r0Pack} unit="Ω" />
          <StatCard label="Mass (est.)" value={pm.packMassKg} unit="kg" />
          <StatCard label="Peak power" value={(pm.maxContPowerW / 1000).toFixed(1)} unit="kW" />
        </div>
      </div>

      {/* Wizard: Connection → Modeling; gated until the schematic is complete */}
      <WizardNav
        step={1}
        nextDisabled={stage < 3}
        nextHint="Connect the schematic (terminals + BMS) to unlock the next step"
        summary={
          <>{pack.series}S{pack.parallel}P · {pm.cellCount} cells · {pm.packNominalV} V / {pm.packCapacityAh} Ah carried into Modeling{stage < 3 ? <span className="text-amber-600"> · connect the schematic to unlock Next</span> : null}</>
        }
      />
    </div>
  );
}

// ------------------------------------------------------------
// Schematic — canonical series-parallel ladder, drawn electrically
// correct: every cell shares one orientation (long plate = + on
// top), each parallel group hangs between its own two bus bars,
// adjacent groups are chained − → + with bracket-shaped series
// links (bottom rail of group k up to the top rail of group k+1),
// and the pack terminals sit on the OUTER rails only (pack + on
// the first group's top rail, pack − on the last group's bottom
// rail) so no terminal ever shares a node with a series link.
// Each build stage adds one wiring layer.
// ------------------------------------------------------------

function PackSchematic({ series, parallel, stage, vmax }: { series: number; parallel: number; stage: number; vmax: number }) {
  const L = useMemo<Layout>(() => {
    const slots = Math.min(parallel, MAX_C);
    const hasPlus = parallel > MAX_C;
    const gw = CELL0 + Math.max(0, slots - 1) * SPACING + CELL0 + (hasPlus ? 24 : 0);
    const truncated = series > MAX_G;
    const drawn = truncated ? MAX_G - 1 : series; // leave room for the gap marker + final group
    const groups: Group[] = [];
    let x = 56; // room for the + terminal lead on the left
    for (let i = 0; i < drawn; i++) {
      groups.push({ idx: i, left: x, right: x + gw });
      x += gw + GAP;
    }
    let gap: Layout["gap"] = null;
    if (truncated) {
      gap = { left: x, right: x + 52, n: series - MAX_G };
      x += 52 + GAP;
      groups.push({ idx: series - 1, left: x, right: x + gw });
      x += gw;
    }
    return { groups, gap, width: x + 40, slots, hasPlus, truncated };
  }, [series, parallel]);

  const cy = (RAIL_TOP + RAIL_BOT) / 2;
  const first = L.groups[0];
  const last = L.groups[L.groups.length - 1];
  const busL = (g: Group) => g.left + 5;
  const busR = (g: Group) => g.right - 5;
  const cellX = (g: Group, i: number) => g.left + CELL0 + i * SPACING;
  const boxW = 72;
  const bx = Math.max(20, L.width / 2 - boxW / 2);

  return (
    <div className="overflow-x-auto rounded-lg border bg-card px-1 pb-1">
      <svg
        width={L.width}
        height={SVG_H}
        viewBox={`0 0 ${L.width} ${SVG_H}`}
        role="img"
        aria-label={`Pack schematic ${series}S${parallel}P`}
        className="select-none"
      >
        {/* ===== cells — one orientation, long plate (+) on top, short thick plate (−) below ===== */}
        {L.groups.map((g) => (
          <g key={g.idx}>
            {Array.from({ length: L.slots }).map((_, i) => {
              const cx = cellX(g, i);
              return (
                <g key={i} className="stroke-primary" strokeWidth={1.8} fill="none" strokeLinecap="round">
                  <path d={`M ${cx - 9} ${cy - 5} H ${cx + 9}`} strokeWidth={2.2} />
                  <path d={`M ${cx - 3.5} ${cy + 5} H ${cx + 3.5}`} strokeWidth={3.2} />
                </g>
              );
            })}
            {L.hasPlus && (
              <g className="stroke-border">
                <rect x={g.right - 22} y={RAIL_TOP + 26} width={16} height={RAIL_BOT - RAIL_TOP - 52} rx={4} strokeWidth={1.2} strokeDasharray="3 3" className="fill-muted" />
                <text x={g.right - 14} y={cy + 3} textAnchor="middle" fontSize={9} className="fill-muted-foreground" stroke="none">+{parallel - MAX_C}</text>
              </g>
            )}
            {/* rail polarity marks — + is the top rail, − the bottom rail of every group */}
            <text x={busL(g) + 2} y={RAIL_TOP - 8} fontSize={9} fontWeight={700} className="fill-red-500" stroke="none">+</text>
            <text x={busL(g) + 2} y={RAIL_BOT + 13} fontSize={9} fontWeight={700} className="fill-slate-500 dark:fill-slate-400" stroke="none">−</text>
            <text x={(g.left + g.right) / 2} y={196} textAnchor="middle" fontSize={10} className="fill-muted-foreground" stroke="none">
              S{g.idx + 1}
            </text>
          </g>
        ))}

        {/* ===== stage 0 — cells are unconnected: floating pins ===== */}
        {stage === 0 &&
          L.groups.map((g) => (
            <g key={`pins-${g.idx}`} className="stroke-slate-400 dark:stroke-slate-500" strokeWidth={1.2} fill="none">
              {Array.from({ length: L.slots }).map((_, i) => {
                const cx = cellX(g, i);
                return (
                  <g key={i}>
                    <path d={`M ${cx} ${cy - 5} V ${cy - 13}`} strokeDasharray="2 2" />
                    <path d={`M ${cx} ${cy + 5} V ${cy + 13}`} strokeDasharray="2 2" />
                    <circle cx={cx} cy={cy - 16} r={2.2} className="fill-background" />
                    <circle cx={cx} cy={cy + 16} r={2.2} className="fill-background" />
                  </g>
                );
              })}
            </g>
          ))}
        {stage === 0 && (
          <text x={L.width / 2} y={BMS_Y + 17} textAnchor="middle" fontSize={10} className="fill-muted-foreground" stroke="none">
            {parallel} cell{parallel === 1 ? "" : "s"} per group, unconnected — press “Connect parallel” to wire the bus bars
          </text>
        )}

        {/* ===== stage 1 — parallel bus bars: one pair of rails per group ===== */}
        <g className={cn("stroke-primary transition-opacity duration-500", stage >= 1 ? "opacity-100" : "opacity-0")} strokeWidth={2.6} strokeLinecap="round" fill="none">
          {L.groups.map((g) => (
            <g key={`r-${g.idx}`}>
              <path d={`M ${busL(g)} ${RAIL_TOP} H ${busR(g)}`} />
              <path d={`M ${busL(g)} ${RAIL_BOT} H ${busR(g)}`} />
            </g>
          ))}
        </g>
        {/* cell taps up to the rails + junction dots at every 3-way connection */}
        <g className={cn("stroke-primary transition-opacity duration-500", stage >= 1 ? "opacity-100" : "opacity-0")} strokeWidth={1.6} fill="none" strokeLinecap="round">
          {L.groups.map((g) =>
            Array.from({ length: L.slots }).map((_, i) => {
              const cx = cellX(g, i);
              return <path key={`s-${g.idx}-${i}`} d={`M ${cx} ${RAIL_TOP} V ${cy - 5} M ${cx} ${cy + 5} V ${RAIL_BOT}`} />;
            })
          )}
          {L.slots > 1 &&
            L.groups.map((g) =>
              Array.from({ length: L.slots }).map((_, i) => (
                <g key={`d-${g.idx}-${i}`} className="stroke-primary" strokeWidth={0.8}>
                  <circle cx={cellX(g, i)} cy={RAIL_TOP} r={1.9} className="fill-primary" />
                  <circle cx={cellX(g, i)} cy={RAIL_BOT} r={1.9} className="fill-primary" />
                </g>
              ))
            )}
        </g>

        {/* ===== stage 2 — series links: − (bottom rail of group k) → + (top rail of group k+1) ===== */}
        <g fill="none" className={cn("transition-opacity duration-500", stage >= 2 ? "opacity-100" : "opacity-0")}>
          {L.groups.map((g, i) => {
            if (i === 0) return null;
            const gA = L.groups[i - 1];
            const midX = (gA.right + g.left) / 2;
            return (
              <path
                key={`l-${i}`}
                d={`M ${busR(gA)} ${RAIL_BOT} H ${midX} V ${RAIL_TOP} H ${busL(g)}`}
                className="stroke-primary"
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            );
          })}
          {/* junction dots where the brackets tap the rails */}
          {L.groups.map((g, i) => {
            if (i === 0) return null;
            const gA = L.groups[i - 1];
            const midX = (gA.right + g.left) / 2;
            return (
              <g key={`jd-${i}`} className="stroke-primary" strokeWidth={0.8}>
                <circle cx={busR(gA)} cy={RAIL_BOT} r={2.2} className="fill-primary" />
                <circle cx={busL(g)} cy={RAIL_TOP} r={2.2} className="fill-primary" />
              </g>
            );
          })}
          {/* dashed continuation across the truncation gap */}
          {L.gap && (() => {
            const prev = L.groups[L.groups.length - 2];
            const gl = L.groups[L.groups.length - 1];
            const midX = (L.gap.left + L.gap.right) / 2;
            return (
              <path
                d={`M ${busR(prev)} ${RAIL_BOT} H ${midX} V ${RAIL_TOP} H ${busL(gl)}`}
                className="stroke-primary/60"
                strokeWidth={2}
                strokeDasharray="5 4"
                strokeLinecap="round"
              />
            );
          })()}
        </g>

        {/* ===== stage 3 — pack terminals on the outer rails + BMS sense lines ===== */}
        <g className={cn("transition-opacity duration-500", stage >= 3 ? "opacity-100" : "opacity-0")}>
          {/* pack + : first group's TOP rail, extended to the left edge */}
          <path d={`M ${busL(first)} ${RAIL_TOP} H 26`} className="stroke-red-600" strokeWidth={2.6} fill="none" strokeLinecap="round" />
          <circle cx={22} cy={RAIL_TOP} r={4.2} className="fill-red-600" />
          <text x={22} y={RAIL_TOP - 11} textAnchor="middle" fontSize={13} fontWeight={700} className="fill-red-600">+</text>
          <text x={22} y={RAIL_TOP + 21} textAnchor="middle" fontSize={9} fontWeight={600} className="fill-muted-foreground">{vmax} V</text>
          {/* pack − : last group's BOTTOM rail, extended to the right edge */}
          <path d={`M ${busR(last)} ${RAIL_BOT} H ${L.width - 26}`} className="stroke-slate-700 dark:stroke-slate-300" strokeWidth={2.6} fill="none" strokeLinecap="round" />
          <circle cx={L.width - 22} cy={RAIL_BOT} r={4.2} className="fill-slate-700 dark:fill-slate-300" />
          <text x={L.width - 22} y={RAIL_BOT - 11} textAnchor="middle" fontSize={13} fontWeight={700} className="fill-slate-700 dark:fill-slate-300">−</text>
          {/* BMS sense lines routed down the outer margins — never crossing the cells */}
          <path d={`M 22 ${RAIL_TOP + 8} V ${BMS_Y + BMS_H / 2} H ${bx}`} className="stroke-slate-400 dark:stroke-slate-500" strokeWidth={1.3} strokeDasharray="4 3" fill="none" />
          <path d={`M ${L.width - 22} ${RAIL_BOT + 8} V ${BMS_Y + BMS_H / 2} H ${bx + boxW}`} className="stroke-slate-400 dark:stroke-slate-500" strokeWidth={1.3} strokeDasharray="4 3" fill="none" />
          <rect x={bx} y={BMS_Y} width={boxW} height={BMS_H} rx={6} className="fill-muted stroke-border" strokeWidth={1.3} />
          <text x={bx + boxW / 2} y={BMS_Y + 17} textAnchor="middle" fontSize={10} fontWeight={700} className="fill-foreground">BMS</text>
        </g>

        {/* ===== truncation gap marker ===== */}
        {L.gap && (
          <g>
            <rect x={L.gap.left + 4} y={RAIL_TOP + 42} width={L.gap.right - L.gap.left - 8} height={RAIL_BOT - RAIL_TOP - 84} rx={5} className="fill-muted stroke-border" strokeWidth={1.2} strokeDasharray="4 3" />
            <text x={(L.gap.left + L.gap.right) / 2} y={cy - 8} textAnchor="middle" fontSize={12} className="fill-muted-foreground" stroke="none">⋯</text>
            <text x={(L.gap.left + L.gap.right) / 2} y={cy + 12} textAnchor="middle" fontSize={10} fontWeight={600} className="fill-muted-foreground" stroke="none">+{L.gap.n}</text>
          </g>
        )}
      </svg>
    </div>
  );
}
