"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, Dispatch, SetStateAction, ComponentType, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Package, Network, Wind, CloudSun, BatteryCharging, Target, Save, RotateCcw, SlidersHorizontal, CalendarClock,
} from "lucide-react";
import { CELLS, COOLING, SCENARIOS, getCell, getCooling, DOD_OPTIONS } from "@/lib/battery/data";
import { DEFAULT_INPUTS, PackInputs, evaluateDesign } from "@/lib/battery/model";
import { useDesignStore, SlotId, SLOT_META } from "@/lib/battery/store";
import { SectionHeader, KeyValue, TechBadge } from "./shared";
import { ResultsPanel } from "./designer-results";

function ControlGroup({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
      </div>
      {hint ? <p className="text-[11px] text-muted-foreground mb-3 leading-snug">{hint}</p> : null}
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function SliderRow({
  label, value, min, max, step, unit, onChange, marks,
}: {
  label: string; value: number; min: number; max: number; step: number; unit?: string;
  onChange: (v: number) => void; marks?: string[];
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-mono text-xs tabular-nums">{value}{unit ? ` ${unit}` : ""}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
      {marks ? (
        <div className="flex justify-between mt-0.5 text-[10px] text-muted-foreground/70">
          {marks.map((m) => <span key={m}>{m}</span>)}
        </div>
      ) : null}
    </div>
  );
}

export function Designer() {
  const { toast } = useToast();
  // designer state lives here; store only holds saved snapshots
  const [inputs, setInputs] = useLocalInputs();
  const saveDesign = useDesignStore((s) => s.saveDesign);
  const hydrated = useHydrated();

  const r = useMemo(() => evaluateDesign(inputs), [inputs]);
  const cell = getCell(inputs.cellId);

  const set = <K extends keyof PackInputs>(k: K, v: PackInputs[K]) => setInputs((p) => ({ ...p, [k]: v }));

  if (!hydrated) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
        Loading design studio…
      </div>
    );
  }


  const applyScenario = (id: string) => {
    const sc = SCENARIOS.find((s) => s.id === id);
    if (!sc) return;
    setInputs((p) => ({
      ...p,
      continuousLoadW: sc.continuousW,
      peakLoadW: sc.peakW,
      targetUsableWh: sc.targetUsableWh,
      ambientC: sc.ambientC,
    }));
    toast({ title: "Application preset applied", description: sc.description });
  };

  const onSave = (slot: SlotId) => {
    saveDesign(slot, `${cell.format} ${inputs.series}S${inputs.parallel}P · ${getCooling(inputs.coolingId).id}`, {
      inputs,
      totalScore: r.totalScore,
      usableWh: r.usableWh,
      costTotal: r.costTotal,
      chargeMinutes: r.charge.totalTimeMin,
      peakTempC: r.charge.peakTempC,
      packMassKg: r.packMassKg,
      failCount: r.failCount,
      warnCount: r.warnCount,
      whPerKg: r.whPerKg,
      costPerLifetimeKwh: r.costPerLifetimeKwh,
      cellName: cell.name,
      coolingName: getCooling(inputs.coolingId).name,
      scores: r.scores as unknown as Record<string, number>,
    });
    toast({ title: `Saved to ${SLOT_META.find((s) => s.id === slot)?.label}`, description: "Open the Compare tab to see it side by side." });
  };

  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Virtual design studio" title="Configure a pack — the model re-solves instantly">
        Every control below feeds one shared engineering model: electrical sizing, CC-CV charging,
        lumped-cell thermal behaviour, cost roll-up and safety screening. Results update live, so
        trade-offs are visible the moment you move a slider.
      </SectionHeader>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        {/* Controls column */}
        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:pr-1">
          <ControlGroup icon={SlidersHorizontal} title="Application scenario" hint="Prefills load power, target energy and ambient temperature.">
            <div className="grid grid-cols-1 gap-2">
              {SCENARIOS.map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => applyScenario(sc.id)}
                  className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                    inputs.continuousLoadW === sc.continuousW && inputs.targetUsableWh === sc.targetUsableWh
                      ? "border-primary/50 bg-primary/10"
                      : "border-border/50 bg-card/40 hover:border-primary/30"
                  }`}
                >
                  <div className="text-xs font-medium">{sc.name}</div>
                  <div className="text-[11px] text-muted-foreground">{sc.continuousW} W cont · {sc.peakW} W peak · {sc.voltageHint}</div>
                </button>
              ))}
            </div>
          </ControlGroup>

          <ControlGroup icon={Package} title="Cell selection" hint={cell.source}>
            <Select value={inputs.cellId} onValueChange={(v) => set("cellId", v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CELLS.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} — {c.capacityAh}Ah {c.chemistry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <KeyValue k="Capacity / voltage" v={`${cell.capacityAh} Ah · ${cell.nominalVoltage} V`} />
            <KeyValue k="Internal resistance" v={`${cell.internalResistanceMohm} mΩ AC`} />
            <KeyValue k="Max discharge / charge" v={`${cell.maxDischargeA} A / ${cell.maxChargeA} A`} />
            <KeyValue k="Mass / cycle life" v={`${cell.weightG} g · ${cell.cycleLife} cyc`} />
            <KeyValue k="Charge temp limit" v={`${cell.tempChargeMaxC} °C (runaway ≈ ${cell.thermalRunawayOnsetC} °C)`} />
          </ControlGroup>

          <ControlGroup icon={Network} title="Topology — series × parallel" hint="Series sets voltage, parallel adds capacity and shares current.">
            <SliderRow label="Series (S)" value={inputs.series} min={2} max={16} step={1} onChange={(v) => set("series", v)} />
            <SliderRow label="Parallel (P)" value={inputs.parallel} min={1} max={6} step={1} onChange={(v) => set("parallel", v)} />
            <div className="flex flex-wrap gap-1.5 pt-1">
              <TechBadge>{inputs.series}S{inputs.parallel}P</TechBadge>
              <TechBadge>{inputs.series * inputs.parallel} cells</TechBadge>
              <TechBadge>{(inputs.series * getCell(inputs.cellId).nominalVoltage).toFixed(0)} V</TechBadge>
            </div>
          </ControlGroup>

          <ControlGroup icon={Wind} title="Thermal management" hint={getCooling(inputs.coolingId).description}>
            <Select value={inputs.coolingId} onValueChange={(v) => set("coolingId", v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {COOLING.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              {getCooling(inputs.coolingId).pros.map((p) => (
                <span key={p} className="rounded bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5">+ {p}</span>
              ))}
              {getCooling(inputs.coolingId).cons.map((p) => (
                <span key={p} className="rounded bg-red-500/10 text-red-400 px-1.5 py-0.5">− {p}</span>
              ))}
            </div>
          </ControlGroup>

          <ControlGroup icon={CloudSun} title="Operating conditions">
            <SliderRow label="Ambient temperature" value={inputs.ambientC} min={-5} max={45} step={1} unit="°C" onChange={(v) => set("ambientC", v)} marks={["-5 cold", "25 rated", "45 hot"]} />
            <div>
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-xs text-muted-foreground">Depth of discharge</span>
                <span className="font-mono text-xs tabular-nums">{Math.round(inputs.dod * 100)}%</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {DOD_OPTIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => set("dod", d)}
                    className={`rounded-md border py-1 font-mono text-xs transition-colors ${
                      inputs.dod === d ? "border-primary/60 bg-primary/15 text-primary" : "border-border/50 bg-card/40 text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {d * 100}%
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground leading-snug">
                Deeper discharge buys capacity but costs cycle life (case-study ageing trade-off).
              </p>
            </div>
          </ControlGroup>

          <ControlGroup icon={BatteryCharging} title="Electrical loading">
            <SliderRow label="Target charge C-rate (per cell)" value={inputs.chargeCrate} min={0.1} max={3} step={0.05} unit="C" onChange={(v) => set("chargeCrate", Math.round(v * 20) / 20)} marks={["0.1 slow", "1C fast", "3C max"]} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">Continuous load (W)</Label>
                <Input type="number" className="h-8 mt-1 font-mono text-xs" value={inputs.continuousLoadW} min={10} max={5000}
                  onChange={(e) => set("continuousLoadW", Math.max(1, Number(e.target.value) || 0))} />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Peak load (W)</Label>
                <Input type="number" className="h-8 mt-1 font-mono text-xs" value={inputs.peakLoadW} min={10} max={8000}
                  onChange={(e) => set("peakLoadW", Math.max(1, Number(e.target.value) || 0))} />
              </div>
            </div>
          </ControlGroup>

          <ControlGroup icon={Target} title="Requirement target">
            <div>
              <Label className="text-[11px] text-muted-foreground">Required usable energy (Wh)</Label>
              <Input type="number" className="h-8 mt-1 font-mono text-xs" value={inputs.targetUsableWh} min={50} max={3000}
                onChange={(e) => set("targetUsableWh", Math.max(10, Number(e.target.value) || 0))} />
              <p className="mt-1 text-[10px] text-muted-foreground leading-snug">
                Requirement R2 on the Traceability tab verifies against this number.
              </p>
            </div>
          </ControlGroup>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => { setInputs(DEFAULT_INPUTS); toast({ title: "Reset to baseline preset" }); }}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          </div>
        </div>

        {/* Results column */}
        <div className="space-y-4 min-w-0">
          {/* save bar */}
          <Card className="bg-card/70">
            <CardContent className="p-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 mr-auto">
                <CalendarClock className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-xs font-semibold">Save this run for comparison</div>
                  <div className="text-[11px] text-muted-foreground">Repeatable evidence: snapshot the exact configuration and its scores.</div>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => onSave("baseline")} className="gap-1.5">
                <Save className="h-3.5 w-3.5" /> Baseline
              </Button>
              <Button size="sm" variant="outline" onClick={() => onSave("optionA")} className="gap-1.5">
                <Save className="h-3.5 w-3.5" /> Option A
              </Button>
              <Button size="sm" onClick={() => onSave("optionB")} className="gap-1.5">
                <Save className="h-3.5 w-3.5" /> Option B
              </Button>
            </CardContent>
          </Card>

          <ResultsPanel r={r} />
        </div>
      </div>
    </div>
  );
}

function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/* tiny hook so designer state survives tab switches within the page */
function useLocalInputs(): [PackInputs, Dispatch<SetStateAction<PackInputs>>] {
  const [state, setState] = useState<PackInputs>(() => {
    if (typeof window === "undefined") return DEFAULT_INPUTS;
    try {
      const raw = sessionStorage.getItem("bess-inputs");
      return raw ? { ...DEFAULT_INPUTS, ...JSON.parse(raw) } : DEFAULT_INPUTS;
    } catch {
      return DEFAULT_INPUTS;
    }
  });
  useEffect(() => {
    sessionStorage.setItem("bess-inputs", JSON.stringify(state));
  }, [state]);
  return [state, setState];
}
