"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import { DesignResult, SCORE_CRITERIA } from "@/lib/battery/model";
import { StatCard, StatusBadge, scoreColor, CellGrid, KeyValue } from "./shared";
import { ShieldCheck, Activity, Thermometer, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";

const fmt = (x: number, d = 1) => x.toFixed(d);

function recommendation(r: DesignResult): string {
  const s = r.scores;
  const weakest = (Object.entries(s) as [string, number][]).sort((a, b) => a[1] - b[1])[0];
  const names: Record<string, string> = {
    energy: "usable energy vs the application target",
    charge: "charge speed — consider a higher-power cell or better cooling",
    thermal: "thermal margin — raise cooling capacity or lower C-rates",
    cost: "cost efficiency — fewer cells, cheaper cell, or longer cycle life",
    mass: "mass efficiency — higher-energy cells or a leaner overhead",
    lifetime: "cycle life — LFP chemistry or gentler operation",
    safety: "safety — resolve flagged violations first",
  };
  if (r.failCount > 0) {
    return `Design is NOT viable: ${r.failCount} hard violation${r.failCount > 1 ? "s" : ""} must be resolved before this pack could be built. Address the FAIL items below, then re-run.`;
  }
  return `Design is viable with ${r.warnCount} caution${r.warnCount === 1 ? "" : "s"}. Weakest axis is ${names[weakest[0]]}. Overall score ${r.totalScore.toFixed(0)}/100 — save it to a slot and iterate against the baseline.`;
}

export function ResultsPanel({ r }: { r: DesignResult }) {
  const chargeData = r.charge.points;
  const tempLimit = r.cell.tempChargeMaxC;
  const chart = chargeData.map((p) => ({
    t: Math.round(p.t * 10) / 10,
    temp: Math.round(p.temp * 10) / 10,
    current: Math.round(p.current * 100) / 100,
    soc: Math.round(p.soc),
  }));
  const radarData = SCORE_CRITERIA.map((c) => ({
    criterion: c.label.split(" ")[0],
    score: Math.round(r.scores[c.key]),
  }));

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Pack voltage" value={fmt(r.packVnom)} unit="V nom" hint={`${fmt(r.packVmax)} V max / ${fmt(r.packVmin)} V min`} />
        <StatCard label="Usable energy" value={fmt(r.usableWh, 0)} unit="Wh" tone={r.usableWh >= r.inputs.targetUsableWh ? "good" : "warn"} hint={`target ${r.inputs.targetUsableWh} Wh · ${fmt(r.packWh, 0)} Wh total`} />
        <StatCard label="Time to 80%" value={fmt(r.charge.timeTo80Min, 0)} unit="min" hint={`full CC-CV: ${fmt(r.charge.totalTimeMin, 0)} min`} />
        <StatCard label="Hottest cell (charge)" value={fmt(r.charge.peakTempC)} unit="°C" tone={r.charge.peakTempC <= r.cell.tempChargeMaxC ? "good" : "bad"} hint={`limit ${tempLimit} °C · spread ±${fmt(r.tempSpreadC)} °C`} />
        <StatCard label="Pack mass" value={fmt(r.packMassKg, 2)} unit="kg" hint={`${fmt(r.whPerKg, 0)} Wh/kg usable`} />
        <StatCard label="Volume" value={fmt(r.packVolumeL, 1)} unit="L" hint={`${fmt(r.whPerL, 0)} Wh/L usable`} />
        <StatCard label="Build cost" value={`$${fmt(r.costTotal, 0)}`} hint={`$${fmt(r.costPerUsableKwh, 0)}/usable-kWh`} />
        <StatCard label="Lifetime cost" value={`$${fmt(r.costPerLifetimeKwh, 0)}`} unit="/kWh" tone={r.costPerLifetimeKwh < 150 ? "good" : "warn"} hint={`over ${r.cell.cycleLife} rated cycles`} />
      </div>

      {/* Charging + thermal */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-card/70">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">CC-CV charge simulation</h3>
              <Badge variant="outline" className="ml-auto text-[10px] font-mono border-border/60 text-muted-foreground">
                {r.inputs.chargeCrate.toFixed(2)}C · {fmt(r.inputs.chargeCrate * r.cell.capacityAh, 1)} A/cell
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mb-2">
              Hottest-cell temperature and per-cell current vs time. CC phase tapers to CV at the {r.cell.chargeVoltageMax} V ceiling.
            </p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="oklch(0.32 0.015 235)" strokeDasharray="3 3" />
                  <XAxis dataKey="t" tick={{ fontSize: 10, fill: "oklch(0.688 0.012 235)" }} unit="′" />
                  <YAxis yAxisId="t" tick={{ fontSize: 10, fill: "oklch(0.688 0.012 235)" }} width={40} domain={[0, Math.max(80, Math.ceil(r.charge.peakTempC / 10) * 10 + 10)]} />
                  <YAxis yAxisId="i" orientation="right" tick={{ fontSize: 10, fill: "oklch(0.688 0.012 235)" }} width={34} />
                  <Tooltip
                    contentStyle={{ background: "oklch(0.21 0.014 235)", border: "1px solid oklch(0.32 0.015 235)", borderRadius: 8, fontSize: 12 }}
                    labelFormatter={(v) => `t = ${v} min`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine yAxisId="t" y={tempLimit} stroke="#f87171" strokeDasharray="6 4" label={{ value: `limit ${tempLimit}°C`, fontSize: 10, fill: "#f87171", position: "insideTopRight" }} />
                  <Line yAxisId="t" type="monotone" dataKey="temp" name="Hottest cell °C" stroke="#fbbf24" dot={false} strokeWidth={2} />
                  <Line yAxisId="i" type="monotone" dataKey="current" name="Cell current A" stroke="#34d399" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/70">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <Thermometer className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Pack thermal map</h3>
              <Badge variant="outline" className="ml-auto text-[10px] font-mono border-border/60 text-muted-foreground">
                {r.cooling.name.split(" (")[0]}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">
              Estimated temperature per series position at end of charge (coolant/air enters left). Hottest cell is highlighted against the {tempLimit} °C charge limit.
            </p>
            <CellGrid series={r.inputs.series} parallel={r.inputs.parallel} temps={r.cellTemps} limitC={r.cell.tempChargeMaxC} />
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-secondary/40 border border-border/40 p-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Mean rise</div>
                <div className="font-mono text-sm">{fmt((r.charge.peakTempC - r.inputs.ambientC) / (1 + r.cooling.spreadFactor))} °C</div>
              </div>
              <div className="rounded-lg bg-secondary/40 border border-border/40 p-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Spread</div>
                <div className="font-mono text-sm">±{fmt(r.tempSpreadC)} °C</div>
              </div>
              <div className="rounded-lg bg-secondary/40 border border-border/40 p-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Heat @ load</div>
                <div className="font-mono text-sm">{fmt(r.heatWPerCellCont, 2)} W/cell</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Safety checks */}
      <Card className="bg-card/70">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Safety & interface limit checks</h3>
            <div className="ml-auto flex items-center gap-2 text-[11px] font-mono">
              {r.failCount > 0 ? (
                <span className="text-red-400 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> {r.failCount} FAIL</span>
              ) : (
                <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> no violations</span>
              )}
              {r.warnCount > 0 ? <span className="text-amber-400">{r.warnCount} WARN</span> : null}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3">
            Automatic cross-subsystem limit screening: electrical limits, thermal limits, cold-charge plating risk, DC voltage class and cell-variation imbalance.
          </p>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {r.checks.map((c) => (
              <div key={c.id} className="flex flex-wrap sm:flex-nowrap items-start gap-x-3 gap-y-1 rounded-lg border border-border/50 bg-secondary/25 px-3 py-2">
                <StatusBadge status={c.status} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium">{c.label}</div>
                  <div className="text-[11px] text-muted-foreground leading-snug">{c.detail}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-xs">{c.value}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{c.limit}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scores */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card className="bg-card/70">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Balanced design score</h3>
            </div>
            <p className="text-[11px] text-muted-foreground mb-2">
              Weighted multi-objective score. Weights favour energy and safety, mirroring the case-study emphasis on balanced, safe designs.
            </p>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="oklch(0.32 0.015 235)" />
                  <PolarAngleAxis dataKey="criterion" tick={{ fontSize: 10, fill: "oklch(0.688 0.012 235)" }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="score" stroke={scoreColor(r.totalScore)} fill={scoreColor(r.totalScore)} fillOpacity={0.28} strokeWidth={2} />
                  <Tooltip contentStyle={{ background: "oklch(0.21 0.014 235)", border: "1px solid oklch(0.32 0.015 235)", borderRadius: 8, fontSize: 12 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/70">
          <CardContent className="p-5 flex flex-col">
            <h3 className="font-semibold text-sm mb-2">Criterion breakdown</h3>
            <div className="space-y-1.5">
              {SCORE_CRITERIA.map((c) => (
                <div key={c.key} className="flex items-center gap-2">
                  <span className="w-28 text-xs text-muted-foreground shrink-0">{c.label}</span>
                  <Progress value={r.scores[c.key]} className="h-1.5 flex-1" />
                  <span className="w-8 text-right font-mono text-xs tabular-nums">{r.scores[c.key].toFixed(0)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-4 rounded-xl border border-primary/25 bg-primary/8 p-3">
              <div className="text-center">
                <div className="font-mono text-3xl font-bold" style={{ color: scoreColor(r.totalScore) }}>
                  {r.totalScore.toFixed(0)}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">total / 100</div>
              </div>
              <p className="text-xs leading-relaxed text-foreground/85">{recommendation(r)}</p>
            </div>
            <div className="mt-3">
              <KeyValue k="Model verdict" v={r.failCount > 0 ? "Not buildable — resolve FAIL items" : r.warnCount > 0 ? "Buildable with cautions" : "Clean — all limits respected"} />
              <KeyValue k="Continuous load point" v={`${fmt(r.contCurrentPackA, 1)} A pack · ${fmt(r.contCrate)}C/cell`} />
              <KeyValue k="DC IR used (1.25× AC)" v={`${fmt(r.cell.internalResistanceMohm * 1.25)} mΩ`} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
