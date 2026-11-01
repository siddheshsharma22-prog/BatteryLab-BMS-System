"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import {
  ClipboardList, DollarSign, ShieldCheck, Hourglass, Scale, AlertTriangle,
  Plus, Trash2, Sparkles, Settings2, TrendingDown, CheckCircle2, AlertCircle,
  Calculator, BookOpen,
} from "lucide-react";
import { useLabStore } from "@/lib/lab/store";
import { designIssues } from "@/lib/lab/engine";
import {
  packMath, costModel, ageingModel, protectionPlan, interfaceConflicts,
  checkRequirements, scoreAlternatives,
  type CoolingTier,
} from "@/lib/lab/engineering";
import { SectionTitle, StatCard, ChartCard, CHART_COLORS, WizardNav, StatusBadge } from "./shared";
import { cn } from "@/lib/utils";

const COOLING_OPTIONS: { value: CoolingTier; label: string; h: number }[] = [
  { value: "none", label: "None (adiabatic)", h: 0 },
  { value: "naturalAir", label: "Natural air", h: 8 },
  { value: "forcedAir", label: "Forced air (fan)", h: 35 },
  { value: "liquid", label: "Liquid cold plate", h: 150 },
];

const COST_COLORS = [CHART_COLORS.blue, CHART_COLORS.cyan, CHART_COLORS.amber, CHART_COLORS.violet];

