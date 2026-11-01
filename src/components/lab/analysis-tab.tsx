"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { BarChart3, Trash2, Download, RefreshCw, Box, Camera } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line,
} from "recharts";
import { SectionTitle, StatCard, ChartCard, CHART_COLORS, WizardNav } from "./shared";
import { useLabStore } from "@/lib/lab/store";
import type { CellDesign } from "@/lib/lab/engine";
import { cn } from "@/lib/utils";

// 3D viewer — client-only (WebGL), code-split out of the main bundle
const PackViewer3D = dynamic(() => import("./pack-3d"), {
  ssr: false,
  loading: () => <div className="h-[360px] rounded-lg border bg-slate-100 dark:bg-slate-900 animate-pulse" />,
});

interface RunRow {
  id: string;
  name: string;
  profile: string;
  cRate: number;
  ambientC: number;
  hConv: number;
  summary: string;
  series: string;
  createdAt: string;
  design: {
    name: string; chemistry: string; capacityAh: number; seriesCount: number; parallelCount: number;
    nominalV?: number; formFactor?: string; cathode?: string;
    diameterMm?: number; lengthMm?: number; widthMm?: number; heightMm?: number; thicknessMm?: number; massKg?: number;
  };
}

const PROFILE_COLORS: Record<string, string> = {
  discharge: CHART_COLORS.blue,
  cccv: CHART_COLORS.cyan,
  hppc: CHART_COLORS.violet,
  drive: CHART_COLORS.amber,
};

