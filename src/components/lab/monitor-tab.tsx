"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, ArrowRight, GaugeCircle, Radar, ShieldCheck, TriangleAlert, Usb, Zap } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import { useLabStore } from "@/lib/lab/store";
import { usePlayback } from "@/lib/lab/use-playback";
import { cellTemps, cellVoltages, tempColor, MAX_RENDERED_CELLS } from "@/lib/lab/pack";
import { SectionTitle, ChartCard, CHART_COLORS, WizardNav, PlaybackBar, fmtClock, StatCard } from "./shared";
import { HardwareMonitor } from "./monitor-hardware";
import { cn } from "@/lib/utils";

// ============================================================
// MonitorTab — live BMS-style battery monitoring dashboard.
// Replays the latest run in real time like a pack telemetry feed:
// contactors, per-cell V/T matrix, balancing, streaming charts
// and live limit alerts. Everything shares the playback clock.
// ============================================================

interface Alert { level: "ok" | "warn" | "fail"; text: string }

export function MonitorTab() {
  const { design, pack, lastResult, simParams, setActiveTab } = useLabStore();
  // Two telemetry sources: replay the latest simulation run, or a real BMS
  // over a COM port (CAN / RS485 / UART via the Web Serial API).
  const [source, setSource] = useState<"simulation" | "hardware">("simulation");
  const series = lastResult?.series ?? [];
  const pb = usePlayback(series, simParams.ambientC);
  const cur = pb.cur;

  const soc = cur.soc / 100; // engine always reports percent (0–100)
  const I = cur.iCell;
  const V = cur.vCell;
  const T = cur.tempC;

  const total = pack.series * pack.parallel;
  const shown = Math.min(total, MAX_RENDERED_CELLS);

  const temps = useMemo(
    () => cellTemps(T, simParams.ambientC, shown, { hConv: simParams.coolingOn ? simParams.hConv : 0, cols: Math.min(pack.series, 14), rows: Math.ceil(shown / Math.min(pack.series, 14)) }),
    [T, simParams.ambientC, simParams.coolingOn, simParams.hConv, shown, pack.series]
  );
  const volts = useMemo(
    () => cellVoltages(V, shown, soc, I, design.capacityAh),
    [V, shown, soc, I, design.capacityAh]
  );

  const vHi = volts.reduce((m, v, i) => (v > volts[m] ? i : m), 0);
  const vLo = volts.reduce((m, v, i) => (v < volts[m] ? i : m), 0);
  const tHi = temps.reduce((m, t, i) => (t > temps[m] ? i : m), 0);
  const tLo = temps.reduce((m, t, i) => (t < temps[m] ? i : m), 0);
  const tSpread = temps.length ? temps[tHi] - temps[tLo] : 0;

  const mode =
    I > 0.05 ? { label: "DISCHARGING", cls: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300", dot: "#d97706" }
    : I < -0.05 ? { label: "CHARGING", cls: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300", dot: "#059669" }
    : { label: "IDLE / REST", cls: "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300", dot: "#64748b" };

  // ---- live limit alerts (BMS logic) ----
  const alerts: Alert[] = [];
  if (V >= design.vmax - 0.02) alerts.push({ level: V > design.vmax ? "fail" : "warn", text: `Cell over-voltage: ${V.toFixed(3)} V ≥ Vmax ${design.vmax.toFixed(2)} V` });
  if (V <= design.vmin + 0.02) alerts.push({ level: V < design.vmin ? "fail" : "warn", text: `Cell under-voltage: ${V.toFixed(3)} V ≤ Vmin ${design.vmin.toFixed(2)} V` });
  if (T > 60) alerts.push({ level: "fail", text: `Over-temperature: ${T.toFixed(1)} °C > 60 °C discharge limit` });
  else if (T > 45) alerts.push({ level: "warn", text: `Hot: ${T.toFixed(1)} °C — above the 45 °C charge limit` });
  if (I < -0.05 && T > design.chargeTempMaxC) alerts.push({ level: "fail", text: `Charging blocked in a real BMS: ${T.toFixed(1)} °C > charge max ${design.chargeTempMaxC} °C` });
  if (tSpread > 5) alerts.push({ level: "warn", text: `Pack imbalance: ΔT ${tSpread.toFixed(1)} K between hottest and coldest cell` });
  if (soc <= 0.001 && I > 0.05) alerts.push({ level: "warn", text: "Pack empty — SOC 0%, disconnect the load" });
  const worst = alerts.some((a) => a.level === "fail") ? "fail" : alerts.some((a) => a.level === "warn") ? "warn" : "ok";

  // contactors: closed while the test draws/supplies current; precharge only at start
  const mainClosed = series.length > 0;
  const prechargeClosed = cur.t <= 3;
  const packPower = V * I * pack.parallel;

  const frac = pb.length > 1 ? pb.tick / (pb.length - 1) : 0;

  const packWh = design.nominalV * pack.series * design.capacityAh * pack.parallel;

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={<Radar className="h-5 w-5" />}
        title="6 · Battery Monitoring"
        desc="Live pack telemetry from two sources: replay the latest simulation run, or connect a real BMS over CAN / RS485 / UART."
      />

      {/* Data source switcher — simulation telemetry or live hardware BMS */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-baseline gap-2 mb-3">
            <span className="text-sm font-semibold">Data source</span>
            <span className="text-xs text-muted-foreground">— choose where the monitor streams from</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={() => setSource("simulation")}
              className={cn(
                "text-left rounded-lg border p-3.5 transition-all hover:shadow-sm",
                source === "simulation" ? "border-primary bg-primary/[0.05] ring-1 ring-primary" : "bg-card"
              )}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Activity className="h-4 w-4 text-primary" /> 1 · Simulation monitoring
              </div>
              <div className="text-[11px] text-muted-foreground mt-1 leading-snug">
                Replays the latest simulation / thermal run on the shared playback clock — gauges, per-cell matrix, contactors, alerts and streaming charts.
                {lastResult ? <span className="text-emerald-600 dark:text-emerald-400 font-medium"> Run ready.</span> : <span className="text-amber-600 dark:text-amber-400 font-medium"> No run yet.</span>}
              </div>
            </button>
            <button
              onClick={() => setSource("hardware")}
              className={cn(
                "text-left rounded-lg border p-3.5 transition-all hover:shadow-sm",
                source === "hardware" ? "border-primary bg-primary/[0.05] ring-1 ring-primary" : "bg-card"
              )}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Usb className="h-4 w-4 text-primary" /> 2 · Live hardware BMS
              </div>
              <div className="text-[11px] text-muted-foreground mt-1 leading-snug">
                Select a COM port and stream real telemetry from your BMS over CAN, RS485 (Modbus RTU) or UART — live values, RX frame log and protocol reference.
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {source === "hardware" ? (
        <>
          <HardwareMonitor design={design} pack={pack} />
          <WizardNav step={5} summary="live BMS telemetry over CAN / RS485 / UART" />
        </>
      ) : !lastResult ? (
        <>
          <Card>
            <CardContent className="py-14 text-center space-y-3">
              <GaugeCircle className="h-10 w-10 mx-auto text-muted-foreground" />
              <div className="text-sm font-medium">No pack is on the bench yet</div>
              <p className="text-[13px] text-muted-foreground max-w-md mx-auto">
                The simulation monitor streams live telemetry from a run. Run a test in Simulation (or a thermal test in Thermal), then come back — or switch to the live hardware BMS source above.
              </p>
              <Button onClick={() => setActiveTab("simulate")} className="bg-primary hover:bg-primary/90">
                Go to Simulation <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </CardContent>
          </Card>
          <WizardNav step={5} summary="monitoring goes live once a run exists" />
        </>
      ) : (
        <>
      {/* Status banner */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold", mode.cls)}>
              <i className={cn("h-2 w-2 rounded-full", pb.playing && "animate-pulse")} style={{ background: mode.dot }} />
              {mode.label}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground font-medium">
              t = {fmtClock(cur.t)} / {fmtClock(series[series.length - 1]?.t ?? 0)} · {pack.series}S{pack.parallel}P · {design.name || design.chemistry}
            </span>
            <Badge variant="outline" className={worst === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300" : worst === "warn" ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300" : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"}>
              {worst === "ok" ? (<><ShieldCheck className="h-3 w-3 mr-0.5" /> ALL SYSTEMS NORMAL</>) : worst === "warn" ? (<><TriangleAlert className="h-3 w-3 mr-0.5" /> {alerts.length} WARNING{alerts.length > 1 ? "S" : ""}</>) : (<><TriangleAlert className="h-3 w-3 mr-0.5" /> FAULT — {alerts.filter((a) => a.level === "fail").length} ACTIVE</>)}
            </Badge>
            {simParams.coolingOn && (
              <Badge variant="outline" className="border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-300">
                COOLING h = {simParams.hConv} W/m²K
              </Badge>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${Math.max(1.5, frac * 100)}%` }} />
          </div>
          <PlaybackBar
            tick={pb.tick}
            len={pb.length}
            playing={pb.playing}
            speed={pb.speed}
            syncCharts={pb.syncCharts}
            clock={<>{fmtClock(cur.t)} elapsed</>}
            onPlayPause={pb.toggle}
            onRestart={pb.restart}
            onSpeed={pb.setSpeed}
            onScrub={pb.scrub}
            onSyncToggle={pb.setSyncCharts}
          />
        </CardContent>
      </Card>

      {/* Live gauges */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 stagger">
        <StatCard label="Pack voltage" value={cur.vPack.toFixed(1)} unit="V" hint={`${V.toFixed(3)} V/cell`} />
        <StatCard label="Pack current" value={(Math.abs(I) * pack.parallel).toFixed(1)} unit="A" hint={`${I >= 0 ? "discharge" : I < 0 ? "charge" : "rest"} ${Math.abs(I).toFixed(2)} A/cell`} />
        <StatCard label="SOC" value={(soc * 100).toFixed(1)} unit="%" tone={soc < 0.15 ? "warn" : "default"} hint={`${(design.capacityAh * pack.parallel * soc).toFixed(1)} of ${(design.capacityAh * pack.parallel).toFixed(1)} Ah`} />
        <StatCard label="Pack power" value={Math.abs(packPower).toFixed(0)} unit="W" hint={packPower >= 0 ? "delivering" : "absorbing"} />
        <StatCard label="Cell temp" value={T.toFixed(1)} unit="°C" tone={T > 60 ? "fail" : T > 45 ? "warn" : "default"} hint={`max ${temps[tHi]?.toFixed(1)}° · min ${temps[tLo]?.toFixed(1)}°`} />
        <StatCard label="ΔT spread" value={tSpread.toFixed(1)} unit="K" tone={tSpread > 5 ? "warn" : "default"} hint={tSpread > 5 ? "imbalance" : "in band"} />
        <StatCard label="Cell V max/min" value={volts.length ? `${volts[vHi].toFixed(3)}/${volts[vLo].toFixed(3)}` : "—"} unit="V" hint="highest / lowest cell" />
        <StatCard label="Energy remaining" value={(packWh * soc).toFixed(0)} unit="Wh" hint={`of ${packWh.toFixed(0)} Wh nominal`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Per-cell live matrix */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Cell matrix — live V & T per cell</CardTitle>
            <CardDescription>
              Fill colour = temperature · hover a cell for exact values{mode.label === "CHARGING" ? " · amber dot = balancing active" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(48px, 1fr))" }}>
              {Array.from({ length: shown }, (_, i) => {
                const gi = Math.floor(i / pack.parallel);
                const pi = i % pack.parallel;
                const t = temps[i];
                const v = volts[i];
                const balancing = mode.label === "CHARGING" && soc > 0.8 && v > V + 0.002;
                return (
                  <div
                    key={i}
                    title={`S${gi + 1}P${pi + 1} · ${v.toFixed(3)} V · ${t.toFixed(2)} °C · SOC ${(soc * 100).toFixed(0)}%`}
                    className={cn(
                      "relative rounded-md border px-1 py-1 text-center",
                      (i === tHi || i === vHi) && "ring-2 ring-red-400",
                      (i === tLo || i === vLo) && "ring-2 ring-cyan-500"
                    )}
                    style={{ background: tempColor(t, simParams.ambientC), borderColor: "rgba(15,23,42,0.15)" }}
                  >
                    {balancing && <i className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-amber-300 animate-pulse" title="balancing" />}
                    <div className="text-[8px] font-bold text-slate-900/80 leading-none">S{gi + 1}P{pi + 1}</div>
                    <div className="text-[10px] font-extrabold text-slate-900 leading-tight">{t.toFixed(1)}°</div>
                    <div className="text-[8px] font-semibold text-slate-900/80 leading-none">{v.toFixed(3)}V</div>
                  </div>
                );
              })}
            </div>
            {shown < total && (
              <p className="mt-2 text-[10px] text-muted-foreground">Showing the first {shown} of {total} cells (render cap).</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
              <span>V spread {volts.length ? `${volts[vLo].toFixed(3)}–${volts[vHi].toFixed(3)} V` : "—"}</span>
              <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full ring-2 ring-red-400 bg-card" /> hottest / highest V</span>
              <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full ring-2 ring-cyan-500 bg-card" /> coldest / lowest V</span>
              <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-amber-300" /> balancing</span>
            </div>
          </CardContent>
        </Card>

        {/* Contactors + alerts */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Contactor state</CardTitle>
              <CardDescription>High-voltage path status from the playback</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: "MAIN +", closed: mainClosed, color: "#dc2626" },
                { label: "MAIN −", closed: mainClosed, color: "#334155" },
                { label: "PRECHARGE", closed: prechargeClosed, color: "#b45309" },
              ].map((c) => (
                <div key={c.label} className="flex items-center gap-2.5 rounded-lg border px-3 py-2">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                  <span className="text-xs font-bold tracking-wide">{c.label}</span>
                  <span className={cn("ml-auto text-[10px] font-bold rounded-full px-2 py-0.5 border", c.closed ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300" : "border-slate-300 bg-slate-100 text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400")}>
                    {c.closed ? "CLOSED" : "OPEN"}
                  </span>
                  <svg width="34" height="12" viewBox="0 0 34 12" aria-hidden>
                    <line x1="0" y1="6" x2={c.closed ? 34 : 20} y2="6" stroke={c.closed ? "#10b981" : "#94a3b8"} strokeWidth="2.5" />
                    {!c.closed && <line x1="20" y1="2" x2="30" y2="9" stroke="#94a3b8" strokeWidth="2.5" />}
                    <circle cx={c.closed ? 30 : 20} cy="6" r="3" fill={c.closed ? "#10b981" : "#94a3b8"} className={c.closed && pb.playing ? "animate-pulse" : ""} />
                  </svg>
                </div>
              ))}
              <div className="rounded-lg bg-muted/60 p-2 text-[10px] leading-relaxed text-muted-foreground">
                Precharge closes for the first seconds to limit inrush into the inverter capacitance, then MAIN carries the full current — exactly like a real BMS power-up sequence.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Live alerts</CardTitle>
              <CardDescription>BMS limit checks evaluated at the playback position</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10 px-3 py-2.5 text-emerald-800 dark:text-emerald-300">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-medium">All limits OK — voltage, temperature and balance within band.</span>
                </div>
              ) : (
                alerts.map((a, i) => (
                  <div key={i} className={cn("flex items-start gap-2 rounded-lg border px-3 py-2", a.level === "fail" ? "border-red-200 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300" : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300")}>
                    {a.level === "fail" ? <TriangleAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" /> : <TriangleAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
                    <span className="text-xs leading-snug">{a.text}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Streaming charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title={pb.syncCharts ? "Stream — pack & cell voltage (live)" : "Stream — pack & cell voltage"}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pb.viewSeries} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="t" tick={{ fontSize: 11 }} unit=" s" />
              <YAxis yAxisId="v" tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
              <YAxis yAxisId="vp" orientation="right" tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
              <Tooltip labelFormatter={(l) => `t = ${l} s`} />
              <Legend />
              <ReferenceLine yAxisId="v" y={design.vmin} stroke={CHART_COLORS.red} strokeDasharray="4 4" label={{ value: "Vmin", fontSize: 10 }} />
              <ReferenceLine yAxisId="v" y={design.vmax} stroke={CHART_COLORS.amber} strokeDasharray="4 4" label={{ value: "Vmax", fontSize: 10 }} />
              <Line yAxisId="v" type="monotone" dataKey="vCell" name="Cell V" stroke={CHART_COLORS.blue} dot={false} strokeWidth={2} />
              <Line yAxisId="vp" type="monotone" dataKey="vPack" name={`Pack V (${pack.series}S)`} stroke={CHART_COLORS.cyan} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={pb.syncCharts ? "Stream — pack current (live)" : "Stream — pack current"}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pb.viewSeries} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="t" tick={{ fontSize: 11 }} unit=" s" />
              <YAxis tick={{ fontSize: 11 }} unit=" A" />
              <Tooltip labelFormatter={(l) => `t = ${l} s`} />
              <Legend />
              <Line type="stepAfter" dataKey="iCell" name="Per-cell A" stroke={CHART_COLORS.slate} dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={pb.syncCharts ? "Stream — state of charge (live)" : "Stream — state of charge"}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pb.viewSeries} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="t" tick={{ fontSize: 11 }} unit=" s" />
              <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
              <Tooltip labelFormatter={(l) => `t = ${l} s`} />
              <Legend />
              <Line type="monotone" dataKey="soc" name="SOC" stroke={CHART_COLORS.violet} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={pb.syncCharts ? "Stream — cell temperature (live)" : "Stream — cell temperature"}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pb.viewSeries} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="t" tick={{ fontSize: 11 }} unit=" s" />
              <YAxis tick={{ fontSize: 11 }} unit="°C" domain={["auto", "auto"]} />
              <Tooltip labelFormatter={(l) => `t = ${l} s`} />
              <Legend />
              <ReferenceLine y={45} stroke={CHART_COLORS.amber} strokeDasharray="4 4" label={{ value: "45°C", fontSize: 10 }} />
              <ReferenceLine y={60} stroke={CHART_COLORS.red} strokeDasharray="4 4" label={{ value: "60°C", fontSize: 10 }} />
              <Line type="monotone" dataKey="tempC" name="Mean cell °C" stroke={CHART_COLORS.red} dot={false} strokeWidth={2.5} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Wizard: Monitor → Analysis */}
          <WizardNav
            step={5}
            summary={
              <>
                live telemetry for {pack.series}S{pack.parallel}P{lastResult ? <span className="text-emerald-600"> · streaming from the latest run</span> : null}
              </>
            }
          />
        </>
      )}
    </div>
  );
}
