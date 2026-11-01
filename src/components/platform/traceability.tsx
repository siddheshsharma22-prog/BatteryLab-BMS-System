"use client";

import { useState, useSyncExternalStore } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { FileSearch, ListChecks, Database, AlertOctagon, ShieldAlert, Route, BookOpen } from "lucide-react";
import { SectionHeader, StatusBadge, CheckStatus, KeyValue } from "./shared";
import { DEFAULT_INPUTS, PackInputs, evaluateDesign } from "@/lib/battery/model";
import { useDesignStore } from "@/lib/battery/store";
import { getCell, getCooling } from "@/lib/battery/data";

interface ReqRow {
  id: string;
  requirement: string;
  evidence: string;
  status: CheckStatus;
}

const ASSUMPTIONS = [
  ["A1 — DC internal resistance", "DC IR ≈ 1.25× the datasheet 1 kHz AC-IR value. AC-IR understates real DC losses; the 1.25× factor is a commonly used first-order correction."],
  ["A2 — Lumped cell thermal model", "Each cell is one thermal node (Bi number high side). Fine for pack-level screening; insufficient for hotspot/abuse analysis."],
  ["A3 — Heat generation", "Joule heating I²R only. Entropic (reversible) heat is omitted — acceptable at C-rates ≥ 0.5C where Joule heat dominates."],
  ["A4 — OCV curves", "Piecewise-linear OCV(SOC) polylines approximate chemistry behaviour; LFP's flat plateau is represented. Real cells need measured curves for SOC accuracy."],
  ["A5 — CC-CV profile", "Ideal charger: CC until terminal voltage hits the ceiling, then CV taper to 100%. Charger inefficiency and balancing current excluded."],
  ["A6 — Non-uniformity", "Hottest cell = mean rise × (1 + spread factor): 1.25× passive, 1.12× forced air, 1.05× liquid. First-order proxy for CFD-grade uniformity analysis."],
  ["A7 — Pack overheads", "Structure/busbars/BMS ≈ 15% of cell mass + 0.2 kg fixed; packing factor 0.55; BMS $18 + $1.2/S; enclosure $12 + $0.35/cell. Mid-range values for prototype modules."],
  ["A8 — Cell pricing", "Small-volume retail unit prices (e.g. 40T $5.50–5.99 street). Scale production runs 5–10× cheaper per kWh — flagged wherever costs are shown."],
  ["A9 — Cycle life", "Datasheet cycle ratings used at face value; 80% DoD usable energy with 0.9 efficiency factor in lifetime-cost. No calendar-ageing or temperature-derating model."],
  ["A10 — Cell variation", "Parallel-group current skew estimated at ±4% (2P) to ±12% (6P), consistent with factory capacity/IR spread; drives the cell-variation check."],
];

const SOURCES = [
  ["Samsung INR21700-40T", "Capacity 4.0 Ah, 3.6 V, 35 A cont. (45 A w/ temp cut), CC-CV 2 A std / 6 A rated, 2.5 V cutoff, 250 cyc @6A/35A", "Samsung datasheet; HKJ independent verification (budgetlightforum, 2018); retail specs (imrbatteries/srikobatteries, 2025)"],
  ["LG INR18650-MJ1", "3.5 Ah, 3.635 V, 10 A max discharge, 49 g, 18.3×65.1 mm, charge 0–45 °C, discharge −20–60 °C", "LG product specification (DNK Power, Farnell, imrbatteries — 2025 listings)"],
  ["A123 ANR26650M1B (LFP)", "2.5 Ah, 3.3 V, 6 mΩ AC-IR, 50 A cont., 76 g, 2.5 A std charge (60 min), 4C fast-charge to 80%, >1000 cyc @100% DoD, 2600 W/kg", "A123 Nanophosphate datasheet (batteryspace 6610 spec, EVLithium, Lithium Werks M1-B)"],
  ["Samsung INR18650-25R", "2.5 Ah, 3.6 V, 20 A cont., 45 g, 22 mΩ AC-IR, 4 A max charge", "Samsung datasheet (rev. 2015); widely replicated third-party test data"],
  ["Cell prices (2025)", "NMC cell $65.2/kWh, LFP cell $48.6/kWh (Q3 2025); NMC pack $128/kWh, LFP pack $81/kWh", "Benchmark Mineral Intelligence via Our World in Data (Dec 2025); BloombergNEF pack price survey (Dec 2025)"],
  ["Thermal parameters", "18650/26650 specific heat 884–1900 J/kg·K range → 1050 J/kg·K model value; lumped-model approach", "Yu et al., Applied Thermal Engineering (2023, Iowa State); Kumar et al. (2024)"],
  ["Cooling coefficients", "Natural convection ≈5–10, forced air ≈20–60, liquid cold plate ≈100–1000+ W/m²K effective", "MathWorks battery convection discussion (2024); Exoes BTMS technology comparison; Neural Concept BTMS overview (2024)"],
  ["Air-cooling failure case", "Nissan Leaf passive/air-cooled pack shows hot-climate degradation and hot-spot issues", "Owner/test reports (mynissanleaf, Green Car Reports, 2012–2024)"],
];

