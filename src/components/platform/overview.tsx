"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Zap, Flame, Scale, GitCompareArrows, FileSearch, Layers,
  Thermometer, Gauge, ShieldCheck, CircleDollarSign, ArrowRight, Cpu, PackageSearch,
} from "lucide-react";
import { SectionHeader, TechBadge } from "./shared";
import { CELLS, COOLING, CHEMISTRY_SCALE_PRICE } from "@/lib/battery/data";

const CHALLENGES = [
  {
    icon: Layers,
    title: "Distributed discipline data",
    body: "Cell electrical, thermal, mechanical, safety and control data live in separate datasheets and disciplines. VoltLab unifies four real datasheets plus thermal, cost and control parameters in one model so a single change propagates everywhere.",
  },
  {
    icon: Scale,
    title: "Conflicting objectives",
    body: "Improving capacity or charge speed degrades temperature, life, mass or cost. Every edit re-solves energy, charging, thermal, cost and safety models simultaneously and scores the trade-off, so you see what you gave up.",
  },
  {
    icon: Flame,
    title: "Cell-to-system propagation",
    body: "Cell variation, ageing and operating conditions propagate unpredictably. The platform models per-cell heat generation, hottest-cell non-uniformity, parallel-group imbalance and ambient effects up to pack level.",
  },
  {
    icon: Gauge,
    title: "Scarce test resources",
    body: "Real packs are too large and too dangerous for a short project. A physics-based virtual module replaces hardware: measurable, repeatable simulation runs in milliseconds on any browser.",
  },
];

const SCOPE_DECISIONS = [
  { k: "Scope unit", v: "1 pack module, 4–16S × 1–6P (≤ 60 V DC window)" },
  { k: "Cell menu", v: "2× NMC 18650, 1× NMC 21700, 1× LFP 26650 — all datasheet-verified" },
  { k: "Thermal options", v: "Passive air, forced air, liquid cold plate" },
  { k: "Physics fidelity", v: "Lumped thermal node + CC-CV charging sim (documented)" },
  { k: "Applications", v: "E-mobility, power station, drone — or custom load" },
  { k: "Evidence", v: "Repeatable runs, saved design slots, requirement traceability" },
];

const WORKFLOW = [
  { icon: Cpu, step: "1", title: "Configure", body: "Pick a real cell, size the S×P topology, choose cooling, set ambient, load and charge C-rate." },
  { icon: Zap, step: "2", title: "Simulate", body: "The engine re-solves sizing, CC-CV charging, lumped thermal behaviour and safety limits live." },
  { icon: GitCompareArrows, step: "3", title: "Compare", body: "Save Baseline / Option A / Option B and inspect the trade-off radar and per-criterion winners." },
  { icon: FileSearch, step: "4", title: "Decide & trace", body: "Adopt a balanced design with stated risks; every requirement links to model evidence." },
];

