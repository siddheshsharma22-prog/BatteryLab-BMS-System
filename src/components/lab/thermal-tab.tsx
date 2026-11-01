"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Thermometer, Loader2, Snowflake, Flame, TriangleAlert, Sparkles, Boxes } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import { useLabStore } from "@/lib/lab/store";
import { designIssues } from "@/lib/lab/engine";
import { usePlayback } from "@/lib/lab/use-playback";
import { SectionTitle, StatCard, ChartCard, CHART_COLORS, COOLING_PRESETS, WizardNav, PlaybackBar, fmtClock } from "./shared";
import { PackThermalMap } from "./pack-thermal-map";
import { cn } from "@/lib/utils";

// 3D thermal simulation of the whole pack — client-only (WebGL), code-split
const PackThermal3D = dynamic(() => import("./pack-thermal-3d"), {
  ssr: false,
  loading: () => <div className="h-[400px] rounded-lg border bg-slate-100 dark:bg-slate-900 animate-pulse" />,
});

export function ThermalTab() {
  const { design, pack, simParams, setSimParams, lastResult, setLastResult, running, setRunning, sendCopilotMessage, copilotBusy } = useLabStore();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const issues = designIssues(design);
  const h = simParams.coolingOn ? simParams.hConv : 0;
  const activePreset = COOLING_PRESETS.find((p) => p.h === h);

  const runThermal = async () => {
    if (issues.length > 0) {
      toast({
        title: "Complete your cell design first",
        description: `Missing: ${issues.slice(0, 3).join("; ")}${issues.length > 3 ? "…" : ""}`,
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    setRunning(true);
    try {
      // thermal test = 1C discharge with the configured thermal environment
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          design, pack,
          params: { ...simParams, profile: "discharge", cRate: Math.max(1, simParams.cRate), durationS: 7200 },
          runName: `Thermal test ${activePreset?.label ?? `h=${h}`}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Thermal test failed");
      setLastResult(data);
      toast({ title: "Thermal test complete", description: `Peak ${data.summary.tempMaxC}°C · ΔT +${data.summary.deltaT} K` });
    } catch (e) {
      toast({ title: "Thermal test error", description: String(e instanceof Error ? e.message : e), variant: "destructive" });
    } finally {
      setBusy(false);
      setRunning(false);
    }
  };

  const s = lastResult?.summary;
  const series = lastResult?.series ?? [];
  // Live playback: scopes, the pack map and every thermal chart follow one clock
  const pb = usePlayback(series, simParams.ambientC);
  const peak = s?.tempMaxC ?? simParams.ambientC;
  const status =
    peak > 130 ? { label: "THERMAL RUNAWAY RISK", tone: "fail" as const, desc: "≥130°C separator collapse / runaway onset" }
    : peak > 60 ? { label: "FAIL — OVERTEMPERATURE", tone: "fail" as const, desc: ">60°C accelerates degradation, gas generation" }
    : peak > 45 ? { label: "WARN — HOT", tone: "warn" as const, desc: "OK for discharge, too hot for charging" }
    : { label: "PASS — SAFE BAND", tone: "ok" as const, desc: "Within 15–35°C optimal window (or below)" };

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={<Thermometer className="h-5 w-5" />}
        title="5 · Thermal Testing"
        desc="Heat generation follows the Bernardi equation (Joule + polarization + entropic terms); cell temperature is a lumped mass cooled by convection h·A·ΔT. Test the cell at 1C under your cooling setup and watch the limits."
      />

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Thermal environment */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Snowflake className="h-4 w-4 text-primary" /> Cooling environment</CardTitle>
            <CardDescription>Choose a management strategy or tune h manually</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {COOLING_PRESETS.map((p) => (
                <Button
                  key={p.label}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-auto py-2 flex-col items-start gap-0.5",
                    (p.h === 0 && !simParams.coolingOn) || (p.h > 0 && simParams.coolingOn && simParams.hConv === p.h)
                      ? "border-primary bg-primary/[0.05] text-primary"
                      : ""
                  )}
                  onClick={() =>
                    p.h === 0
                      ? setSimParams({ coolingOn: false })
                      : setSimParams({ coolingOn: true, hConv: p.h })
                  }
                >
                  <span className="text-xs font-medium">{p.label}</span>
                  <span className="text-[10px] text-muted-foreground">h = {p.h} W/m²K</span>
                </Button>
              ))}
            </div>
            <div>
              <div className="flex justify-between mb-1.5">
                <Label className="text-xs">Convection coefficient h</Label>
                <span className="text-xs font-bold text-primary">{h} W/m²K</span>
              </div>
              <Slider
                value={[h]}
                min={0}
                max={200}
                step={1}
                onValueChange={([v]) => setSimParams({ coolingOn: v > 0, hConv: v })}
              />
            </div>
            <div>
              <div className="flex justify-between mb-1.5">
                <Label className="text-xs">Ambient temperature</Label>
                <span className="text-xs font-bold text-primary">{simParams.ambientC}°C</span>
              </div>
              <Slider value={[simParams.ambientC]} min={-20} max={60} step={1} onValueChange={([v]) => setSimParams({ ambientC: v })} />
            </div>
            <div className="rounded-lg bg-muted/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Thermal model: </span>
              m·Cp·dT/dt = I²R₀ + V²_C1/R₁ + V²_C2/R₂ + I·T·(dU/dT) − h·A·(T − T_amb).
              Limits: charge 0–45°C · discharge ≤ 60°C · runaway onset ≈ 130°C.
            </div>
            <Button onClick={runThermal} disabled={busy} className="w-full bg-primary hover:bg-primary/90">
              {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Flame className="h-4 w-4 mr-1.5" />}
              {busy ? "Running thermal test…" : "Run 1C thermal test"}
            </Button>
            <button
              onClick={() => sendCopilotMessage("Which cooling strategy fits my design and duty? Consider my cell's heat generation and application.")}
              disabled={copilotBusy}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Ask copilot about cooling
            </button>
          </CardContent>
        </Card>

        {/* Status */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Thermal verdict</CardTitle>
            <CardDescription>{s ? `${design.name} at ${simParams.cRate.toFixed(1)}C · ${activePreset?.label ?? "custom cooling"}` : "Run the thermal test to evaluate"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={cn(
                "rounded-xl border-2 p-4 flex items-center gap-4",
                status.tone === "ok" && "border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10",
                status.tone === "warn" && "border-amber-400 bg-amber-50 dark:bg-amber-500/10",
                status.tone === "fail" && "border-red-400 bg-red-50 dark:bg-red-500/10"
              )}
            >
              {status.tone === "fail" ? (
                <TriangleAlert className="h-10 w-10 text-red-600 shrink-0" />
              ) : (
                <Thermometer className={cn("h-10 w-10 shrink-0", status.tone === "ok" ? "text-emerald-600" : "text-amber-600")} />
              )}
              <div>
                <div className={cn("font-bold text-lg", status.tone === "ok" ? "text-emerald-800 dark:text-emerald-300" : status.tone === "warn" ? "text-amber-800 dark:text-amber-300" : "text-red-800 dark:text-red-300")}>
                  {status.label}
                </div>
                <div className="text-sm text-muted-foreground">{status.desc}</div>
              </div>
            </div>

            {s ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger">
                <StatCard label="Peak temp" value={s.tempMaxC} unit="°C" tone={s.tempMaxC > 60 ? "fail" : s.tempMaxC > 45 ? "warn" : "default"} />
                <StatCard label="ΔT rise" value={`+${s.deltaT}`} unit="K" />
                <StatCard label="End temp" value={s.tempEndC} unit="°C" hint={s.tempEndC < s.tempMaxC - 0.5 ? "cooling down" : "still heating"} />
                <StatCard label="Heat wasted" value={s.heatWh} unit="Wh" hint={`${((s.heatWh / Math.max(1, Math.abs(s.energyWh))) * 100).toFixed(0)}% of delivered energy`} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No thermal data yet. Configure cooling on the left, then run the test — the chart will show temperature against the 45/60/130°C limits.</p>
            )}

            {s && s.deltaT > 20 && s.tempMaxC > 60 && (
              <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10 p-3 text-sm text-red-800 dark:text-red-300">
                <span className="font-semibold">Recommendation:</span> this test overheats the cell. Try “Forced air” or “Liquid cold plate”, or lower the C-rate — and verify charging is blocked above 45°C in your BMS logic.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 3D thermal simulation — the whole pack, temperature-coloured, driven by the shared clock */}
      {series.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Boxes className="h-4 w-4 text-primary" /> 3D thermal simulation — {pack.series}S{pack.parallel}P full pack</CardTitle>
            <CardDescription>
              Every cell coloured by its modelled temperature as the thermal test replays — airflow gradient, heat glow and cooling stream included.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PackThermal3D
              design={design}
              series={pack.series}
              parallel={pack.parallel}
              tMean={pb.cur.tempC}
              ambientC={simParams.ambientC}
              hConv={simParams.hConv}
              coolingOn={simParams.coolingOn}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Boxes className="h-4 w-4 text-primary" /> 3D thermal simulation</CardTitle>
            <CardDescription>Run the 1C thermal test — the full pack is then rendered in 3D with live per-cell temperatures.</CardDescription>
          </CardHeader>
          <CardContent>
            <PackThermal3D
              design={design}
              series={pack.series}
              parallel={pack.parallel}
              tMean={simParams.ambientC}
              ambientC={simParams.ambientC}
              hConv={simParams.hConv}
              coolingOn={simParams.coolingOn}
            />
          </CardContent>
        </Card>
      )}

      {/* Live pack thermal map — every cell of the S×P pack, follows playback */}
      {series.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Live pack thermal map — {pack.series}S{pack.parallel}P</CardTitle>
            <CardDescription>
              Every cell of your pack, coloured by temperature as the test replays. Downstream-of-airflow cells run hotter; the hottest and coldest cells are ringed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PackThermalMap
              design={design}
              series={pack.series}
              parallel={pack.parallel}
              cur={pb.cur}
              ambientC={simParams.ambientC}
              hConv={simParams.hConv}
              coolingOn={simParams.coolingOn}
            />
          </CardContent>
        </Card>
      )}

      {/* Thermal charts — live scopes driven by the shared playback clock */}
      {series.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Scope playback — replay the thermal test in real time</CardTitle>
            <CardDescription>One clock drives the scopes below and the pack map above, like a scope triggering on the recorded run.</CardDescription>
          </CardHeader>
          <CardContent>
            <PlaybackBar
              tick={pb.tick}
              len={pb.length}
              playing={pb.playing}
              speed={pb.speed}
              syncCharts={pb.syncCharts}
              clock={<>{fmtClock(pb.cur.t)} / {fmtClock(series[series.length - 1]?.t ?? 0)}</>}
              onPlayPause={pb.toggle}
              onRestart={pb.restart}
              onSpeed={pb.setSpeed}
              onScrub={pb.scrub}
              onSyncToggle={pb.setSyncCharts}
            />
          </CardContent>
        </Card>
      )}

      {/* Thermal charts */}
      {series.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title={pb.syncCharts ? "Scope — cell temperature vs limits (live)" : "Scope — cell temperature vs limits"}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pb.viewSeries} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="t" tick={{ fontSize: 11 }} unit=" s" />
                <YAxis tick={{ fontSize: 11 }} unit="°C" domain={["auto", "auto"]} />
                <Tooltip labelFormatter={(l) => `t = ${l} s`} />
                <Legend />
                <ReferenceLine y={45} stroke={CHART_COLORS.amber} strokeDasharray="4 4" label={{ value: "45°C charge limit", fontSize: 10, position: "insideTopLeft" }} />
                <ReferenceLine y={60} stroke={CHART_COLORS.red} strokeDasharray="4 4" label={{ value: "60°C discharge limit", fontSize: 10, position: "insideTopLeft" }} />
                <ReferenceLine y={130} stroke="#7f1d1d" strokeDasharray="6 3" label={{ value: "130°C runaway", fontSize: 10, position: "insideTopLeft" }} />
                <Line type="monotone" dataKey="tempC" name="Cell temp" stroke={CHART_COLORS.red} dot={false} strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title={pb.syncCharts ? "Scope — heat generation rate, Bernardi (live)" : "Scope — heat generation rate, Bernardi"}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pb.viewSeries} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="t" tick={{ fontSize: 11 }} unit=" s" />
                <YAxis tick={{ fontSize: 11 }} unit=" W" />
                <Tooltip labelFormatter={(l) => `t = ${l} s`} />
                <Legend />
                <Line type="monotone" dataKey="qGen" name="Q gen (cell)" stroke={CHART_COLORS.amber} dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {/* Wizard: Thermal → Monitor carries the thermal result */}
      <WizardNav
        step={4}
        summary={
          <>{activePreset?.label ?? (simParams.coolingOn ? `h = ${simParams.hConv} W/m²K` : "adiabatic")} environment{series.length > 0 ? <span className="text-emerald-600"> · thermal result ready for Monitor</span> : null}</>
        }
      />
    </div>
  );
}