export function EngineeringTab() {
  const {
    design, pack, simParams, lastResult,
    requirements, setRequirements,
    assumptions, setAssumptions,
    bmsSpec, setBmsSpec,
    alternatives, addAlternative, removeAlternative, renameAlternative, setAlternativeCooling, clearAlternatives,
    recommendationWeights, setRecommendationWeights,
    setActiveTab, sendCopilotMessage, copilotBusy,
  } = useLabStore();

  const issues = designIssues(design);
  const pm = useMemo(() => packMath(design, pack, assumptions), [design, pack, assumptions]);
  const cost = useMemo(() => {
    const cooling: CoolingTier = simParams.coolingOn
      ? (simParams.hConv >= 100 ? "liquid" : simParams.hConv >= 25 ? "forcedAir" : "naturalAir")
      : "none";
    return costModel(design, pack, cooling, assumptions);
  }, [design, pack, simParams, assumptions]);

  const ageing = useMemo(() => ageingModel(design, {
    cycles: requirements.serviceYears * 250,
    serviceYears: requirements.serviceYears,
    avgSocPct: 50,
    avgTempC: 30,
    dodPct: 80,
  }, assumptions), [design, requirements, assumptions]);

  const plan = useMemo(() => protectionPlan(design, pack, assumptions), [design, pack, assumptions]);
  const conflicts = useMemo(() => interfaceConflicts(design, pack, plan, bmsSpec), [design, pack, plan, bmsSpec]);

  const reqResults = useMemo(() => checkRequirements(requirements, {
    d: design, p: pack, pm, cost, ageing,
    lastSummary: lastResult?.summary, simParams,
    a: assumptions,
  }), [requirements, design, pack, pm, cost, ageing, lastResult, simParams, assumptions]);

  const scoredAlts = useMemo(() => scoreAlternatives(
    alternatives.map((alt) => ({
      id: alt.id, name: alt.name, d: alt.design, p: alt.pack, cooling: alt.cooling,
      summary: alt.runId === lastResult?.runId ? lastResult?.summary : null,
    })),
    requirements, recommendationWeights, assumptions,
  ), [alternatives, requirements, recommendationWeights, assumptions, lastResult]);

  const topPick = scoredAlts[0] ?? null;
  const passCount = reqResults.filter((r) => r.status === "ok").length;
  const failCount = reqResults.filter((r) => r.status === "fail").length;
  const warnCount = reqResults.filter((r) => r.status === "warn").length;

  // BOM pie data
  const bomData = [
    { name: "Cells", value: cost.cellCostUsd },
    { name: "Assembly", value: cost.assemblyCostUsd },
    { name: "Cooling", value: cost.coolingCostUsd },
    { name: "BMS", value: cost.bmsCostUsd },
  ];

  // Ageing decomposition chart
  const ageingData = [
    { name: "Cycle fade", value: ageing.cycleFadePct, fill: CHART_COLORS.amber },
    { name: "Calendar fade", value: ageing.calendarFadePct, fill: CHART_COLORS.cyan },
    { name: "Remaining (SoH)", value: ageing.sohPct, fill: CHART_COLORS.blue },
  ];

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={<ClipboardList className="h-5 w-5" />}
        title="8 · Engineering Review"
        desc="Requirements traceability, cost BOM, ageing, protection sizing & design A/B/C recommendation — closes the loop on the brief's measurable indicators."
      />

      {/* ===== Status strip ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger">
        <StatCard label="Requirements pass" value={`${passCount}/${reqResults.length}`} tone={failCount > 0 ? "fail" : warnCount > 0 ? "warn" : "default"} hint={failCount > 0 ? `${failCount} failing` : warnCount > 0 ? `${warnCount} need attention` : "all clear"} />
        <StatCard label="Pack cost" value={`$${cost.totalUsd.toFixed(0)}`} unit="total" hint={`$${cost.perKwhUsd}/kWh`} />
        <StatCard label="SoH @ service life" value={ageing.sohPct} unit="%" tone={ageing.sohPct < 80 ? "warn" : "default"} hint={`${requirements.serviceYears}y · 250 cyc/y`} />
        <StatCard label="Interface conflicts" value={conflicts.filter((c) => c.status === "fail").length} tone={conflicts.some((c) => c.status === "fail") ? "fail" : conflicts.some((c) => c.status === "warn") ? "warn" : "default"} hint={`${conflicts.length} checks`} />
      </div>

      {/* ===== 1. Requirements panel + pass/fail ===== */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary" /> Requirements &amp; pass/fail traceability</CardTitle>
          <CardDescription>State the application targets up front. Each one is checked against the current design, the latest run and the cost model — green pass, amber warn, red fail.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <TextField label="Application" value={requirements.application} placeholder="e.g. EV traction / E-bike / residential ESS" onChange={(v) => setRequirements({ application: v })} />
            <NumField label="Target pack voltage (V)" value={requirements.targetPackV} step={1} min={0} onChange={(v) => setRequirements({ targetPackV: v })} />
            <NumField label="Target pack energy (Wh)" value={requirements.targetPackWh} step={10} min={0} onChange={(v) => setRequirements({ targetPackWh: v })} />
            <NumField label="Max temperature (°C)" value={requirements.maxTempC} step={1} min={0} onChange={(v) => setRequirements({ maxTempC: v })} />
            <NumField label="Max charge time (min)" value={requirements.chargeTimeMin} step={5} min={0} onChange={(v) => setRequirements({ chargeTimeMin: v })} hint="0 = unchecked" />
            <NumField label="Max cost (USD)" value={requirements.maxCostUsd} step={50} min={0} onChange={(v) => setRequirements({ maxCostUsd: v })} hint="0 = unchecked" />
            <NumField label="Min cycle life (cycles)" value={requirements.minCycleLife} step={100} min={0} onChange={(v) => setRequirements({ minCycleLife: v })} />
            <NumField label="Service life (years)" value={requirements.serviceYears} step={1} min={1} onChange={(v) => setRequirements({ serviceYears: v })} hint="for calendar ageing" />
          </div>

          {/* Pass/fail list */}
          <div className="rounded-lg border divide-y">
            {reqResults.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">Enter at least one target above to start the traceability check.</div>
            ) : reqResults.map((r) => (
              <div key={r.key} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                <StatusBadge status={r.status} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{r.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{r.detail}</div>
                </div>
                <div className="text-right text-xs shrink-0">
                  <div className="text-muted-foreground">Target: <span className="font-medium text-foreground">{r.target}</span></div>
                  <div className="text-muted-foreground">Actual: <span className="font-medium text-foreground">{r.actual}</span></div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Tolerances: voltage ±{assumptions.voltageTolerancePct}% · energy ±{assumptions.energyTolerancePct}%. Editable in the Assumptions panel below.
          </p>
        </CardContent>
      </Card>

      {/* ===== 2. Cost BOM + 3. Ageing ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" /> Cost model — Bill of Materials</CardTitle>
            <CardDescription>Cell price by chemistry + assembly per cell + cooling overhead + BMS. Edit prices in the Assumptions panel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Cell cost" value={`$${cost.cellCostUsd.toFixed(0)}`} hint={`${assumptions.cellPricePerWh[design.chemistry] || 0.2} $/Wh × ${pm.packEnergyWh} Wh`} />
              <StatCard label="Assembly" value={`$${cost.assemblyCostUsd.toFixed(0)}`} hint={`$${assumptions.packAssemblyPerCell} × ${pm.cellCount} cells`} />
              <StatCard label="Cooling" value={`$${cost.coolingCostUsd.toFixed(0)}`} hint={COOLING_OPTIONS.find((c) => c.value === (simParams.coolingOn ? (simParams.hConv >= 100 ? "liquid" : simParams.hConv >= 25 ? "forcedAir" : "naturalAir") : "none"))?.label || "none"} />
              <StatCard label="BMS" value={`$${cost.bmsCostUsd.toFixed(0)}`} hint={`${pack.series}S modules`} />
            </div>
            <ChartCard title="BOM breakdown">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={bomData} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="80%" paddingAngle={2}>
                    {bomData.map((_, i) => <Cell key={i} fill={COST_COLORS[i % COST_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
            <div className="flex items-baseline justify-between rounded-lg bg-muted/40 px-3 py-2">
              <div className="text-xs text-muted-foreground">Pack total</div>
              <div className="text-lg font-semibold tabular-nums">${cost.totalUsd.toFixed(0)} <span className="text-xs text-muted-foreground">· ${cost.perKwhUsd}/kWh</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Hourglass className="h-4 w-4 text-primary" /> Ageing model — cycle + calendar</CardTitle>
            <CardDescription>Semi-empirical: cycle fade ∝ √N · DoD^α · k_cyc anchored to datasheet cycleLife · calendar Arrhenius (Ea {assumptions.ageingActivationEnergyKjPerMol} kJ/mol).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Cycle fade" value={ageing.cycleFadePct} unit="%" hint={`${(requirements.serviceYears * 250).toLocaleString()} cyc @ ${80}% DoD`} />
              <StatCard label="Calendar fade" value={ageing.calendarFadePct} unit="%" hint={`${requirements.serviceYears}y @ 30°C/50% SOC`} />
              <StatCard label="Total fade" value={ageing.totalFadePct} unit="%" tone={ageing.totalFadePct > 20 ? "fail" : ageing.totalFadePct > 15 ? "warn" : "default"} />
              <StatCard label="SoH" value={ageing.sohPct} unit="%" tone={ageing.sohPct < 80 ? "warn" : "default"} hint="80% = end of life" />
              <StatCard label="EoL cycles" value={ageing.eolCycles ?? "∞"} hint="to 80% SoH" />
              <StatCard label="EoL years" value={ageing.eolYears ?? ">30"} hint="calendar only" />
            </div>
            <ChartCard title="Capacity fade decomposition">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageingData} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis type="number" unit="%" tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
                  <Bar dataKey="value" name="Capacity" radius={[0, 6, 6, 0]}>
                    {ageingData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </CardContent>
        </Card>
      </div>

      {/* ===== 4. Protection & interface conflicts ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Protection &amp; sensing sizing</CardTitle>
            <CardDescription>Derived from the cell ratings and pack configuration — gives explicit set-points for OVP/UVP/OCP/OTP, fuse, contactor and thermistor count.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard label="OVP set-point" value={plan.packVmax} unit="V" />
              <StatCard label="UVP set-point" value={plan.packVmin} unit="V" />
              <StatCard label="OTP" value={plan.otpC} unit="°C" />
              <StatCard label="OCP continuous" value={plan.ocpContinuousA} unit="A" hint={`×${assumptions.ocpSafetyFactor} safety`} />
              <StatCard label="OCP pulse" value={plan.ocpPulseA} unit="A" hint="≤ 10 s" />
              <StatCard label="Fuse rating" value={plan.fuseRatingA} unit="A" hint={`×${assumptions.fuseDerating} derating`} />
              <StatCard label="Contactor cont." value={plan.contactorContinuousA} unit="A" hint={`×${assumptions.contactorDerating}`} />
              <StatCard label="Contactor pulse" value={plan.contactorPulseA} unit="A" hint={`×${assumptions.contactorPulseDerating}`} />
              <StatCard label="Thermistors" value={plan.thermistorCount} unit="× NTC" hint={`${(1 / assumptions.thermistorsPerCell).toFixed(0)} cells each`} />
              <StatCard label="BMS V range" value={`${plan.bmsVoltageRange.min}–${plan.bmsVoltageRange.max}`} unit="V" hint="±10% of cell window" />
              <StatCard label="Balance current" value={plan.cellBalanceCurrentA} unit="A" hint="C/30 passive" />
            </div>

            <div className="rounded-lg border">
              <div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground border-b">Threshold set-points &amp; rationale</div>
              <div className="divide-y">
                {plan.checks.map((c) => (
                  <div key={c.label} className="flex items-start gap-2 px-3 py-1.5 text-xs">
                    <StatusBadge status={c.status} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{c.label}</div>
                      <div className="text-muted-foreground">{c.detail}</div>
                      {c.threshold && (
                        <div className="mt-0.5 text-[10px] text-muted-foreground italic">{c.threshold.rationale}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-primary" /> Interface conflicts &amp; BMS spec</CardTitle>
            <CardDescription>Cross-checks the pack against the BMS you actually plan to use. Leave fields blank to use defaults (warned).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <NumField label="BMS V min" value={bmsSpec.vMin ?? 0} step={1} min={0} onChange={(v) => setBmsSpec({ vMin: v || undefined })} hint="datasheet" />
              <NumField label="BMS V max" value={bmsSpec.vMax ?? 0} step={1} min={0} onChange={(v) => setBmsSpec({ vMax: v || undefined })} hint="datasheet" />
              <NumField label="BMS I cont (A)" value={bmsSpec.iMaxContA ?? 0} step={1} min={0} onChange={(v) => setBmsSpec({ iMaxContA: v || undefined })} hint="datasheet" />
              <NumField label="BMS I pulse (A)" value={bmsSpec.iMaxPulseA ?? 0} step={1} min={0} onChange={(v) => setBmsSpec({ iMaxPulseA: v || undefined })} hint="datasheet" />
            </div>
            <div className="rounded-lg border divide-y">
              {conflicts.map((c) => (
                <div key={c.label} className="flex items-start gap-2 px-3 py-2 text-xs">
                  <StatusBadge status={c.status} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{c.label}</div>
                    <div className="text-muted-foreground">{c.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== 5. Design A/B/C comparison ===== */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm flex items-center gap-2"><Scale className="h-4 w-4 text-primary" /> Design A/B/C comparison</CardTitle>
              <CardDescription>Save the current design as an alternative, then compare side-by-side: usable energy, peak temperature, charge time, mass, cost, cycle life. Weighted score picks the balanced option.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => addAlternative()} disabled={issues.length > 0}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Save current as Alternative
              </Button>
              {alternatives.length > 0 && (
                <Button size="sm" variant="ghost" onClick={clearAlternatives}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {issues.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              Your current design is incomplete ({issues.length} missing field{issues.length === 1 ? "" : "s"}). Fix it in the Design tab to enable "Save current as Alternative".
            </div>
          )}
          {alternatives.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No alternatives saved yet. Configure a design and connection, optionally run a simulation/thermal test, then press <b>Save current as Alternative</b> above. Switch back to Design, change chemistry or S×P, and save again to compare.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-3 font-medium text-muted-foreground">Metric</th>
                      {scoredAlts.map((a) => (
                        <th key={a.id} className="py-2 px-3 font-semibold text-foreground">
                          <div className="flex items-center gap-2">
                            <Input
                              className="h-6 text-xs px-1 py-0"
                              value={a.name}
                              onChange={(e) => renameAlternative(a.id, e.target.value)}
                              aria-label={`Rename ${a.id}`}
                            />
                            <button onClick={() => removeAlternative(a.id)} aria-label="Remove" className="text-red-500 hover:text-red-600">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                          <div className="mt-1 flex items-center gap-1">
                            <Select value={alternatives.find((x) => x.id === a.id)?.cooling ?? "none"} onValueChange={(v) => setAlternativeCooling(a.id, v as CoolingTier)}>
                              <SelectTrigger className="h-6 text-[10px] px-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {COOLING_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <CompareRow label="Chemistry" cells={scoredAlts.map((a) => alternatives.find((x) => x.id === a.id)?.design.chemistry ?? "—")} />
                    <CompareRow label="Pack config" cells={scoredAlts.map((a) => {
                      const alt = alternatives.find((x) => x.id === a.id);
                      return alt ? `${alt.pack.series}S${alt.pack.parallel}P` : "—";
                    })} />
                    <CompareRow label="Usable energy (Wh)" cells={scoredAlts.map((a) => a.metrics.packWh.toFixed(0))} />
                    <CompareRow label="Pack mass (kg)" cells={scoredAlts.map((a) => a.metrics.packMassKg.toFixed(2))} />
                    <CompareRow label="Peak temp (°C)" cells={scoredAlts.map((a) => a.metrics.peakTempC === null ? "—" : a.metrics.peakTempC.toFixed(1))} highlight={(i) => {
                      const v = scoredAlts[i].metrics.peakTempC;
                      return v !== null && v > requirements.maxTempC;
                    }} />
                    <CompareRow label="Charge time (min)" cells={scoredAlts.map((a) => a.metrics.chargeTimeMin === null ? "—" : a.metrics.chargeTimeMin.toFixed(0))} />
                    <CompareRow label="Pack cost (USD)" cells={scoredAlts.map((a) => `$${a.metrics.costUsd.toFixed(0)}`)} />
                    <CompareRow label="Cost / kWh" cells={scoredAlts.map((a) => `$${a.metrics.costPerKwh.toFixed(0)}`)} />
                    <CompareRow label="EoL cycles" cells={scoredAlts.map((a) => a.metrics.eolCycles === null ? "—" : a.metrics.eolCycles.toLocaleString())} />
                    <CompareRow label="SoH @ service life" cells={scoredAlts.map((a) => `${a.metrics.sohAtServiceYears.toFixed(1)}%`)} />
                    <CompareRow label="Weighted score" cells={scoredAlts.map((a) => `${a.score.toFixed(1)}/100`)} highlight={(i) => i === 0} bold />
                  </tbody>
                </table>
              </div>

              {/* Per-alt scoring breakdown chart */}
              <ChartCard title="Weighted score breakdown (rubric-aligned)">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scoredAlts.flatMap((a) => a.scoreBreakdown.map((b) => ({ alt: a.name, criterion: b.label, score: b.weighted })))} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis dataKey="alt" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="/100" />
                    <Tooltip />
                    <Legend />
                    {scoredAlts[0]?.scoreBreakdown.map((b, i) => (
                      <Bar key={b.label} dataKey="score" name={b.label} stackId="a" fill={Object.values(CHART_COLORS)[i % Object.values(CHART_COLORS).length]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </>
          )}
        </CardContent>
      </Card>

      {/* ===== 6. Recommendation & risks ===== */}
      {topPick && (
        <Card className="border-primary/30 bg-primary/[0.03]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Recommendation &amp; risks</CardTitle>
            <CardDescription>The top-scoring alternative and its stated risks and limitations — auditable, not just a copilot suggestion.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-lg font-semibold">{topPick.name}</span>
              <Badge className="gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3 w-3" /> Score {topPick.score.toFixed(1)}/100
              </Badge>
              <span className="text-sm text-muted-foreground">{topPick.recommendation}</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 text-amber-500" /> Risks &amp; limitations</div>
                <ul className="space-y-1.5">
                  {topPick.risks.length === 0 ? (
                    <li className="text-xs text-muted-foreground flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> No flagged risks within the stated requirements.</li>
                  ) : topPick.risks.map((r, i) => (
                    <li key={i} className="text-xs flex items-start gap-1.5">
                      <AlertCircle className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5"><BookOpen className="h-3 w-3 text-primary" /> Assumptions used</div>
                <ul className="space-y-1.5">
                  {topPick.assumptions.map((r, i) => (
                    <li key={i} className="text-xs flex items-start gap-1.5">
                      <Calculator className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm" variant="outline"
                disabled={copilotBusy}
                onClick={() => sendCopilotMessage(
                  `I have ${scoredAlts.length} design alternatives. Top score: ${topPick.name} at ${topPick.score.toFixed(1)}/100. Risks: ${topPick.risks.join("; ") || "none"}. Help me decide: which trade-offs are acceptable for ${requirements.application || "my application"}?`
                )}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1 text-primary" /> Ask copilot to weigh in
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setActiveTab("analysis")}>
                <TrendingDown className="h-3.5 w-3.5 mr-1" /> View test-run history
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== 7. Assumptions panel (editable structure allowance etc.) ===== */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" /> Assumptions &amp; model parameters</CardTitle>
          <CardDescription>Every previously hard-coded fudge factor is now an explicit, auditable input. Defaults reproduce the prior behaviour exactly.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <NumField label="Structure allowance (%)" value={assumptions.structureAllowancePct * 100} step={1} min={0} onChange={(v) => setAssumptions({ structureAllowancePct: v / 100 })} hint="was hard-coded 25%" />
            <NumField label="Pack overhead (%)" value={assumptions.packOverheadPct * 100} step={1} min={0} onChange={(v) => setAssumptions({ packOverheadPct: v / 100 })} hint="BMS/housing mass" />
            <NumField label="Assembly per cell (USD)" value={assumptions.packAssemblyPerCell} step={0.1} min={0} onChange={(v) => setAssumptions({ packAssemblyPerCell: v })} />
            <NumField label="V tolerance (%)" value={assumptions.voltageTolerancePct} step={0.5} min={0} onChange={(v) => setAssumptions({ voltageTolerancePct: v })} />
            <NumField label="Energy tolerance (%)" value={assumptions.energyTolerancePct} step={0.5} min={0} onChange={(v) => setAssumptions({ energyTolerancePct: v })} />
            <NumField label="OCP safety factor" value={assumptions.ocpSafetyFactor} step={0.05} min={1} onChange={(v) => setAssumptions({ ocpSafetyFactor: v })} />
            <NumField label="Fuse derating" value={assumptions.fuseDerating} step={0.05} min={1} onChange={(v) => setAssumptions({ fuseDerating: v })} />
            <NumField label="Contactor derating" value={assumptions.contactorDerating} step={0.05} min={1} onChange={(v) => setAssumptions({ contactorDerating: v })} />
            <NumField label="Contactor pulse derating" value={assumptions.contactorPulseDerating} step={0.05} min={1} onChange={(v) => setAssumptions({ contactorPulseDerating: v })} />
            <NumField label="Thermistors per cell" value={assumptions.thermistorsPerCell} step={0.05} min={0.05} onChange={(v) => setAssumptions({ thermistorsPerCell: v })} hint="0.25 = 1 per 4" />
            <NumField label="Ea (kJ/mol)" value={assumptions.ageingActivationEnergyKjPerMol} step={1} min={0} onChange={(v) => setAssumptions({ ageingActivationEnergyKjPerMol: v })} hint="Arrhenius" />
            <NumField label="Calendar ref T (°C)" value={assumptions.calendarRefTempC} step={1} onChange={(v) => setAssumptions({ calendarRefTempC: v })} />
            <NumField label="DoD exponent" value={assumptions.dodExponent} step={0.05} min={0.3} max={1.5} onChange={(v) => setAssumptions({ dodExponent: v })} hint="0.5 = √DoD law" />
          </div>

          {/* Cell price by chemistry */}
          <div>
            <Label className="text-xs text-muted-foreground">Cell price by chemistry (USD / Wh)</Label>
            <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(assumptions.cellPricePerWh) as Array<keyof typeof assumptions.cellPricePerWh>).map((c) => (
                <div key={c} className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{c}</Badge>
                  <Input
                    className="h-7 text-xs"
                    type="number" step={0.01} min={0}
                    value={assumptions.cellPricePerWh[c]}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isFinite(v) && v >= 0) {
                        setAssumptions({ cellPricePerWh: { ...assumptions.cellPricePerWh, [c]: v } });
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Cooling overhead */}
          <div>
            <Label className="text-xs text-muted-foreground">Cooling overhead (USD)</Label>
            <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(assumptions.coolingOverhead) as Array<keyof typeof assumptions.coolingOverhead>).map((c) => (
                <div key={c} className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{c}</Badge>
                  <Input
                    className="h-7 text-xs"
                    type="number" step={0.5} min={0}
                    value={assumptions.coolingOverhead[c as CoolingTier] ?? 0}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isFinite(v) && v >= 0) {
                        setAssumptions({ coolingOverhead: { ...assumptions.coolingOverhead, [c]: v } });
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Recommendation weights */}
          <div>
            <Label className="text-xs text-muted-foreground">Recommendation scoring weights (must sum to 100)</Label>
            <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {(Object.keys(recommendationWeights) as Array<keyof typeof recommendationWeights>).map((w) => (
                <div key={w} className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] truncate">{w}</Badge>
                  <Input
                    className="h-7 text-xs"
                    type="number" step={1} min={0} max={100}
                    value={recommendationWeights[w]}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isFinite(v) && v >= 0) {
                        setRecommendationWeights({ ...recommendationWeights, [w]: v });
                      }
                    }}
                  />
                </div>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Sum: {Object.values(recommendationWeights).reduce((a, b) => a + b, 0)} — automatically normalized.
            </p>
          </div>
        </CardContent>
      </Card>

      <WizardNav step={7} summary={
        alternatives.length === 0
          ? "save at least one design alternative to enable A/B/C comparison"
          : `${alternatives.length} alternative${alternatives.length === 1 ? "" : "s"} · top score ${topPick?.score.toFixed(1) ?? "—"}/100`
      } />
    </div>
  );
}

// ------------------------------------------------------------
// Comparison-row helper
// ------------------------------------------------------------

function CompareRow({
  label, cells, highlight, bold,
}: {
  label: string;
  cells: string[];
  highlight?: (i: number) => boolean;
  bold?: boolean;
}) {
  return (
    <tr>
      <td className={cn("py-2 pr-3 text-muted-foreground", bold && "font-semibold text-foreground")}>{label}</td>
      {cells.map((c, i) => (
        <td
          key={i}
          className={cn(
            "py-2 px-3 tabular-nums",
            bold && "font-semibold text-foreground",
            highlight?.(i) && "text-red-600 dark:text-red-400 font-semibold",
          )}
        >
          {c}
        </td>
      ))}
    </tr>
  );
}

// ------------------------------------------------------------
// Field helpers (mirrors DesignTab's local components)
// ------------------------------------------------------------

function NumField({ label, value, step, min, max, onChange, hint, placeholder }: { label: string; value: number; step: number; min?: number; max?: number; onChange: (v: number) => void; hint?: string; placeholder?: string }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        className="mt-1 h-8"
        type="number"
        value={value || ""}
        placeholder={placeholder ?? "0"}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(v);
          else if (e.target.value === "") onChange(0);
        }}
      />
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

function TextField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        className="mt-1 h-8"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
