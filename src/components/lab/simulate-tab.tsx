"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Play, Loader2, Activity, Download, Plus, Trash2, ArrowUp, ArrowDown, ListPlus, Sparkles } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import { useLabStore } from "@/lib/lab/store";
import { designIssues, type Profile, type CustomSegment } from "@/lib/lab/engine";
import { usePlayback } from "@/lib/lab/use-playback";
import { SectionTitle, StatCard, StatusBadge, ChartCard, CHART_COLORS, WizardNav } from "./shared";
import { seriesToCsv } from "@/lib/lab/engine";
import { SimBench } from "./sim-bench";

const PROFILES: { id: Profile; label: string; desc: string; socStart: number }[] = [
  { id: "custom", label: "My Custom Sequence", desc: "Build your own current steps", socStart: 1 },
  { id: "discharge", label: "CC Discharge", desc: "Constant current down to Vmin", socStart: 1 },
  { id: "cccv", label: "CC-CV Charge", desc: "CC up to Vmax, then voltage taper", socStart: 0.15 },
  { id: "hppc", label: "HPPC Pulses", desc: "10 s pulse / rest / regen — impedance test", socStart: 0.9 },
  { id: "drive", label: "Drive Cycle", desc: "Urban profile: cruise / accel / brake", socStart: 0.9 },
];