export function Overview({ onJump }: { onJump: (tab: string) => void }) {
  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-secondary/50 to-card p-6 md:p-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "linear-gradient(oklch(0.795 0.17 162 / 30%) 1px, transparent 1px), linear-gradient(90deg, oklch(0.795 0.17 162 / 30%) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-primary/15 text-primary border-primary/30 hover:bg-primary/15" variant="outline">
              Case Study 2 — Battery Energy System
            </Badge>
            <TechBadge>digital platform</TechBadge>
            <TechBadge>cell → pack → system</TechBadge>
          </div>
          <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight leading-tight">
            Design battery systems virtually.{" "}
            <span className="text-primary">Understand every trade-off.</span>
          </h1>
          <p className="mt-4 text-sm md:text-base text-muted-foreground leading-relaxed">
            VoltLab is a reusable digital platform for configuring, visualizing, analysing and comparing
            battery energy system designs from cell to system level. It integrates electrical, thermal,
            mechanical, sensing, protection, control and cost considerations into one workflow, flags
            interface conflicts and safety-limit violations, and keeps requirements traceable to evidence —
            exactly the workflow the case study demands, scoped to a hackathon-sized module.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={() => onJump("designer")} className="gap-2 font-semibold">
              Open the Designer <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => onJump("compare")} className="gap-2">
              <GitCompareArrows className="h-4 w-4" /> Compare designs
            </Button>
            <Button variant="ghost" onClick={() => onJump("trace")} className="gap-2">
              <FileSearch className="h-4 w-4" /> Traceability & sources
            </Button>
          </div>
        </div>
      </section>

      {/* Challenge mapping */}
      <section>
        <SectionHeader eyebrow="Problem understanding" title="Four systemic challenges, addressed head-on">
          The case study identifies why battery design is hard. Each VoltLab capability maps directly to one
          of those systemic problems rather than to a generic feature list.
        </SectionHeader>
        <div className="grid gap-4 md:grid-cols-2">
          {CHALLENGES.map((c) => (
            <Card key={c.title} className="bg-card/70">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/12 p-2 border border-primary/20">
                    <c.icon className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm">{c.title}</h3>
                </div>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{c.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Scope */}
      <section>
        <SectionHeader eyebrow="Manageable scope" title="One module, four real cells, three cooling strategies">
          A full EV pack is impossible in a short hackathon, so the platform scopes to a single low-voltage
          module sized for realistic applications. Everything scales: the same workflow extends to larger
          strings and multi-module packs without changing the model.
        </SectionHeader>
        <Card className="bg-card/70">
          <CardContent className="p-0">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 divide-y divide-border/40 sm:divide-y-0">
              {SCOPE_DECISIONS.map((s) => (
                <div key={s.k} className="p-4 border-b sm:border-b border-r border-border/40 [&:nth-child(3n)]:border-r-0 sm:[&:nth-child(3n)]:border-r-0">
                  <div className="text-[11px] uppercase tracking-wider text-primary/80 font-semibold">{s.k}</div>
                  <div className="mt-1 text-sm text-foreground/90">{s.v}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Workflow */}
      <section>
        <SectionHeader eyebrow="Unified engineering workflow" title="Configure → Simulate → Compare → Decide">
          Subsystem parameters exchange consistently through one shared model: a cell swap instantly updates
          the thermal simulation, cost roll-up, safety checks and requirement verification — no manual
          re-entry, no incompatible assumptions between tools.
        </SectionHeader>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WORKFLOW.map((w, i) => (
            <Card key={w.title} className="bg-card/70 relative overflow-hidden">
              <CardContent className="p-5">
                <div className="font-mono text-5xl font-bold text-primary/15 absolute right-3 top-2">{w.step}</div>
                <w.icon className="h-5 w-5 text-primary" />
                <h3 className="mt-3 font-semibold text-sm">{w.title}</h3>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{w.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Library snapshot */}
      <section>
        <SectionHeader eyebrow="Built on real data" title="The design space you can explore">
          Four datasheet-verified cells, three thermal management strategies and 2025 market cost
          benchmarks are loaded into the engine. All parameters and their sources are listed in the
          Traceability tab.
        </SectionHeader>
        <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
          <Card className="bg-card/70">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <PackageSearch className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Cell library</h3>
              </div>
              <div className="space-y-2.5">
                {CELLS.map((c) => (
                  <div key={c.id} className="rounded-lg border border-border/50 bg-secondary/30 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold">{c.name}</span>
                      <Badge
                        variant="outline"
                        className={c.chemistry === "LFP"
                          ? "border-emerald-500/40 text-emerald-400 text-[10px]"
                          : "border-amber-500/40 text-amber-400 text-[10px]"}
                      >
                        {c.chemistry}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground ml-auto">{c.tagline}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 sm:grid-cols-6 gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
                      <span>{c.capacityAh} Ah</span>
                      <span>{c.nominalVoltage} V</span>
                      <span>{c.internalResistanceMohm} mΩ</span>
                      <span>{c.maxDischargeA} A max</span>
                      <span>{c.weightG} g</span>
                      <span>${c.priceUsd.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card className="bg-card/70">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Thermometer className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Thermal strategies</h3>
                </div>
                <div className="space-y-2">
                  {COOLING.map((cl) => (
                    <div key={cl.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/30 px-3 py-2">
                      <span className="text-xs">{cl.name}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        h ≈ {cl.hEff} W/m²K
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/70">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CircleDollarSign className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">2025 cost benchmarks</h3>
                </div>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex justify-between"><span>NMC cell (scale)</span><span className="font-mono text-foreground">${CHEMISTRY_SCALE_PRICE.NMC.cellUsdPerKwh}/kWh</span></div>
                  <div className="flex justify-between"><span>LFP cell (scale)</span><span className="font-mono text-foreground">${CHEMISTRY_SCALE_PRICE.LFP.cellUsdPerKwh}/kWh</span></div>
                  <div className="flex justify-between"><span>NMC pack (scale)</span><span className="font-mono text-foreground">${CHEMISTRY_SCALE_PRICE.NMC.packUsdPerKwh}/kWh</span></div>
                  <div className="flex justify-between"><span>LFP pack (scale)</span><span className="font-mono text-foreground">${CHEMISTRY_SCALE_PRICE.LFP.packUsdPerKwh}/kWh</span></div>
                  <p className="pt-1 text-[11px] leading-snug">
                    The model uses small-volume retail cell prices, so results sit above these scale
                    benchmarks — a realistic premium for prototyping quantities.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Criteria mapping */}
      <section>
        <SectionHeader eyebrow="Assessment alignment" title="Where each judging criterion is evidenced">
          <div className="flex flex-wrap gap-2 mt-3">
            {[
              { icon: Layers, label: "Problem understanding → this page + scope table" },
              { icon: ShieldCheck, label: "Desirability → designer workflow for students/engineers" },
              { icon: Cpu, label: "Technical feasibility → documented physics, browser-only" },
              { icon: Gauge, label: "Engineering quality → equations & assumptions on Traceability" },
              { icon: Zap, label: "Prototype & evidence → live sim, repeatable saved runs" },
              { icon: Flame, label: "Innovation → trade-off radar + violation-aware scoring" },
              { icon: CircleDollarSign, label: "Business viability → 2025 cost benchmarks, $/lifetime-kWh" },
            ].map((m) => (
              <span key={m.label} className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/40 px-3 py-1 text-[11px]">
                <m.icon className="h-3 w-3 text-primary" /> {m.label}
              </span>
            ))}
          </div>
        </SectionHeader>
      </section>
    </div>
  );
}