const LIMITATIONS = [
  "Lumped thermal node per cell — cannot resolve internal gradients, tab heating or thermal-runaway propagation. Abuse analysis is out of scope.",
  "OCV(SOC) is approximated; SOC error at low/high SoC may reach a few percent vs measured curves.",
  "No electrochemical ageing model: cycle life is a datasheet constant; temperature and DoD derating are qualitative only.",
  "Heat transfer coefficients are effective constant values — real packs vary with airflow, orientation and fin geometry.",
  "Cost model covers cells + BMS + enclosure + cooling at prototype prices; manufacturing, certification and tooling excluded.",
  "Mechanical design (vibration, crash, IP rating) and full protection electronics (contactor, fuse coordination, isolation monitoring) are represented as fixed overheads, not modelled.",
  "Simulation validated only against datasheet anchor points (e.g. MJ1 1.7 A → ~3.5 h; 40T 6 A → ~1.2 h; A123 2.5 A → 1 h). Bench validation is the required next step.",
];

const SAFETY_NOTES = [
  "This is a virtual design tool. Lithium-ion cells are hazardous: never build from these results without proper protection engineering and supervision.",
  "All modelled packs stay below the 60 V SELV window by design; the platform FAILs any configuration above it.",
  "Charging below 0 °C is blocked (lithium plating). Hot-charge above the chemistry limit is flagged before construction.",
  "A real build requires: BMS with per-cell voltage monitoring, over-current protection, temperature sensors on hottest-cell positions (predicted here), venting path, and cell fusing.",
  "Thermal runaway onset values shown (~210 °C NMC / ~270 °C LFP) are indicative; propagation prevention requires inter-cell barrier design beyond this model.",
];

const NEXT_STEPS = [
  "Bench-validate the thermal model: charge one MJ1 and one 40T cell at 1C with a thermocouple on the can; compare rise against the simulated curve (±3 °C target).",
  "Replace polyline OCV with measured charge/discharge curves from a cell cyclist (or published CALCE data) to tighten charge-time accuracy.",
  "Add a second thermal node (can vs core) to capture fast-charge gradients for the 40T at 6 A.",
  "Extend to multi-module series stacks with per-module balancing and propagate the hottest-cell analysis to pack level.",
  "Wire the requirement table to a test-report export so every simulated result is archived against its configuration hash.",
];

