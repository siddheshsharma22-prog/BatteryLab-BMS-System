"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  BatteryCharging, Save, Trash2, FolderOpen, Zap, Weight, Gauge, Sparkles,
  CheckCircle2, CircleDashed, RotateCcw, BookOpen, Ruler, Thermometer,
  Activity, TrendingDown, Network,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import { useLabStore } from "@/lib/lab/store";
import {
  packMath, designIssues, estimateAreaM2, loadedVoltageAtSoc, effectiveCapacityPct,
  jouleHeatW, tempRiseAdiabatic, type CellDesign, type Chemistry,
} from "@/lib/lab/engine";
import { LIBRARY_CELLS, LIBRARY_CATEGORIES, cellToDesign, getLibraryCell, type LibraryCell } from "@/lib/lab/library";
import { SectionTitle, StatCard, ChartCard, CHART_COLORS, WizardNav } from "./shared";

interface SavedDesign {
  id: string;
  name: string;
  chemistry: string;
  brand: string | null;
  model: string | null;
  formFactor: string | null;
  cathode: string | null;
  anode: string | null;
  separator: string | null;
  electrolyte: string | null;
  application: string | null;
  sourceRef: string | null;
  capacityAh: number;
  nominalV: number | null;
  vmax: number;
  vmin: number;
  r0: number;
  r1: number | null;
  c1: number | null;
  r2: number | null;
  c2: number | null;
  maxDischargeC: number;
  maxPulseDischargeC: number | null;
  maxChargeC: number;
  stdChargeC: number | null;
  diameterMm: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  thicknessMm: number | null;
  massKg: number;
  cpJkgK: number | null;
  areaM2: number | null;
  entropicVperK: number | null;
  cycleLifeCycles: number | null;
  cycleLifeNote: string | null;
  chargeTempMinC: number | null;
  chargeTempMaxC: number | null;
  dischargeTempMinC: number | null;
  dischargeTempMaxC: number | null;
  selfDischargePctMonth: number | null;
  seriesCount: number;
  parallelCount: number;
  _count: { runs: number };
}

const CHEMS: Chemistry[] = ["NMC", "NCA", "LFP", "LTO", "LCO", "LeadAcid", "NiMH", "NiCd"];

const FORM_FACTORS = [
  "Cylindrical 18650", "Cylindrical 20700", "Cylindrical 21700",
  "Cylindrical 26650", "Cylindrical 32700", "Cylindrical 66160",
  "Cylindrical Sub-C", "Cylindrical D (LR20-class)", "Cylindrical AA (LR6-class)",
  "Prismatic", "Prismatic terminal-top", "Blade prismatic", "Pouch",
  "GC2 6V flooded deep-cycle block (3 cells)", "12V AGM VRLA block (6 cells)",
  "Coin / button", "Custom",
];