export function SimulateTab() {
  const { design, pack, simParams, setSimParams, lastResult, setLastResult, running, setRunning, updateDesign, sendCopilotMessage, copilotBusy } = useLabStore();
  const { toast } = useToast();
  const [runName, setRunName] = useState("");

  // ---- playback: the recorded test replays like a live bench ----
  const series = lastResult?.series ?? [];
  const pb = usePlayback(series, simParams.ambientC);
  const cur = pb.cur;
  const viewSeries = pb.viewSeries;

  const issues = designIssues(design);
  const segs = simParams.customSegments;
  const segTotalS = segs.reduce((a, s) => a + Math.max(0, s.durationS), 0);

  const setSegs = (next: CustomSegment[]) => setSimParams({ customSegments: next.slice(0, 40) });
  const addSeg = () => setSegs([...segs, { mode: "discharge", currentC: 1, durationS: 300 }]);
  const updSeg = (i: number, patch: Partial<CustomSegment>) =>
    setSegs(segs.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const delSeg = (i: number) => setSegs(segs.filter((_, j) => j !== i));
  const moveSeg = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= segs.length) return;
    const next = [...segs];
    [next[i], next[j]] = [next[j], next[i]];
    setSegs(next);
  };

  const run = async () => {
    if (issues.length > 0) {
      toast({
        title: "Complete your cell design first",
        description: `Missing: ${issues[2] ? issues.slice(0, 3).join("; ") + "…" : issues.join("; ")}`,
        variant: "destructive",
      });
      return;
    }
    if (simParams.profile === "custom" && segs.length === 0) {
      toast({ title: "Empty sequence", description: "Add at least one step to your custom sequence.", variant: "destructive" });
      return;
    }
    setRunning(true);
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          design, pack,
          params: { ...simParams, profile: simParams.profile },
          runName: runName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Simulation failed");
      setLastResult(data);
      toast({ title: "Simulation complete", description: data.summary.cutoff });
    } catch (e) {
      toast({ title: "Simulation error", description: String(e instanceof Error ? e.message : e), variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const exportCsv = () => {
    if (!lastResult) return;
    const csv = seriesToCsv(lastResult.series);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `simulation_${simParams.profile}_${simParams.cRate}C.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const s = lastResult?.summary;
  const fmtT = (v: number) => (v >= 3600 ? `${(v / 3600).toFixed(1)} h` : `${Math.round(v / 60)} min`);

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={<Activity className="h-5 w-5" />}
        title="4 · Battery Simulation"
        desc="Run the electro-thermal model with a test profile. Currents scale with your cell capacity; results show cell and pack behaviour over time."
      />

      {/* Profile picker */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 stagger">
        {PROFILES.map((p) => (
          <button
            key={p.id}
            onClick={() => setSimParams({ profile: p.id, socStart: p.socStart })}
            className={`text-left rounded-lg border p-3 transition-all hover:shadow-sm ${
              simParams.profile === p.id ? "border-primary bg-primary/[0.05] ring-1 ring-primary" : "bg-card"
            }`}
          >
            <div className="font-semibold text-sm">{p.label}</div>
            <div className="text-xs text-muted-foreground mt-1">{p.desc}</div>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Controls */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Test conditions</CardTitle>
            <CardDescription>
              {design.name || "Cell"} · {pack.series}S{pack.parallel}P
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-1.5">
                <Label className="text-xs">C-rate / pulse size</Label>
                <span className="text-xs font-bold text-primary">{simParams.cRate.toFixed(1)}C</span>
              </div>
              <Slider value={[simParams.cRate]} min={0.1} max={10} step={0.1} onValueChange={([v]) => setSimParams({ cRate: v })} />
              <p className="text-[11px] text-muted-foreground mt-1">
                {simParams.profile === "cccv" ? "CC phase charge current" : simParams.profile === "hppc" ? "2C pulse, 1.5C regen" : `≈ ${(simParams.cRate * design.capacityAh).toFixed(1)} A per cell`}
              </p>
            </div>
            <div>
              <div className="flex justify-between mb-1.5">
                <Label className="text-xs">Start SOC</Label>
                <span className="text-xs font-bold text-primary">{(simParams.socStart * 100).toFixed(0)}%</span>
              </div>
              <Slider value={[simParams.socStart * 100]} min={10} max={100} step={5} onValueChange={([v]) => setSimParams({ socStart: v / 100 })} />
            </div>
            <div>
              <div className="flex justify-between mb-1.5">
                <Label className="text-xs">Ambient temperature</Label>
                <span className="text-xs font-bold text-primary">{simParams.ambientC}°C</span>
              </div>
              <Slider value={[simParams.ambientC]} min={-20} max={60} step={1} onValueChange={([v]) => setSimParams({ ambientC: v })} />
            </div>
            <div>
              <div className="flex justify-between mb-1.5">
                <Label className="text-xs">Max duration</Label>
                <span className="text-xs font-bold text-primary">{fmtT(simParams.durationS)}</span>
              </div>
              <Slider value={[simParams.durationS]} min={600} max={43200} step={600} onValueChange={([v]) => setSimParams({ durationS: v })} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Run name (optional)</Label>
              <Input className="mt-1 h-8" placeholder="e.g. Baseline 1C discharge" value={runName} onChange={(e) => setRunName(e.target.value)} />
            </div>
            <Button onClick={run} disabled={running} className="w-full bg-primary hover:bg-primary/90">
              {running ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Play className="h-4 w-4 mr-1.5" />}
              {running ? "Simulating…" : "Run simulation"}
            </Button>
            <button
              onClick={() => sendCopilotMessage("Which test profile and C-rate would you run for my design and application? Explain briefly.")}
              disabled={copilotBusy}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Ask copilot which test to run
            </button>
          </CardContent>
        </Card>

        {/* Custom sequence builder */}
        {simParams.profile === "custom" && (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Custom sequence builder</CardTitle>
                  <CardDescription>Chain discharge / charge / rest steps — total {Math.round(segTotalS / 60)} min</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={addSeg}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add step
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {segs.length === 0 && (
                <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  <ListPlus className="h-5 w-5 mx-auto mb-1.5 text-muted-foreground" />
                  No steps yet — add a discharge, charge or rest step.
                </div>
              )}
              {segs.map((seg, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-2">
                  <span className="text-[11px] tabular-nums text-muted-foreground w-5">{i + 1}.</span>
                  <Select value={seg.mode} onValueChange={(v) => updSeg(i, { mode: v as CustomSegment["mode"] })}>
                    <SelectTrigger className="h-8 w-[120px]" aria-label="Step mode"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="discharge">Discharge</SelectItem>
                      <SelectItem value="charge">Charge</SelectItem>
                      <SelectItem value="rest">Rest</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number" min={0} step={0.1} value={seg.currentC}
                      className="h-8 w-20" aria-label="Step C-rate"
                      disabled={seg.mode === "rest"}
                      onChange={(e) => updSeg(i, { currentC: Math.max(0, parseFloat(e.target.value) || 0) })}
                    />
                    <span className="text-[11px] text-muted-foreground">C</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number" min={1} step={30} value={seg.durationS}
                      className="h-8 w-24" aria-label="Step duration in seconds"
                      onChange={(e) => updSeg(i, { durationS: Math.max(1, parseFloat(e.target.value) || 1) })}
                    />
                    <span className="text-[11px] text-muted-foreground">s</span>
                  </div>
                  <div className="ml-auto flex items-center gap-0.5">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveSeg(i, -1)} disabled={i === 0} aria-label="Move step up">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveSeg(i, 1)} disabled={i === segs.length - 1} aria-label="Move step down">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => delSeg(i)} aria-label={`Delete step ${i + 1}`}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Summary */}
        <Card className={simParams.profile === "custom" ? "hidden" : "lg:col-span-2"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Result summary</CardTitle>
            <CardDescription>{s ? s.cutoff : "Run a simulation to see results"}</CardDescription>
          </CardHeader>
          <CardContent>
            {s ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 stagger">
                  {/* Engine computes 20 metrics in RunSummary — surfaced here in full
                      so the UI matches the technical report's claim. The first row is
                      the primary 12 (energy, capacity, voltage, temperature, power);
                      the second row is the remaining 8 (start/end, heat, cutoff). */}
                  <StatCard label="Throughput" value={s.capacityAh} unit="Ah" hint="charge moved" />
                  <StatCard
                    label={simParams.profile === "cccv" ? "Energy in" : "Energy out"}
                    value={Math.abs(s.energyWh).toFixed(1)}
                    unit="Wh"
                  />
                  <StatCard label="Pack energy" value={s.packEnergyWh} unit="Wh" hint={`${pack.series}S${pack.parallel}P`} />
                  <StatCard label="Avg power" value={s.avgPowerW} unit="W" hint={`peak ${s.peakPowerW} W`} />
                  <StatCard label="SOC window" value={`${s.socStart}→${s.socEnd}`} unit="%" />
                  <StatCard label="V cell range" value={`${s.vMin.toFixed(2)}–${s.vMax.toFixed(2)}`} unit="V" />
                  <StatCard label="Peak temp" value={s.tempMaxC} unit="°C" tone={s.tempMaxC > 60 ? "fail" : s.tempMaxC > 45 ? "warn" : "default"} hint={`ΔT +${s.deltaT} K`} />
                  <StatCard label="Heat generated" value={s.heatWh} unit="Wh" />
                  {s.efficiency !== null && <StatCard label="Regen recovery" value={s.efficiency} unit="%" hint="charge vs discharge energy" />}
                  <StatCard label="Test time" value={fmtT(s.durationS)} />
                  <StatCard label="Pack capacity" value={s.packCapacityAh} unit="Ah" />
                  <StatCard label="V end" value={s.vEnd.toFixed(2)} unit="V" />
                  {/* Remaining 8 metrics — completes the 20-metric RunSummary panel
                      and removes the "report says 20 / UI shows 12" inconsistency. */}
                  <StatCard label="V start" value={s.vStart.toFixed(2)} unit="V" />
                  <StatCard label="V max" value={s.vMax.toFixed(2)} unit="V" />
                  <StatCard label="V min" value={s.vMin.toFixed(2)} unit="V" />
                  <StatCard label="Temp start" value={s.tempStartC} unit="°C" />
                  <StatCard label="Temp end" value={s.tempEndC} unit="°C" hint={`ΔT +${s.deltaT} K`} />
                  <StatCard label="Peak power" value={s.peakPowerW} unit="W" />
                  <StatCard label="SOC start" value={s.socStart} unit="%" />
                  <StatCard label="SOC end" value={s.socEnd} unit="%" />
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{PROFILES.find((p) => p.id === simParams.profile)?.label}</Badge>
                  <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/40">Cutoff: {s.cutoff}</Badge>
                  <Button size="sm" variant="outline" onClick={exportCsv}>
                    <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
                  </Button>
                </div>
              </>
            ) : (
              <div className="h-40 grid place-items-center text-sm text-muted-foreground">
                No results yet — press “Run simulation”.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cell model parameters — relocated from the (now mechanical-only) Modeling tab */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Cell model parameters — 2RC Thevenin (per cell)</CardTitle>
          <CardDescription>
            V = OCV(SOC) − I·R₀ − V_C1 − V_C2 · R₀ from the HPPC instantaneous step, R₁/C₁ fast recovery, R₂/C₂ slow tail. Set R₁/R₂ to 0 for a simple Rint model.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3 stagger">
          <PField label="R₀ (mΩ)" value={+(design.r0 * 1000).toFixed(2)} onChange={(v) => updateDesign({ r0: v / 1000 })} />
          <PField label="R₁ (mΩ)" value={+(design.r1 * 1000).toFixed(2)} onChange={(v) => updateDesign({ r1: v / 1000 })} />
          <PField label="C₁ (F)" value={design.c1} onChange={(v) => updateDesign({ c1: v })} />
          <PField label="R₂ (mΩ)" value={+(design.r2 * 1000).toFixed(2)} onChange={(v) => updateDesign({ r2: v / 1000 })} />
          <PField label="C₂ (F)" value={design.c2} onChange={(v) => updateDesign({ c2: v })} />
          <div className="col-span-2 md:col-span-5 rounded-lg bg-muted/60 p-2.5 text-[11px] text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">State-space: </span>
            SOĊ = −I/(3600·Q) · V̇_C1 = −V_C1/(R₁C₁) + I/C₁ · V̇_C2 = −V_C2/(R₂C₂) · Euler integration, Δt = 1 s.
            Current parameters: R₀ {(design.r0 * 1000).toFixed(1)} mΩ · τ₁ {(design.r1 * design.c1).toFixed(1)} s · τ₂ {(design.r2 * design.c2).toFixed(0)} s.
          </div>
        </CardContent>
      </Card>

      {/* Custom-profile summary strip */}
      {simParams.profile === "custom" && s && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3">
          <Badge variant="outline" className="text-xs">My Custom Sequence</Badge>
          <span className="text-sm"><b>{s.capacityAh}</b> Ah · <b>{Math.abs(s.energyWh).toFixed(1)}</b> Wh · peak <b>{s.tempMaxC}</b>°C</span>
          <span className="text-xs text-muted-foreground">{s.cutoff}</span>
          <Button size="sm" variant="outline" className="ml-auto" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
          </Button>
        </div>
      )}

      {/* Animated live test bench — replays the recorded run like a real cycler */}
      {series.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Live test bench — animated playback</CardTitle>
            <CardDescription>
              Your run replayed as a real test: cycler → cell → gauges. Play, scrub, change speed — charts follow along.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SimBench
              series={series}
              cur={cur}
              tick={pb.tick}
              playing={pb.playing}
              speed={pb.speed}
              syncCharts={pb.syncCharts}
              design={design}
              pack={pack}
              coolingOn={simParams.coolingOn}
              hConv={simParams.hConv}
              ambientC={simParams.ambientC}
              onPlayPause={pb.toggle}
              onRestart={pb.restart}
              onSpeed={pb.setSpeed}
              onScrub={pb.scrub}
              onSyncToggle={pb.setSyncCharts}
            />
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      {series.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-4">
          <ChartCard title="Cell & pack voltage">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={viewSeries} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="t" tick={{ fontSize: 11 }} unit=" s" />
                <YAxis yAxisId="v" tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                <YAxis yAxisId="vp" orientation="right" tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                <Tooltip labelFormatter={(l) => `t = ${l} s`} />
                <Legend />
                <ReferenceLine yAxisId="v" y={design.vmin} stroke={CHART_COLORS.red} strokeDasharray="4 4" label={{ value: "Vmin", fontSize: 10 }} />
                {simParams.profile !== "discharge" && (
                  <ReferenceLine yAxisId="v" y={design.vmax} stroke={CHART_COLORS.amber} strokeDasharray="4 4" label={{ value: "Vmax", fontSize: 10 }} />
                )}
                <Line yAxisId="v" type="monotone" dataKey="vCell" name="Cell V" stroke={CHART_COLORS.blue} dot={false} strokeWidth={2} />
                <Line yAxisId="vp" type="monotone" dataKey="vPack" name={`Pack V (${pack.series}S)`} stroke={CHART_COLORS.cyan} dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="State of charge">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={viewSeries} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="t" tick={{ fontSize: 11 }} unit=" s" />
                <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                <Tooltip labelFormatter={(l) => `t = ${l} s`} />
                <Legend />
                <Line type="monotone" dataKey="soc" name="SOC" stroke={CHART_COLORS.violet} dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Current profile">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={viewSeries} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="t" tick={{ fontSize: 11 }} unit=" s" />
                <YAxis tick={{ fontSize: 11 }} unit=" A" />
                <Tooltip labelFormatter={(l) => `t = ${l} s`} />
                <Legend />
                <Line type="stepAfter" dataKey="iCell" name="Cell current" stroke={CHART_COLORS.slate} dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Temperature & heat generation">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={viewSeries} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="t" tick={{ fontSize: 11 }} unit=" s" />
                <YAxis yAxisId="t" tick={{ fontSize: 11 }} domain={["auto", "auto"]} unit="°C" />
                <YAxis yAxisId="q" orientation="right" tick={{ fontSize: 11 }} unit=" W" />
                <Tooltip labelFormatter={(l) => `t = ${l} s`} />
                <Legend />
                <ReferenceLine yAxisId="t" y={45} stroke={CHART_COLORS.amber} strokeDasharray="4 4" label={{ value: "45°C", fontSize: 10 }} />
                <ReferenceLine yAxisId="t" y={60} stroke={CHART_COLORS.red} strokeDasharray="4 4" label={{ value: "60°C", fontSize: 10 }} />
                <Line yAxisId="t" type="monotone" dataKey="tempC" name="Cell temp" stroke={CHART_COLORS.red} dot={false} strokeWidth={2} />
                <Line yAxisId="q" type="monotone" dataKey="qGen" name="Heat gen" stroke={CHART_COLORS.amber} dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {/* Safety checks */}
      {lastResult && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Safety & limit checks</CardTitle>
            <CardDescription>Automatic checks against datasheet limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {lastResult.checks.map((c) => (
              <div key={c.label} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <div>
                  <div className="text-sm font-medium">{c.label}</div>
                  <div className="text-xs text-muted-foreground">{c.detail}</div>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Wizard: Simulation → Thermal carries the profile and its result */}
      <WizardNav
        step={3}
        summary={
          <>{PROFILES.find((p) => p.id === simParams.profile)?.label ?? simParams.profile} @ {simParams.cRate}C carried into Thermal{lastResult ? <span className="text-emerald-600"> · run result available</span> : null}</>
        }
      />
    </div>
  );
}

function PField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        className="mt-1 h-8"
        type="number"
        step="any"
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v) && v >= 0) onChange(v);
        }}
      />
    </div>
  );
}