export function AnalysisTab() {
  const { toast } = useToast();
  const { design: storeDesign, pack } = useLabStore();
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/runs");
      const data = await res.json();
      if (res.ok) setRuns(data.runs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const parsed = useMemo(
    () =>
      runs.map((r) => {
        let summary: Record<string, number | string | null> = {};
        let series: { t: number; vPack: number; tempC: number }[] = [];
        try {
          summary = JSON.parse(r.summary);
          series = JSON.parse(r.series);
        } catch {
          /* ignore */
        }
        return { row: r, summary, series: series.map((p) => ({ t: p.t, vPack: p.vPack, tempC: p.tempC })) };
      }),
    [runs]
  );

  const selectedData = parsed.filter((p) => selected.includes(p.row.id));

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev.slice(-3), id]));
  };

  const remove = async (id: string) => {
    try {
      await fetch(`/api/runs/${id}`, { method: "DELETE" });
      setSelected((prev) => prev.filter((x) => x !== id));
      load();
      toast({ title: "Run deleted" });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const exportSummaryCsv = () => {
    const head = "run,profile,c_rate,design,pack,ambient_C,cooling_h,capacity_Ah,energy_Wh,pack_energy_Wh,peak_power_W,v_min,v_max,soc_start,soc_end,peak_temp_C,delta_T_K,heat_Wh,efficiency_pct,duration_s,cutoff";
    const rows = parsed.map(({ row, summary }) =>
      [
        `"${row.name.replace(/"/g, "'")}"`, row.profile, row.cRate, `"${row.design.name}"`,
        `${row.design.seriesCount}S${row.design.parallelCount}P`, row.ambientC, row.hConv,
        summary.capacityAh ?? "", summary.energyWh ?? "", summary.packEnergyWh ?? "",
        summary.peakPowerW ?? "", summary.vMin ?? "", summary.vMax ?? "",
        summary.socStart ?? "", summary.socEnd ?? "", summary.tempMaxC ?? "", summary.deltaT ?? "",
        summary.heatWh ?? "", summary.efficiency ?? "", summary.durationS ?? "",
        `"${summary.cutoff ?? ""}"`,
      ].join(",")
    );
    const blob = new Blob([[head, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "battery_test_runs.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Final pack = design of the most recent stored run (falls back to the current design)
  const finalRun = runs[0];
  const finalDesign = useMemo<CellDesign>(
    () => (finalRun ? (finalRun.design as unknown as CellDesign) : storeDesign),
    [finalRun, storeDesign]
  );
  const finalS = finalRun ? finalRun.design.seriesCount : pack.series;
  const finalP = finalRun ? finalRun.design.parallelCount : pack.parallel;
  const finalSrc = finalRun ? `latest run “${finalRun.name}”` : "current design — no stored runs yet";

  const exportPackPng = () => {
    const canvas = document.querySelector("#final-pack-3d canvas") as HTMLCanvasElement | null;
    if (!canvas) {
      toast({ title: "3D view not ready", variant: "destructive" });
      return;
    }
    try {
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `batterylab-final-pack-${finalS}S${finalP}P.png`;
      a.click();
      toast({ title: "3D snapshot downloaded" });
    } catch {
      toast({ title: "Snapshot failed", variant: "destructive" });
    }
  };

  const exportPackCsv = () => {
    const d = finalDesign;
    const packV = (d.nominalV || 0) * finalS;
    const packAh = (d.capacityAh || 0) * finalP;
    const packWh = packV * packAh;
    const isPouch = /pouch|prismatic|blade/i.test(d.formFactor || "");
    const dims = isPouch
      ? `${d.widthMm || "?"}x${d.heightMm || "?"}x${d.thicknessMm || "?"}mm`
      : `dia${d.diameterMm || "?"}x${d.lengthMm || "?"}mm`;
    const packMass = (d.massKg || 0) * finalS * finalP;
    const head = "design,chemistry,form_factor,cell_dims,cell_capacity_Ah,cell_nominal_V,cell_mass_kg,series,parallel,total_cells,pack_V,pack_Ah,pack_Wh,pack_cell_mass_kg,energy_density_Wh_per_kg,source_run";
    const row = [
      `"${(d.name || "").replace(/"/g, "'")}"`, `"${d.chemistry}"`, `"${d.formFactor || "cylindrical"}"`,
      `"${dims}"`, d.capacityAh ?? "", d.nominalV ?? "", d.massKg ?? "",
      finalS, finalP, finalS * finalP,
      packV.toFixed(2), packAh.toFixed(2), packWh.toFixed(1),
      packMass > 0 ? packMass.toFixed(2) : "",
      packMass > 0 && packWh > 0 ? (packWh / packMass).toFixed(1) : "",
      `"${finalRun ? finalRun.name : ""}"`,
    ].join(",");
    const blob = new Blob([[head, row].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `batterylab-final-pack-${finalS}S${finalP}P.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // KPI aggregation across all runs
  const kpis = useMemo(() => {
    if (runs.length === 0) return null;
    const vals = parsed.map((p) => p.summary);
    const num = (k: string) => vals.map((v) => Number(v[k])).filter((n) => !isNaN(n));
    return {
      totalRuns: runs.length,
      totalEnergy: num("packEnergyWh").reduce((a, b) => a + b, 0),
      totalHeat: num("heatWh").reduce((a, b) => a + b, 0),
      maxTemp: Math.max(...num("tempMaxC"), 0),
      bestEff: Math.max(...num("efficiency").filter((n) => n > 0), 0),
    };
  }, [runs, parsed]);

  const compareBars = selectedData.map(({ row, summary }) => ({
    name: row.name.length > 14 ? row.name.slice(0, 14) + "…" : row.name,
    energy: Math.abs(Number(summary.packEnergyWh) || 0),
    capacity: Number(summary.packCapacityAh) || 0,
    deltaT: Number(summary.deltaT) || 0,
    peak: Number(summary.tempMaxC) || 0,
  }));

  // unified overlay dataset: resample every run onto a 0–100 % duration axis
  const overlay = useMemo(() => {
    const N = 100;
    const rows: { pct: number; [k: string]: number | null }[] = [];
    const keys = selectedData.map(({ row }) => (row.name.length > 16 ? row.name.slice(0, 16) + "…" : row.name));
    const sampled = selectedData.map(({ series }) => {
      const out: { v: number | null; t: number | null }[] = [];
      for (let i = 0; i <= N; i++) {
        const idx = Math.min(series.length - 1, Math.round((i / N) * (series.length - 1)));
        out.push(series[idx] ? { v: series[idx].vPack, t: series[idx].tempC } : { v: null, t: null });
      }
      return out;
    });
    for (let i = 0; i <= N; i++) {
      const row: { pct: number; [k: string]: number | null } = { pct: i };
      sampled.forEach((s, k) => {
        row[keys[k]] = s[i].v;
        row[keys[k] + "_t"] = s[i].t;
      });
      rows.push(row);
    }
    return { rows, keys };
  }, [selectedData]);

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={<BarChart3 className="h-5 w-5" />}
        title="7 · Battery Analysis"
        desc="Compare stored test runs side by side and export the dataset."
      />

      {/* Program KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 stagger">
          <StatCard label="Test runs" value={kpis.totalRuns} />
          <StatCard label="Cumulative pack energy" value={(kpis.totalEnergy / 1000).toFixed(2)} unit="kWh" />
          <StatCard label="Cumulative heat" value={kpis.totalHeat.toFixed(0)} unit="Wh" />
          <StatCard label="Highest peak temp" value={kpis.maxTemp} unit="°C" tone={kpis.maxTemp > 60 ? "fail" : kpis.maxTemp > 45 ? "warn" : "default"} />
          <StatCard label="Best efficiency" value={kpis.bestEff > 0 ? kpis.bestEff : "—"} unit={kpis.bestEff > 0 ? "%" : ""} />
        </div>
      )}

      {/* Final pack — 3D view + export */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <Box className="h-4 w-4 text-primary" /> Final pack — 3D view
              </CardTitle>
              <CardDescription className="truncate">
                {finalDesign.name || finalDesign.chemistry} · {finalS}S{finalP}P · {finalS * finalP} cells · from {finalSrc}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={exportPackCsv}>
                <Download className="h-3.5 w-3.5 mr-1" /> Spec CSV
              </Button>
              <Button size="sm" variant="outline" onClick={exportPackPng}>
                <Camera className="h-3.5 w-3.5 mr-1" /> Snapshot PNG
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <PackViewer3D design={finalDesign} series={finalS} parallel={finalP} wrapperId="final-pack-3d" />
        </CardContent>
      </Card>

      {/* Run table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Test log</CardTitle>
              <CardDescription>Select up to 4 runs to compare</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh</Button>
              {runs.length > 0 && (
                <Button
                  size="sm" variant="outline"
                  className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
                  onClick={async () => {
                    if (!confirm(`Delete all ${runs.length} stored test run${runs.length === 1 ? "" : "s"}? This clears leftover / demo data and cannot be undone.`)) return;
                    try {
                      // Best-effort bulk delete — runs the existing per-id endpoint
                      await Promise.all(runs.map((r) => fetch(`/api/runs/${r.id}`, { method: "DELETE" })));
                      setSelected([]);
                      await load();
                      toast({ title: "Test log cleared", description: `${runs.length} run${runs.length === 1 ? "" : "s"} deleted.` });
                    } catch {
                      toast({ title: "Reset failed", variant: "destructive" });
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Reset all
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={exportSummaryCsv} disabled={runs.length === 0}>
                <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading runs…</p>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No test runs yet — go to <span className="font-medium">Simulation</span> or <span className="font-medium">Thermal</span> and press Run.
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-lg border divide-y">
              {parsed.map(({ row, summary }) => {
                const peakT = Number(summary.tempMaxC) || 0;
                return (
                  <div
                    key={row.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer hover:bg-muted/50",
                      selected.includes(row.id) && "bg-primary/5"
                    )}
                    onClick={() => toggle(row.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onChange={() => toggle(row.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="accent-[#1e5a96]"
                      aria-label={`Select ${row.name}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{row.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {row.design.name} · {row.design.seriesCount}S{row.design.parallelCount}P · {row.cRate}C · {row.ambientC}°C · h={row.hConv}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0" style={{ backgroundColor: `${PROFILE_COLORS[row.profile]}18` }}>
                      {row.profile.toUpperCase()}
                    </Badge>
                    <div className="hidden md:block text-right shrink-0">
                      <div className="text-xs">{Math.abs(Number(summary.energyWh) || 0).toFixed(0)} Wh · {Number(summary.capacityAh) || 0} Ah</div>
                      <div className={cn("text-xs", peakT > 60 ? "text-red-600 font-semibold" : peakT > 45 ? "text-amber-600" : "text-muted-foreground")}>
                        peak {peakT.toFixed(0)}°C · ΔT +{Number(summary.deltaT) || 0}K
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); remove(row.id); }} aria-label={`Delete run ${row.name}`}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparison charts */}
      {selectedData.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Selected runs comparison ({selectedData.length})</h3>
          <div className="grid lg:grid-cols-2 gap-4">
            <ChartCard title="Pack energy (Wh)">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={compareBars} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} unit=" Wh" />
                  <Tooltip />
                  <Bar dataKey="energy" name="Pack energy" fill={CHART_COLORS.blue} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Temperature rise ΔT (K)">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={compareBars} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} unit=" K" />
                  <Tooltip />
                  <Bar dataKey="deltaT" name="ΔT" fill={CHART_COLORS.amber} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <ChartCard title="Pack voltage overlay (normalized test duration)">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={overlay.rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="pct" tick={{ fontSize: 11 }} unit=" %" domain={[0, 100]} />
                <YAxis tick={{ fontSize: 11 }} unit=" V" domain={["auto", "auto"]} />
                <Tooltip labelFormatter={(l) => `${l}% of test`} />
                <Legend />
                {overlay.keys.map((k, i) => (
                  <Line
                    key={k}
                    dataKey={k}
                    name={k}
                    stroke={Object.values(CHART_COLORS)[i % Object.values(CHART_COLORS).length]}
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Temperature overlay (normalized test duration)">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={overlay.rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="pct" tick={{ fontSize: 11 }} unit=" %" domain={[0, 100]} />
                <YAxis tick={{ fontSize: 11 }} unit="°C" domain={["auto", "auto"]} />
                <Tooltip labelFormatter={(l) => `${l}% of test`} />
                <Legend />
                {overlay.keys.map((k, i) => (
                  <Line
                    key={k}
                    dataKey={`${k}_t`}
                    name={k}
                    stroke={Object.values(CHART_COLORS)[i % Object.values(CHART_COLORS).length]}
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {/* Wizard: Analysis is the final step — restart or go back */}
      <WizardNav step={6} summary={runs.length > 0 ? `${runs.length} stored run${runs.length === 1 ? "" : "s"} in the database` : "no stored runs yet"} />
    </div>
  );
}