export function DesignTab() {
  const { design, updateDesign, resetDesign, pack, setPack, sendCopilotMessage, copilotBusy, setActiveTab } = useLabStore();
  const { toast } = useToast();
  const [saved, setSaved] = useState<SavedDesign[]>([]);
  const [saving, setSaving] = useState(false);
  const [pickId, setPickId] = useState<string>("");

  const loadSaved = async () => {
    try {
      const res = await fetch("/api/designs");
      const data = await res.json();
      if (res.ok) setSaved(data.designs);
    } catch {
      /* silent */
    }
  };

  useEffect(() => {
    loadSaved();
  }, []);

  const issues = designIssues(design);
  const complete = issues.length === 0;
  const pm = packMath(design, pack);
  const cellWh = design.capacityAh * (design.nominalV > 0 ? design.nominalV : (design.vmax + design.vmin) / 2 + 0.05);
  const whKg = design.massKg > 0 ? cellWh / design.massKg : 0;

  // Pack targets → S×P. Applied live: the Connection tab receives the cell
  // count derived from the design the user just set.
  const cellNominalV = design.nominalV > 0
    ? design.nominalV
    : design.vmax > 0 && design.vmin > 0 ? (design.vmax + design.vmin) / 2 + 0.05 : 0;
  const sugS = pack.targetV > 0 && cellNominalV > 0 ? Math.max(1, Math.round(pack.targetV / cellNominalV)) : null;
  const sugP = pack.targetAh > 0 && design.capacityAh > 0 ? Math.max(1, Math.ceil(pack.targetAh / design.capacityAh)) : null;
  const setTarget = (patch: { targetV?: number; targetAh?: number }) => {
    const tv = patch.targetV ?? pack.targetV;
    const ta = patch.targetAh ?? pack.targetAh;
    const s = tv > 0 && cellNominalV > 0 ? Math.max(1, Math.round(tv / cellNominalV)) : null;
    const p = ta > 0 && design.capacityAh > 0 ? Math.max(1, Math.ceil(ta / design.capacityAh)) : null;
    setPack({ ...patch, ...(s ? { series: s } : {}), ...(p ? { parallel: p } : {}) });
  };

  const save = async () => {
    if (!complete) {
      toast({ title: "Design incomplete", description: "Fill every required field before saving.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...design, ...pack }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Design saved", description: `${design.name} is stored in the database.` });
      loadSaved();
    } catch (e) {
      toast({ title: "Save failed", description: String(e instanceof Error ? e.message : e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const load = (d: SavedDesign) => {
    const n = (v: number | null | undefined, dflt = 0) => (v === null || v === undefined ? dflt : v);
    const s = (v: string | null) => v ?? "";
    const loaded: Partial<CellDesign> = {
      name: d.name, chemistry: d.chemistry as CellDesign["chemistry"],
      brand: s(d.brand), model: s(d.model),
      formFactor: s(d.formFactor), cathode: s(d.cathode), anode: s(d.anode),
      separator: s(d.separator), electrolyte: s(d.electrolyte), application: s(d.application),
      sourceRef: s(d.sourceRef),
      capacityAh: d.capacityAh, nominalV: n(d.nominalV), vmax: d.vmax, vmin: d.vmin, r0: d.r0,
      r1: n(d.r1), c1: n(d.c1), r2: n(d.r2), c2: n(d.c2),
      maxDischargeC: n(d.maxDischargeC), maxPulseDischargeC: n(d.maxPulseDischargeC),
      maxChargeC: n(d.maxChargeC), stdChargeC: n(d.stdChargeC),
      diameterMm: n(d.diameterMm), lengthMm: n(d.lengthMm), widthMm: n(d.widthMm),
      heightMm: n(d.heightMm), thicknessMm: n(d.thicknessMm), massKg: d.massKg,
      cpJkgK: n(d.cpJkgK), areaM2: n(d.areaM2), entropicVperK: n(d.entropicVperK, 0.0001),
      cycleLifeCycles: n(d.cycleLifeCycles), cycleLifeNote: s(d.cycleLifeNote),
      chargeTempMinC: n(d.chargeTempMinC), chargeTempMaxC: n(d.chargeTempMaxC),
      dischargeTempMinC: n(d.dischargeTempMinC), dischargeTempMaxC: n(d.dischargeTempMaxC),
      selfDischargePctMonth: n(d.selfDischargePctMonth),
    };
    updateDesign(loaded);
    // Saved designs carry their cell count (and no pack targets) — restore
    // S/P from the DB and clear any targets left over from a previous session.
    useLabStore.getState().setPack({ series: d.seriesCount, parallel: d.parallelCount, targetV: 0, targetAh: 0 });
    toast({ title: "Design loaded", description: `${d.name} — all saved values restored.` });
  };

  const remove = async (id: string) => {
    try {
      await fetch(`/api/designs/${id}`, { method: "DELETE" });
      loadSaved();
      toast({ title: "Design deleted" });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const askAi = (prompt: string) => sendCopilotMessage(prompt);

  const pickCell = (id: string) => {
    setPickId(id);
    if (!id) return;
    const cell = getLibraryCell(id);
    if (!cell) return;
    useLabStore.getState().loadLibraryCell(cell);
    toast({
      title: "Datasheet loaded",
      description: `${cell.brand} ${cell.model} — every value below is now editable.`,
    });
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={<BatteryCharging className="h-5 w-5" />}
        title="1 · Battery Design"
        desc="Start from a real datasheet or a blank sheet — every value stays editable and feeds Connection, Modeling, Simulation and Thermal."
      />

      {/* ===== Starting point — datasheet picker ===== */}
      <Card className="border-primary/30 bg-primary/[0.03]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /> Starting point</CardTitle>
          <CardDescription>Pre-fill every field from 24 real datasheets, or start blank — loaded values stay fully editable</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex-1 min-w-0">
            <Select value={pickId} onValueChange={pickCell}>
              <SelectTrigger className="w-full lg:max-w-md" aria-label="Pick a datasheet cell">
                <SelectValue placeholder="Load from datasheet…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="blank">Blank sheet</SelectItem>
                {LIBRARY_CATEGORIES.map((cat) => {
                  const cells = LIBRARY_CELLS.filter((c) => c.category === cat);
                  if (cells.length === 0) return null;
                  return (
                    <SelectGroup key={cat}>
                      <SelectLabel>{cat}</SelectLabel>
                      {cells.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.brand} {c.model} · {c.chemistry} · {c.capacityAh} Ah
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm" variant="outline"
              onClick={() => askAi("Recommend a cell for my application and pre-fill the design: I need ")}
              disabled={copilotBusy}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1 text-primary" /> Ask copilot to pick a cell
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { resetDesign(); setPickId(""); }}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setActiveTab("library")}>
              <BookOpen className="h-3.5 w-3.5 mr-1" /> Browse library
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ===== Required-field checklist ===== */}
      <div className="flex flex-wrap items-center gap-2">
        {complete ? (
          <Badge className="gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" /> Design complete — ready for Connection &amp; testing
          </Badge>
        ) : (
          <>
            <span className="text-xs text-muted-foreground mr-1">Missing:</span>
            {issues.map((iss) => (
              <Badge key={iss} variant="outline" className="gap-1.5 border-amber-300 text-amber-700">
                <CircleDashed className="h-3 w-3" /> {iss}
              </Badge>
            ))}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Identity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /> Identity &amp; chemistry</CardTitle>
            <CardDescription>Datasheet metadata (documentation only)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <TextField label="Design name" value={design.name} placeholder="e.g. Samsung INR21700-40T" onChange={(v) => updateDesign({ name: v })} />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Brand" value={design.brand} placeholder="Samsung SDI" onChange={(v) => updateDesign({ brand: v })} />
              <TextField label="Model" value={design.model} placeholder="INR21700-40T" onChange={(v) => updateDesign({ model: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Chemistry</Label>
                <Select value={design.chemistry} onValueChange={(v) => updateDesign({ chemistry: v as Chemistry })}>
                  <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHEMS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Form factor</Label>
                <Select value={design.formFactor} onValueChange={(v) => updateDesign({ formFactor: v })}>
                  <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORM_FACTORS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <TextField label="Application" value={design.application} placeholder="EV traction / ESS / power tools…" onChange={(v) => updateDesign({ application: v })} />
          </CardContent>
        </Card>

        {/* Electrical */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Gauge className="h-4 w-4 text-primary" /> Electrical ratings</CardTitle>
            <CardDescription>Core datasheet numbers — these drive the physics</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <NumField label="Capacity (Ah)" value={design.capacityAh} step={0.1} min={0} onChange={(v) => updateDesign({ capacityAh: v })} />
            <NumField label="Nominal voltage (V)" value={design.nominalV} step={0.05} min={0} onChange={(v) => updateDesign({ nominalV: v })} hint="e.g. 3.6" />
            <NumField label="V max (V)" value={design.vmax} step={0.05} min={0} onChange={(v) => updateDesign({ vmax: v })} />
            <NumField label="V min (V)" value={design.vmin} step={0.05} min={0} onChange={(v) => updateDesign({ vmin: v })} />
            <NumField label="Max discharge (C)" value={design.maxDischargeC} step={0.5} min={0} onChange={(v) => updateDesign({ maxDischargeC: v })} />
            <NumField label="Pulse discharge (C)" value={design.maxPulseDischargeC} step={0.5} min={0} onChange={(v) => updateDesign({ maxPulseDischargeC: v })} hint="≤ 10 s" />
            <NumField label="Max charge (C)" value={design.maxChargeC} step={0.1} min={0} onChange={(v) => updateDesign({ maxChargeC: v })} />
            <NumField label="Std charge (C)" value={design.stdChargeC} step={0.05} min={0} onChange={(v) => updateDesign({ stdChargeC: v })} hint="CC phase" />
          </CardContent>
        </Card>

        {/* Dimensions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Ruler className="h-4 w-4 text-primary" /> Dimensions &amp; materials</CardTitle>
            <CardDescription>Geometry estimates the cooled surface area</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <NumField label="Diameter (mm)" value={design.diameterMm} step={0.1} min={0} onChange={(v) => updateDesign({ diameterMm: v })} />
              <NumField label="Length / height (mm)" value={design.lengthMm || design.heightMm} step={0.1} min={0} onChange={(v) => updateDesign({ lengthMm: v })} />
              <NumField label="Width (mm)" value={design.widthMm} step={0.1} min={0} onChange={(v) => updateDesign({ widthMm: v })} />
              <NumField label="Thickness (mm)" value={design.thicknessMm} step={0.1} min={0} onChange={(v) => updateDesign({ thicknessMm: v })} />
            </div>
            <div className="flex items-end gap-2">
              <NumField label="Surface area (m²)" value={design.areaM2} step={0.001} min={0} onChange={(v) => updateDesign({ areaM2: v })} hint="used by the thermal model" />
              <Button
                size="sm" variant="outline" className="mb-4 shrink-0"
                onClick={() => {
                  const a = estimateAreaM2(design);
                  updateDesign({ areaM2: a });
                  toast({ title: "Area estimated", description: `${(a * 10000).toFixed(0)} cm² from the dimensions.` });
                }}
              >
                Estimate
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Cathode" value={design.cathode} placeholder="NMC 811" onChange={(v) => updateDesign({ cathode: v })} />
              <TextField label="Anode" value={design.anode} placeholder="Graphite + SiO" onChange={(v) => updateDesign({ anode: v })} />
            </div>
            <TextField label="Source reference" value={design.sourceRef} placeholder="datasheet rev. / link" onChange={(v) => updateDesign({ sourceRef: v })} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Temperature & durability */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Thermometer className="h-4 w-4 text-primary" /> Temperature limits &amp; durability</CardTitle>
            <CardDescription>Operating window and cycle-life targets from the datasheet</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <NumField label="Charge temp min (°C)" value={design.chargeTempMinC} step={1} onChange={(v) => updateDesign({ chargeTempMinC: v })} hint="often 0 °C" />
            <NumField label="Charge temp max (°C)" value={design.chargeTempMaxC} step={1} onChange={(v) => updateDesign({ chargeTempMaxC: v })} hint="often 45 °C" />
            <NumField label="Discharge temp min (°C)" value={design.dischargeTempMinC} step={1} onChange={(v) => updateDesign({ dischargeTempMinC: v })} hint="often −20 °C" />
            <NumField label="Discharge temp max (°C)" value={design.dischargeTempMaxC} step={1} onChange={(v) => updateDesign({ dischargeTempMaxC: v })} hint="often 60 °C" />
            <NumField label="Cycle life (cycles)" value={design.cycleLifeCycles} step={50} min={0} onChange={(v) => updateDesign({ cycleLifeCycles: v })} />
            <NumField label="Self-discharge (%/month)" value={design.selfDischargePctMonth} step={0.1} min={0} onChange={(v) => updateDesign({ selfDischargePctMonth: v })} />
            <div className="col-span-2">
              <TextField label="Cycle-life condition (note)" value={design.cycleLifeNote} placeholder="e.g. 500 cycles to 80% @ 0.5C, 25°C" onChange={(v) => updateDesign({ cycleLifeNote: v })} />
            </div>
          </CardContent>
        </Card>

        {/* Materials */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Weight className="h-4 w-4 text-primary" /> Electrolyte, separator &amp; mass</CardTitle>
            <CardDescription>Remaining datasheet metadata</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <TextField label="Separator" value={design.separator} placeholder="Ceramic-coated PE" onChange={(v) => updateDesign({ separator: v })} />
            </div>
            <div className="col-span-2">
              <TextField label="Electrolyte" value={design.electrolyte} placeholder="LiPF₆ in EC/DMC" onChange={(v) => updateDesign({ electrolyte: v })} />
            </div>
            <NumField label="Mass (kg)" value={design.massKg} step={0.001} min={0} onChange={(v) => updateDesign({ massKg: v })} />
            <NumField label="Cp (J/kg·K)" value={design.cpJkgK} step={10} min={0} onChange={(v) => updateDesign({ cpJkgK: v })} hint="typ. 900–1200" />
            <NumField label="dU/dT (mV/K)" value={design.entropicVperK * 1000} step={0.05} onChange={(v) => updateDesign({ entropicVperK: v / 1000 })} hint="entropic coeff." />
          </CardContent>
        </Card>
      </div>

      {/* ===== Pack target — sizes S×P, loaded into Connection ===== */}
      <Card className="border-primary/30 bg-primary/[0.03]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Network className="h-4 w-4 text-primary" /> Pack target</CardTitle>
          <CardDescription>Size the pack from your design — the cell count loads into Connection automatically</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
            <NumField
              label="Target pack voltage (V)"
              value={pack.targetV || 0} step={1} min={0}
              placeholder="e.g. 36"
              onChange={(v) => setTarget({ targetV: v })}
              hint={cellNominalV > 0 ? `cell ${cellNominalV.toFixed(2)} V → S = round(V ÷ ${cellNominalV.toFixed(2)})` : "set nominal voltage above"}
            />
            <NumField
              label="Target pack capacity (Ah)"
              value={pack.targetAh || 0} step={1} min={0}
              placeholder="e.g. 12"
              onChange={(v) => setTarget({ targetAh: v })}
              hint={design.capacityAh > 0 ? `cell ${design.capacityAh.toFixed(1)} Ah → P = ⌈Ah ÷ ${design.capacityAh.toFixed(1)}⌉` : "set capacity above"}
            />
          </div>
          <div className="rounded-lg border bg-card px-4 py-3 lg:min-w-[240px]">
            {sugS || sugP ? (
              <>
                <div className="text-lg font-semibold text-primary tabular-nums leading-tight">
                  {sugS ?? "?"}S{sugP ?? "?"}P{sugS && sugP ? ` · ${sugS * sugP} cells` : ""}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {sugS && cellNominalV > 0 ? `${(sugS * cellNominalV).toFixed(1)} V` : "—"}
                  {sugP && design.capacityAh > 0 ? ` · ${(sugP * design.capacityAh).toFixed(1)} Ah` : ""} — live in Connection
                </div>
              </>
            ) : (
              <div className="text-xs text-muted-foreground">Enter targets to size the pack</div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Thermal model */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Weight className="h-4 w-4 text-primary" /> Thermal model inputs</CardTitle>
            <CardDescription>Drives the Bernardi heat model in thermal testing</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <NumField label="Mass (kg)" value={design.massKg} step={0.001} min={0} onChange={(v) => updateDesign({ massKg: v })} />
            <NumField label="Cp (J/kg·K)" value={design.cpJkgK} step={10} min={0} onChange={(v) => updateDesign({ cpJkgK: v })} hint="typ. 900–1200" />
            <NumField label="Surface area (cm²)" value={design.areaM2 * 10000} step={1} min={0} onChange={(v) => updateDesign({ areaM2: v / 10000 })} />
            <NumField label="dU/dT (mV/K)" value={design.entropicVperK * 1000} step={0.05} onChange={(v) => updateDesign({ entropicVperK: v / 1000 })} hint="entropic coeff." />
          </CardContent>
        </Card>

        {/* KPIs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Live cell KPIs</CardTitle>
            <CardDescription>Update as you type</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 stagger">
            <StatCard label="Cell energy" value={cellWh > 0 ? +cellWh.toFixed(1) : "—"} unit={cellWh > 0 ? "Wh" : undefined} />
            <StatCard label="Energy density" value={whKg > 0 ? whKg.toFixed(0) : "—"} unit={whKg > 0 ? "Wh/kg" : undefined} />
            <StatCard label="1C current" value={design.capacityAh > 0 ? design.capacityAh.toFixed(1) : "—"} unit={design.capacityAh > 0 ? "A" : undefined} />
            <StatCard label="Voltage window" value={design.vmin > 0 ? `${design.vmin}–${design.vmax}` : "—"} unit={design.vmin > 0 ? "V" : undefined} />
            <StatCard label="Pack preview" value={pm.packEnergyWh > 0 ? pm.packEnergyWh : "—"} unit={pm.packEnergyWh > 0 ? "Wh" : undefined} hint={`${pack.series}S${pack.parallel}P`} />
            <StatCard label="Pack spec. energy" value={pm.gravimetricWhKg > 0 ? pm.gravimetricWhKg : "—"} unit={pm.gravimetricWhKg > 0 ? "Wh/kg" : undefined} hint="incl. 25% structure" />
          </CardContent>
        </Card>

        {/* Save + library */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><FolderOpen className="h-4 w-4 text-primary" /> Design library</CardTitle>
            <CardDescription>Save your finished design to the database, then reuse it in later tests</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary/90">
              <Save className="h-4 w-4 mr-1.5" /> {saving ? "Saving…" : "Save design"}
            </Button>
            {saved.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved designs yet — define your cell above and press Save.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-lg border divide-y">
                {saved.map((d) => (
                  <div key={d.id} className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{d.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.chemistry} · {d.capacityAh} Ah · {d.seriesCount}S{d.parallelCount}P · {d._count.runs} run(s)
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => load(d)}>Load</Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(d.id)} aria-label={`Delete ${d.name}`}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ===== Real-World Preview (datasheet-driven) ===== */}
      <RealWorldPreview />

      {/* Wizard: Design → Connection carries the cell design and the cell count */}
      <WizardNav
        step={0}
        summary={
          pm.cellCount > 0
            ? <>{design.name || "Cell design"} → <span className="font-medium text-foreground">{pack.series}S{pack.parallel}P · {pm.cellCount} cells</span> load into Connection</>
            : "your cell configuration carries into Connection"
        }
        onBeforeNext={() => {
          // Guarantee Connection opens with the exact cell count implied by
          // the design targets (no-op when already in sync).
          const s = sugS ?? null;
          const p = sugP ?? null;
          if ((s && s !== pack.series) || (p && p !== pack.parallel)) {
            setPack({ ...(s ? { series: s } : {}), ...(p ? { parallel: p } : {}) });
          }
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------
// Real-world condition preview — computed live from the
// datasheet values the user entered (OCV curve + R0 + mass).
// ------------------------------------------------------------

function RealWorldPreview() {
  const design = useLabStore((s) => s.design);
  const ready = design.capacityAh > 0 && design.r0 > 0 && design.vmin > 0 && design.vmax > design.vmin;
  const maxC = Math.min(design.maxDischargeC > 0 ? design.maxDischargeC : 3, 12);

  // Loaded voltage vs SOC at several C-rates
  const sagData = useMemo(() => {
    if (!ready) return [];
    const rates = [0.25, 0.5, 1, 2, maxC].filter((r, i, arr) => arr.indexOf(r) === i).sort((a, b) => a - b);
    const pts: { soc: number; [k: string]: number }[] = [];
    for (let soc = 100; soc >= 0; soc -= 2) {
      const row: { soc: number; [k: string]: number } = { soc };
      for (const r of rates) row[`${r}C`] = +loadedVoltageAtSoc(design, soc / 100, r).toFixed(3);
      pts.push(row);
    }
    return pts;
  }, [design, ready, maxC]);

  // Effective capacity vs C-rate
  const effData = useMemo(() => {
    if (!ready) return [];
    const pts: { cRate: number; usable: number | null }[] = [];
    const step = maxC <= 2 ? 0.1 : 0.25;
    for (let c = 0.1; c <= maxC + 1e-9; c += step) {
      pts.push({ cRate: +c.toFixed(2), usable: effectiveCapacityPct(design, +c.toFixed(2)) });
    }
    pts.push({ cRate: +maxC.toFixed(2), usable: effectiveCapacityPct(design, maxC) });
    return pts;
  }, [design, ready, maxC]);

  // voltage sag at 1C: pure ohmic drop I·R0 (1C current = capacity in amps)
  const sag1C = ready ? design.capacityAh * design.r0 * 1000 : 0;
  const heatMax = jouleHeatW(design, maxC);
  const dT30 = tempRiseAdiabatic(design, maxC, 1800);
  const runtime1C = ready ? +(60 * (effectiveCapacityPct(design, 1) ?? 0) / 100).toFixed(0) : null;
  const usableAtMax = ready ? effectiveCapacityPct(design, maxC) : null;

  if (!ready) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Real-World Preview</CardTitle>
          <CardDescription>Enter capacity, R₀ and the voltage window to activate the preview.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const rates = [0.25, 0.5, 1, 2, maxC].filter((r, i, arr) => arr.indexOf(r) === i).sort((a, b) => a - b);
  const SAG_COLORS = [CHART_COLORS.blue, CHART_COLORS.cyan, CHART_COLORS.violet, CHART_COLORS.amber, CHART_COLORS.red];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Loaded voltage vs SOC — voltage sag under real loads">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sagData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="soc" tick={{ fontSize: 11 }} unit="%" />
              <YAxis tick={{ fontSize: 11 }} unit=" V" domain={["auto", "auto"]} />
              <Tooltip labelFormatter={(l) => `SOC ${l}%`} />
              <Legend />
              <ReferenceLine y={design.vmin} stroke={CHART_COLORS.red} strokeDasharray="4 4" label={{ value: "Vmin", fontSize: 10 }} />
              {rates.map((r, i) => (
                <Line
                  key={r}
                  type="monotone"
                  dataKey={`${r}C`}
                  name={`${r}C (${+(r * design.capacityAh).toFixed(1)} A)`}
                  stroke={SAG_COLORS[i % SAG_COLORS.length]}
                  dot={false}
                  strokeWidth={r === 1 ? 2.5 : 1.8}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Usable capacity vs C-rate — real-world derating">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={effData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="cRate" tick={{ fontSize: 11 }} unit="C" />
              <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 105]} />
              <Tooltip labelFormatter={(l) => `${l}C`} />
              <Legend />
              <Line type="monotone" dataKey="usable" name="Usable capacity" stroke={CHART_COLORS.cyan} dot={false} strokeWidth={2.5} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><TrendingDown className="h-3.5 w-3.5 text-primary" /> 1C voltage sag ≈ <b className="text-foreground">{sag1C.toFixed(0)} mV</b> (I·R₀)</span>
        {runtime1C !== null && <span>≈ <b className="text-foreground">{runtime1C} min</b> runtime at 1C</span>}
        <span>heat at {maxC}C ≈ <b className="text-foreground">{heatMax.toFixed(1)} W</b> (Joule)</span>
        <span>ΔT after 30 min adiabatic ≈ <b className="text-foreground">+{dT30} K</b></span>
        {usableAtMax !== null && <span>≈ <b className="text-foreground">{usableAtMax}%</b> of rated capacity usable at {maxC}C before the loaded voltage hits Vmin.</span>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Field helpers
// ------------------------------------------------------------

function NumField({ label, value, step, min, onChange, hint, placeholder }: { label: string; value: number; step: number; min?: number; onChange: (v: number) => void; hint?: string; placeholder?: string }) {
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