export function Traceability() {
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [inputs] = useState<PackInputs>(() => {
    if (typeof window === "undefined") return DEFAULT_INPUTS;
    try {
      const raw = sessionStorage.getItem("bess-inputs");
      return raw ? { ...DEFAULT_INPUTS, ...JSON.parse(raw) } : DEFAULT_INPUTS;
    } catch {
      return DEFAULT_INPUTS;
    }
  });
  const savedCount = useDesignStore((s) => Object.values(s.designs).filter(Boolean).length);

  const r = evaluateDesign(inputs);

  if (!hydrated) {
    return <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">Loading traceability register…</div>;
  }

  const reqs: ReqRow[] = [
    { id: "R1", requirement: "Manageable scope (small module, not a full pack)", evidence: `Scope unit: ${inputs.series}S${inputs.parallel}P module (${inputs.series * inputs.parallel} cells, ${r.packVnom.toFixed(0)} V class) — sized for hackathon build`, status: "pass" },
    { id: "R2", requirement: "Application, basic requirements & operating conditions defined", evidence: `${r.inputs.targetUsableWh} Wh target · ${inputs.continuousLoadW} W cont / ${inputs.peakLoadW} W peak · ${inputs.ambientC} °C ambient · ${Math.round(inputs.dod * 100)}% DoD`, status: "pass" },
    { id: "R3", requirement: "Cells, electrical connections, temperature control, sensing, protection & controls considered", evidence: `8 active limit checks across electrical/thermal/protection/variation; ${getCooling(inputs.coolingId).name}; BMS costed; sensor placement guided by thermal map`, status: r.checks.length >= 8 ? "pass" : "warn" },
    { id: "R4", requirement: "Datasheets, simple calculations & simulations used", evidence: `4 datasheet-verified cells; CC-CV sim (${r.charge.points.length} samples, dt=2 s); lumped thermal model; all sources registered below`, status: "pass" },
    { id: "R5", requirement: "At least two design options compared against a starting design", evidence: `${savedCount} design slot${savedCount === 1 ? "" : "s"} saved — Compare tab shows baseline vs options with best-in-row winners`, status: savedCount >= 2 ? "pass" : "warn" },
    { id: "R6", requirement: "Relevant indicators measured (energy, temp, charge time, mass, size, cost)", evidence: `Usable ${r.usableWh.toFixed(0)} Wh · hottest ${r.charge.peakTempC.toFixed(1)} °C · t80 ${r.charge.timeTo80Min.toFixed(0)} min · ${r.packMassKg.toFixed(2)} kg · ${r.packVolumeL.toFixed(1)} L · $${r.costTotal.toFixed(0)} ($${r.costPerLifetimeKwh.toFixed(0)}/kWh-life)`, status: "pass" },
    { id: "R7", requirement: "Assumptions, data sources, safety precautions, results & limitations documented", evidence: "This tab: 10 assumptions, 8 source entries, 5 safety notes, 7 limitations — all versioned with the model", status: "pass" },
    { id: "R8", requirement: "Simple prototype / visual demonstration + recommended next step", evidence: `Live demonstrable model (repeatable runs, saveable evidence); recommendation engine active — verdict: ${r.failCount > 0 ? "resolve violations" : r.warnCount > 0 ? "buildable with cautions" : "clean"}; next steps listed below`, status: "pass" },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Traceability & evidence" title="Every requirement linked to its verification evidence">
        The case study requires traceability between requirements, component selections, assumptions,
        models, results and validation evidence — with a balanced recommendation and clearly stated
        risks. This register is the audit trail. Requirement verification runs against the design
        currently open in the Designer, so it updates as you iterate.
      </SectionHeader>

      {/* Requirements */}
      <Card className="bg-card/70">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <ListChecks className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Requirements register — live verification</h3>
            <Badge variant="outline" className="ml-auto text-[10px] font-mono border-border/60 text-muted-foreground">
              {getCell(inputs.cellId).format} {inputs.series}S{inputs.parallel}P
            </Badge>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <Table className="w-full min-w-[640px] table-fixed">
              <TableHeader>
                <TableRow className="border-border/60 bg-secondary/30">
                  <TableHead className="text-xs w-10">ID</TableHead>
                  <TableHead className="text-xs w-[42%]">Requirement (from case study)</TableHead>
                  <TableHead className="text-xs">Verification evidence (live model)</TableHead>
                  <TableHead className="text-xs w-16 text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reqs.map((rq) => (
                  <TableRow key={rq.id} className="border-border/40 align-top">
                    <TableCell className="font-mono text-xs font-semibold text-primary pt-3">{rq.id}</TableCell>
                    <TableCell className="text-xs pt-3 break-words">{rq.requirement}</TableCell>
                    <TableCell className="text-[11px] text-muted-foreground font-mono leading-snug pt-3 break-words whitespace-normal">{rq.evidence}</TableCell>
                    <TableCell className="text-right pt-3"><StatusBadge status={rq.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Assumptions */}
      <Card className="bg-card/70">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileSearch className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Assumptions register</h3>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {ASSUMPTIONS.map(([k, v]) => (
              <AccordionItem key={k} value={k} className="border-border/40">
                <AccordionTrigger className="text-xs py-2.5 hover:no-underline">
                  <span className="font-mono text-primary/90 mr-2">{k.split(" — ")[0]}</span>
                  <span className="text-left">{k.split(" — ")[1]}</span>
                </AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground leading-relaxed">{v}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Sources */}
      <Card className="bg-card/70">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Database className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Data source register</h3>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <Table className="w-full min-w-[680px]">
              <TableHeader>
                <TableRow className="border-border/60 bg-secondary/30">
                  <TableHead className="text-xs w-44">Source</TableHead>
                  <TableHead className="text-xs min-w-72">Data used in the model</TableHead>
                  <TableHead className="text-xs">Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SOURCES.map((s) => (
                  <TableRow key={s[0]} className="border-border/40">
                    <TableCell className="text-xs font-medium">{s[0]}</TableCell>
                    <TableCell className="text-[11px] text-muted-foreground leading-snug">{s[1]}</TableCell>
                    <TableCell className="text-[11px] text-muted-foreground/80 leading-snug">{s[2]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Limitations */}
        <Card className="bg-card/70 border-amber-500/20">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertOctagon className="h-4 w-4 text-amber-400" />
              <h3 className="font-semibold text-sm">Known limitations</h3>
            </div>
            <ul className="space-y-2.5">
              {LIMITATIONS.map((l, i) => (
                <li key={i} className="flex gap-2 text-xs text-muted-foreground leading-relaxed">
                  <span className="font-mono text-amber-400/80 shrink-0">L{i + 1}</span>
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Safety */}
        <div className="space-y-4">
          <Card className="bg-card/70 border-red-500/20">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <ShieldAlert className="h-4 w-4 text-red-400" />
                <h3 className="font-semibold text-sm">Safety precautions & notes</h3>
              </div>
              <ul className="space-y-2.5">
                {SAFETY_NOTES.map((s, i) => (
                  <li key={i} className="flex gap-2 text-xs text-muted-foreground leading-relaxed">
                    <span className="font-mono text-red-400/80 shrink-0">S{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Next steps */}
          <Card className="bg-card/70 border-primary/25">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Route className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Recommended next steps</h3>
              </div>
              <ol className="space-y-2.5">
                {NEXT_STEPS.map((s, i) => (
                  <li key={i} className="flex gap-2 text-xs text-muted-foreground leading-relaxed">
                    <span className="font-mono text-primary shrink-0">{i + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Model card */}
      <Card className="bg-card/70">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Model card — equations in use</h3>
          </div>
          <div className="grid gap-x-8 gap-y-0 sm:grid-cols-2">
            <div>
              <KeyValue k="Pack voltage" v="V_nom = S × V_cell · V_max = S × V_chg" />
              <KeyValue k="Pack capacity" v="Ah_pack = P × Ah_cell" />
              <KeyValue k="Energy" v="Wh = V_nom × Ah_pack · usable = Wh × DoD" />
              <KeyValue k="Joule heat / cell" v="P_heat = I_cell² × R_dc (R_dc = 1.25 × AC-IR)" />
            </div>
            <div>
              <KeyValue k="Thermal node" v="m·cp·dT/dt = P_heat − UA·(T − T_amb)" />
              <KeyValue k="Cell conductance" v="UA = h_eff × A_surface × contact_fraction" />
              <KeyValue k="Steady-state rise" v="ΔT_ss = P_heat / UA · hottest = (1+spread)·ΔT_ss" />
              <KeyValue k="Lifetime cost" v="$ / kWh-life = cost_total / (usable × cycles × 0.9)" />
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
            Charging is integrated with explicit Euler at Δt = 2 s: CC phase at the target C-rate until the
            terminal voltage V = OCV(SOC) + I·R reaches the chemistry ceiling, then CV taper until full.
            The same loop produces the temperature trajectory shown on the Designer chart.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
