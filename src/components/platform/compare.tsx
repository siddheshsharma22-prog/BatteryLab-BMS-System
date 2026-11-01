"use client";

import { useState, useSyncExternalStore } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { GitCompareArrows, Trash2, ArrowRight, Trophy, Info } from "lucide-react";
import { useDesignStore, SLOT_META, SavedDesign, SlotId } from "@/lib/battery/store";
import { SectionHeader, scoreColor, TechBadge } from "./shared";
import { evaluateDesign } from "@/lib/battery/model";

const SLOT_COLORS: Record<SlotId, string> = {
  baseline: "#94a3b8",
  optionA: "#34d399",
  optionB: "#fbbf24",
};

function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function bestOf(values: (number | null)[], mode: "max" | "min"): number | null {
  const vals = values.filter((v): v is number => v !== null);
  if (vals.length < 2) return null;
  return mode === "max" ? Math.max(...vals) : Math.min(...vals);
}

export function Compare({ onJump }: { onJump: (tab: string) => void }) {
  const { designs, clearSlot, clearAll } = useDesignStore();
  const saved = SLOT_META.map((s) => designs[s.id]).filter((d): d is SavedDesign => d !== null);
  const hydrated = useHydrated();

  // full re-evaluation of each saved snapshot so derived metrics stay consistent
  const detailed = saved.map((d) => ({ d, r: evaluateDesign(d.inputs) }));

  const radarData = saved.length > 0
    ? ["energy", "safety", "cost", "charge", "thermal", "mass", "lifetime"].map((k) => {
        const row: Record<string, string | number> = { criterion: k };
        detailed.forEach(({ d }) => {
          row[d.label] = Math.round(d.scores[k] ?? 0);
        });
        return row;
      })
    : [];

  const barData = detailed.map(({ d }) => ({
    name: d.label,
    "Usable Wh": Math.round(d.usableWh),
    "Charge min": Math.round(d.chargeMinutes),
    "$ / kWh·life": Math.round(d.costPerLifetimeKwh),
  }));

  const rows: { label: string; get: (d: SavedDesign) => string; num: (d: SavedDesign) => number | null; mode?: "max" | "min" }[] = [
    { label: "Cell", get: (d) => d.cellName.replace("Samsung ", "").replace("LG ", "LG ").replace(" (LiFePO4)", ""), num: () => null },
    { label: "Topology / cooling", get: (d) => `${d.inputs.series}S${d.inputs.parallel}P · ${d.coolingName.split(" (")[0]}`, num: () => null },
    { label: "Balanced score /100", get: (d) => d.totalScore.toFixed(0), num: (d) => d.totalScore, mode: "max" },
    { label: "Usable energy (Wh)", get: (d) => d.usableWh.toFixed(0), num: (d) => d.usableWh, mode: "max" },
    { label: "Time to 80% (min)", get: (d) => d.chargeMinutes.toFixed(0), num: (d) => d.chargeMinutes, mode: "min" },
    { label: "Peak cell temp (°C)", get: (d) => d.peakTempC.toFixed(1), num: (d) => d.peakTempC, mode: "min" },
    { label: "Pack mass (kg)", get: (d) => d.packMassKg.toFixed(2), num: (d) => d.packMassKg, mode: "min" },
    { label: "Energy density (Wh/kg)", get: (d) => d.whPerKg.toFixed(0), num: (d) => d.whPerKg, mode: "max" },
    { label: "Build cost ($)", get: (d) => `$${d.costTotal.toFixed(0)}`, num: (d) => d.costTotal, mode: "min" },
    { label: "$ / lifetime-kWh", get: (d) => `$${d.costPerLifetimeKwh.toFixed(0)}`, num: (d) => d.costPerLifetimeKwh, mode: "min" },
    { label: "Limit violations", get: (d) => `${d.failCount} fail · ${d.warnCount} warn`, num: (d) => d.failCount, mode: "min" },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Trade-off analysis" title="Compare design options against the baseline">
        Save configurations from the Designer into the three slots, then study this table and the radar
        overlay. The platform highlights the best value per row and names an overall recommendation —
        the same “balanced design with stated risks” decision the case study requires.
      </SectionHeader>

      {hydrated && saved.length === 0 ? (
        <Card className="bg-card/70 border-dashed border-border">
          <CardContent className="p-10 text-center">
            <GitCompareArrows className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <h3 className="mt-3 font-semibold text-sm">No designs saved yet</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Open the Designer, configure a pack (try the baseline preset: LG MJ1, 10S2P, passive air),
              then use <span className="text-foreground font-medium">Save → Baseline</span>. Build two
              alternatives — for example a 21700 power cell with forced air, and an LFP pack with a cold
              plate — and return here.
            </p>
            <Button onClick={() => onJump("designer")} className="mt-5 gap-2">
              Go to Designer <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ) : !hydrated ? (
        <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">Loading saved designs…</div>
      ) : (
        <>
          {/* Slot summary cards */}
          <div className="grid gap-3 md:grid-cols-3">
            {SLOT_META.map((s) => {
              const d = designs[s.id];
              return (
                <Card key={s.id} className="bg-card/70 overflow-hidden">
                  <div className="h-1" style={{ background: SLOT_COLORS[s.id] }} />
                  <CardContent className="p-4">
                    {d ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: SLOT_COLORS[s.id] }}>{s.label}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">{new Date(d.savedAt).toLocaleTimeString()}</span>
                          <button
                            onClick={() => clearSlot(s.id)}
                            className="ml-auto text-muted-foreground hover:text-red-400 transition-colors"
                            aria-label={`Clear ${s.label}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="mt-1.5 font-mono text-sm">{d.cellName}</div>
                        <div className="text-[11px] text-muted-foreground">{d.inputs.series}S{d.inputs.parallel}P · {d.coolingName.split(" (")[0]} · {Math.round(d.inputs.dod * 100)}% DoD</div>
                        <div className="mt-2 flex items-end gap-2">
                          <span className="font-mono text-2xl font-bold" style={{ color: scoreColor(d.totalScore) }}>{d.totalScore.toFixed(0)}</span>
                          <span className="text-[10px] text-muted-foreground mb-0.5">/100 balanced</span>
                          {d.failCount > 0 ? <TechBadge>{d.failCount} violations</TechBadge> : null}
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-muted-foreground py-6 text-center">
                        {s.label} slot empty
                        <div className="text-[10px] mt-1">{s.hint}</div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {detailed.length >= 1 ? (
            <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
              {/* Comparison table */}
              <Card className="bg-card/70 overflow-hidden">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/60">
                          <TableHead className="text-xs w-44">Metric</TableHead>
                          {detailed.map(({ d }) => (
                            <TableHead key={d.slot} className="text-xs">
                              <span style={{ color: SLOT_COLORS[d.slot] }}>{d.label}</span>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => {
                          const nums = detailed.map(({ d }) => row.num ? row.num(d) : null);
                          const best = row.mode ? bestOf(nums, row.mode) : null;
                          return (
                            <TableRow key={row.label} className="border-border/40">
                              <TableCell className="text-xs text-muted-foreground py-2.5">{row.label}</TableCell>
                              {detailed.map(({ d }, i) => (
                                <TableCell key={d.slot} className="py-2.5">
                                  <span
                                    className={`font-mono text-xs ${nums[i] !== null && best !== null && nums[i] === best ? "font-bold text-emerald-400" : ""}`}
                                  >
                                    {row.get(d)}
                                    {nums[i] !== null && best !== null && nums[i] === best && detailed.length > 1 ? " ★" : ""}
                                  </span>
                                </TableCell>
                              ))}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="px-4 py-2.5 border-t border-border/40 text-[10px] text-muted-foreground flex items-center gap-1.5">
                    <Info className="h-3 w-3" /> ★ marks the best value in each row (green = winner). Charges, temps and costs assume each design&apos;s own scenario inputs.
                  </div>
                </CardContent>
              </Card>

              {/* Radar overlay */}
              <Card className="bg-card/70">
                <CardContent className="p-5">
                  <h3 className="font-semibold text-sm mb-1">Trade-off radar</h3>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Overlaid scores expose the classic battery conflict: no single design dominates every axis.
                  </p>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData} outerRadius="70%">
                        <PolarGrid stroke="oklch(0.32 0.015 235)" />
                        <PolarAngleAxis dataKey="criterion" tick={{ fontSize: 10, fill: "oklch(0.688 0.012 235)" }} />
                        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                        {detailed.map(({ d }) => (
                          <Radar
                            key={d.slot}
                            dataKey={d.label}
                            stroke={SLOT_COLORS[d.slot]}
                            fill={SLOT_COLORS[d.slot]}
                            fillOpacity={0.12}
                            strokeWidth={2}
                            dot={false}
                          />
                        ))}
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: "oklch(0.21 0.014 235)", border: "1px solid oklch(0.32 0.015 235)", borderRadius: 8, fontSize: 12 }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {detailed.length >= 2 ? (
            <>
              <Card className="bg-card/70">
                <CardContent className="p-5">
                  <h3 className="font-semibold text-sm mb-3">Key metrics side by side</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                        <CartesianGrid stroke="oklch(0.32 0.015 235)" strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "oklch(0.688 0.012 235)" }} />
                        <YAxis tick={{ fontSize: 10, fill: "oklch(0.688 0.012 235)" }} />
                        <Tooltip contentStyle={{ background: "oklch(0.21 0.014 235)", border: "1px solid oklch(0.32 0.015 235)", borderRadius: 8, fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Usable Wh" fill="#34d399" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Charge min" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="$ / kWh·life" fill="#fb923c" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Recommendation */}
              <Card className="bg-card/70 border-primary/25">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="h-4 w-4 text-accent" />
                    <h3 className="font-semibold text-sm">Platform recommendation</h3>
                  </div>
                  {(() => {
                    const viable = detailed.filter(({ d }) => d.failCount === 0);
                    const pool = viable.length > 0 ? viable : detailed;
                    const winner = pool.reduce((a, b) => (b.d.totalScore > a.d.totalScore ? b : a));
                    const runnerUp = pool.filter((p) => p !== winner).sort((a, b) => b.d.totalScore - a.d.totalScore)[0];
                    return (
                      <div className="space-y-2 text-sm leading-relaxed">
                        <p>
                          <span className="font-semibold" style={{ color: SLOT_COLORS[winner.d.slot] }}>
                            {winner.d.label} ({winner.d.cellName}, {winner.d.inputs.series}S{winner.d.inputs.parallel}P, {winner.d.coolingName.split(" (")[0]})
                          </span>{" "}
                          scores highest among{" "}
                          {viable.length > 0
                            ? "violation-free designs"
                            : "the saved designs (none are fully violation-free — treat this as the least-risk option)"}{" "}
                          at <span className="font-mono font-semibold">{winner.d.totalScore.toFixed(0)}/100</span>
                          {runnerUp ? (
                            <>, ahead of {runnerUp.d.label} at {runnerUp.d.totalScore.toFixed(0)}</>
                          ) : null}
                          .
                        </p>
                        <p className="text-muted-foreground text-[13px]">
                          Adoption is recommended <span className="text-foreground">with stated risks</span>: the winner&apos;s weakest
                          axes are {Object.entries(winner.d.scores).sort((a, b) => a[1] - b[1]).slice(0, 2).map(([k, v]) => `${k} (${v.toFixed(0)})`).join(" and ")}.
                          Validate the thermal model against a single-cell bench test before scaling beyond prototype quantities, and
                          re-run the comparison with measured cell data once available.
                        </p>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </>
          ) : null}

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground hover:text-red-400 gap-1.5">
              <Trash2 className="h-3.5 w-3.5" /> Clear all slots
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
