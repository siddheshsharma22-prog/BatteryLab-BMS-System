"use client";

import { create } from "zustand";
import {
  blankDesign, designIssues,
  type CellDesign, type PackConfig, type SimParams, type SimPoint,
  type RunSummary, type SafetyCheck, type CustomSegment, type Chemistry,
} from "./engine";
import {
  DEFAULT_ASSUMPTIONS, DEFAULT_REQUIREMENTS, DEFAULT_BMS_SPEC, DEFAULT_WEIGHTS,
  type Assumptions, type Requirements, type BmsSpec, type RecommendationWeights,
  type CoolingTier, type AltInput,
} from "./engineering";
import { cellToDesign, type LibraryCell } from "./library";

export interface SimResponse {
  series: SimPoint[];
  summary: RunSummary;
  checks: SafetyCheck[];
  runId?: string;
}

export interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
}

// Pack state = electrical configuration + the design targets that size it.
// targetV/targetAh are set in the Design tab and pre-load S×P in Connection.
export interface PackUIState extends PackConfig {
  targetV: number;
  targetAh: number;
}

export const blankPack = (): PackUIState => ({ series: 1, parallel: 1, targetV: 0, targetAh: 0 });

// Keys the AI is allowed to patch via its __apply suggestion
export const AI_DESIGN_KEYS = [
  "name", "brand", "model", "chemistry", "formFactor", "cathode", "anode",
  "separator", "electrolyte", "application", "sourceRef",
  "capacityAh", "nominalV", "vmax", "vmin",
  "r0", "r1", "c1", "r2", "c2",
  "maxDischargeC", "maxPulseDischargeC", "maxChargeC", "stdChargeC",
  "diameterMm", "lengthMm", "widthMm", "heightMm", "thicknessMm",
  "massKg", "cpJkgK", "areaM2", "entropicVperK",
  "cycleLifeCycles", "cycleLifeNote",
  "chargeTempMinC", "chargeTempMaxC", "dischargeTempMinC", "dischargeTempMaxC",
  "selfDischargePctMonth",
] as const;

const NUM_KEYS = new Set([
  "capacityAh", "nominalV", "vmax", "vmin", "r0", "r1", "c1", "r2", "c2",
  "maxDischargeC", "maxPulseDischargeC", "maxChargeC", "stdChargeC",
  "diameterMm", "lengthMm", "widthMm", "heightMm", "thicknessMm",
  "massKg", "cpJkgK", "areaM2", "entropicVperK",
  "cycleLifeCycles",
  "chargeTempMinC", "chargeTempMaxC", "dischargeTempMinC", "dischargeTempMaxC",
  "selfDischargePctMonth",
]);
const STRING_KEYS = new Set([
  "brand", "model", "formFactor", "cathode", "anode", "separator",
  "electrolyte", "application", "sourceRef", "cycleLifeNote",
]);
const CHEMS: Chemistry[] = ["NMC", "LFP", "LTO", "LCO", "NCA", "LeadAcid", "NiMH", "NiCd"];

export function sanitizeAiPatch(raw: unknown): {
  design?: Partial<CellDesign>;
  pack?: Partial<PackConfig>;
} {
  const out: { design?: Partial<CellDesign>; pack?: Partial<PackConfig> } = {};
  if (!raw || typeof raw !== "object") return out;
  const obj = raw as Record<string, unknown>;
  const inner = (obj.__apply ?? obj) as Record<string, unknown>;

  if (inner.design && typeof inner.design === "object") {
    const d: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(inner.design as Record<string, unknown>)) {
      if (!(AI_DESIGN_KEYS as readonly string[]).includes(k)) continue;
      if (k === "name") {
        if (typeof v === "string" && v.trim()) d.name = v.trim().slice(0, 60);
      } else if (k === "chemistry") {
        if (typeof v === "string" && CHEMS.includes(v.toUpperCase() as Chemistry)) d.chemistry = v.toUpperCase();
      } else if (STRING_KEYS.has(k)) {
        if (typeof v === "string") d[k] = v.slice(0, 200);
      } else {
        const n = typeof v === "number" ? v : parseFloat(String(v));
        if (Number.isFinite(n) && n >= 0) d[k] = n;
      }
    }
    if (Object.keys(d).length > 0) out.design = d as Partial<CellDesign>;
  }

  if (inner.pack && typeof inner.pack === "object") {
    const p: Record<string, unknown> = {};
    for (const k of ["series", "parallel"] as const) {
      const n = (inner.pack as Record<string, unknown>)[k];
      const num = typeof n === "number" ? n : parseFloat(String(n));
      if (Number.isFinite(num)) {
        p[k] = Math.max(1, Math.round(Math.min(k === "series" ? 200 : 50, num)));
      }
    }
    if (Object.keys(p).length > 0) out.pack = p as Partial<PackConfig>;
  }
  return out;
}

// Extract the last parsable ```json {"__apply": ...}``` block from an AI reply
export function extractApplyPatch(content: string): { patch: ReturnType<typeof sanitizeAiPatch>; stripped: string } | null {
  const re = /```(?:json)?\s*([\s\S]*?)```/g;
  let last: { json: string; index: number; end: number } | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) last = { json: m[1], index: m.index, end: m.index + m[0].length };
  if (!last) return null;
  try {
    const parsed = JSON.parse(last.json.trim());
    const patch = sanitizeAiPatch(parsed);
    if (!patch.design && !patch.pack) return null;
    const stripped = (content.slice(0, last.index) + content.slice(last.end)).replace(/\n{3,}/g, "\n\n").trim();
    return { patch, stripped };
  } catch {
    return null;
  }
}

export const defaultSimParams: SimParams = {
  profile: "discharge",
  cRate: 1,
  durationS: 3600,
  ambientC: 25,
  hConv: 10,
  socStart: 1,
  coolingOn: false,
  customSegments: [] as CustomSegment[],
};

// ------------------------------------------------------------
// Engineering state — requirements, assumptions, BMS spec,
// design alternatives for A/B/C comparison. Stored alongside
// the design/pack/simParams so the Engineering tab reads from
// the same source of truth as the rest of the wizard.
// ------------------------------------------------------------

export interface DesignAlternative {
  id: string;
  name: string;
  // A snapshot of the design + pack + cooling choice. Cloned from
  // the current Design+Connection state when the user clicks
  // "Save current as Alternative".
  design: CellDesign;
  pack: PackConfig;
  cooling: CoolingTier;
  // Optional reference to a stored TestRun id — when present, the
  // scoring pulls the peak temp / charge time from that run.
  runId?: string;
}

interface LabState {
  design: CellDesign;
  pack: PackUIState;
  simParams: SimParams;
  lastResult: SimResponse | null;
  running: boolean;
  activeTab: string;
  // Schematic build progress on the Connection tab: stage 0–3 and the S×P it
  // was built for. Derived stage resets to 0 whenever S×P no longer matches.
  build: { stage: number; s: number; p: number };
  // Workflow steps the user has already opened (drives nav checkmarks).
  visitedSteps: string[];

  copilotOpen: boolean;
  copilotMessages: CopilotMessage[];
  copilotBusy: boolean;

  // Engineering module
  requirements: Requirements;
  assumptions: Assumptions;
  bmsSpec: BmsSpec;
  alternatives: DesignAlternative[];
  recommendationWeights: RecommendationWeights;

  setActiveTab: (t: string) => void;
  setBuildStage: (v: number) => void;
  updateDesign: (patch: Partial<CellDesign>) => void;
  resetDesign: () => void;
  loadLibraryCell: (cell: LibraryCell) => void;
  setPack: (patch: Partial<PackUIState>) => void;
  setSimParams: (patch: Partial<SimParams>) => void;
  setRunning: (r: boolean) => void;
  setLastResult: (r: SimResponse | null) => void;

  setRequirements: (patch: Partial<Requirements>) => void;
  setAssumptions: (patch: Partial<Assumptions>) => void;
  setBmsSpec: (patch: Partial<BmsSpec>) => void;
  setRecommendationWeights: (patch: Partial<RecommendationWeights>) => void;
  addAlternative: (name?: string) => string;
  removeAlternative: (id: string) => void;
  renameAlternative: (id: string, name: string) => void;
  setAlternativeCooling: (id: string, cooling: CoolingTier) => void;
  clearAlternatives: () => void;

  setCopilotOpen: (v: boolean) => void;
  sendCopilotMessage: (content: string) => Promise<void>;
  clearCopilot: () => void;
  applyAiPatch: (patch: { design?: Partial<CellDesign>; pack?: Partial<PackConfig> }) => void;
}

export const useLabStore = create<LabState>((set, get) => ({
  design: blankDesign(),
  pack: blankPack(),
  simParams: defaultSimParams,
  lastResult: null,
  running: false,
  activeTab: "design",
  build: { stage: 0, s: 1, p: 1 },
  visitedSteps: ["design"],

  copilotOpen: false,
  copilotMessages: [],
  copilotBusy: false,

  // Engineering module — sensible defaults; everything is editable.
  requirements: { ...DEFAULT_REQUIREMENTS },
  assumptions: { ...DEFAULT_ASSUMPTIONS, cellPricePerWh: { ...DEFAULT_ASSUMPTIONS.cellPricePerWh }, coolingOverhead: { ...DEFAULT_ASSUMPTIONS.coolingOverhead } },
  bmsSpec: { ...DEFAULT_BMS_SPEC },
  alternatives: [],
  recommendationWeights: { ...DEFAULT_WEIGHTS },

  setActiveTab: (t) =>
    set((s) => ({
      activeTab: t,
      visitedSteps: s.visitedSteps.includes(t) ? s.visitedSteps : [...s.visitedSteps, t],
    })),
  setBuildStage: (v) =>
    set((s) => ({ build: { stage: v, s: s.pack.series, p: s.pack.parallel } })),
  updateDesign: (patch) => set((s) => ({ design: { ...s.design, ...patch } })),
  resetDesign: () =>
    set({ design: blankDesign(), pack: blankPack(), build: { stage: 0, s: 1, p: 1 }, lastResult: null }),
  // Load a real datasheet cell as the user's EDITABLE starting point:
  // the design stays theirs — every loaded value can be changed after.
  loadLibraryCell: (cell) =>
    set((s) => ({
      design: { ...blankDesign(), ...cellToDesign(cell) },
      pack: blankPack(),
      build: { stage: 0, s: 1, p: 1 },
      lastResult: null,
      activeTab: s.activeTab,
    })),
  setPack: (patch) => set((s) => ({ pack: { ...s.pack, ...patch } })),
  setSimParams: (patch) => set((s) => ({ simParams: { ...s.simParams, ...patch } })),
  setRunning: (r) => set({ running: r }),
  setLastResult: (r) => set({ lastResult: r }),

  setRequirements: (patch) => set((s) => ({ requirements: { ...s.requirements, ...patch } })),
  setAssumptions: (patch) => set((s) => ({ assumptions: { ...s.assumptions, ...patch } })),
  setBmsSpec: (patch) => set((s) => ({ bmsSpec: { ...s.bmsSpec, ...patch } })),
  setRecommendationWeights: (patch) => set((s) => ({ recommendationWeights: { ...s.recommendationWeights, ...patch } })),

  // Add the current Design+Connection state as a named alternative.
  // Returns the new id so the UI can highlight it.
  addAlternative: (name) => {
    const st = get();
    const id = `alt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const alt: DesignAlternative = {
      id,
      name: name?.trim() || `Option ${String.fromCharCode(65 + st.alternatives.length)}`, // A, B, C…
      design: { ...st.design },
      pack: { series: st.pack.series, parallel: st.pack.parallel },
      cooling: st.simParams.coolingOn
        ? (st.simParams.hConv >= 100 ? "liquid" : st.simParams.hConv >= 25 ? "forcedAir" : "naturalAir")
        : "none",
      runId: st.lastResult?.runId,
    };
    set((s) => ({ alternatives: [...s.alternatives, alt] }));
    return id;
  },
  removeAlternative: (id) => set((s) => ({ alternatives: s.alternatives.filter((a) => a.id !== id) })),
  renameAlternative: (id, name) =>
    set((s) => ({ alternatives: s.alternatives.map((a) => (a.id === id ? { ...a, name: name.slice(0, 40) } : a)) })),
  setAlternativeCooling: (id, cooling) =>
    set((s) => ({ alternatives: s.alternatives.map((a) => (a.id === id ? { ...a, cooling } : a)) })),
  clearAlternatives: () => set({ alternatives: [] }),

  setCopilotOpen: (v) => set({ copilotOpen: v }),

  sendCopilotMessage: async (content) => {
    const trimmed = content.trim();
    if (!trimmed || get().copilotBusy) return;
    const messages: CopilotMessage[] = [...get().copilotMessages, { role: "user", content: trimmed }];
    set({ copilotMessages: messages, copilotBusy: true, copilotOpen: true });

    const st = get();
    const context = {
      activeTab: st.activeTab,
      design: st.design,
      designIssues: designIssues(st.design),
      pack: st.pack,
      simParams: {
        profile: st.simParams.profile,
        cRate: st.simParams.cRate,
        durationS: st.simParams.durationS,
        ambientC: st.simParams.ambientC,
        hConv: st.simParams.hConv,
        socStart: st.simParams.socStart,
        coolingOn: st.simParams.coolingOn,
        customSegmentCount: st.simParams.customSegments.length,
      },
      lastResult: st.lastResult
        ? { summary: st.lastResult.summary, checks: st.lastResult.checks }
        : null,
      // Engineering module context — gives the copilot visibility into
      // the requirements, cost, ageing and any saved alternatives so it
      // can comment on trade-offs and recommendations.
      requirements: st.requirements,
      assumptions: {
        structureAllowancePct: st.assumptions.structureAllowancePct,
        packOverheadPct: st.assumptions.packOverheadPct,
        cellPricePerWh: st.assumptions.cellPricePerWh,
        ocpSafetyFactor: st.assumptions.ocpSafetyFactor,
        fuseDerating: st.assumptions.fuseDerating,
        contactorDerating: st.assumptions.contactorDerating,
      },
      alternatives: st.alternatives.length,
      recommendationWeights: st.recommendationWeights,
    };

    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.slice(-14).map((m) => ({ role: m.role, content: m.content })),
          context,
        }),
      });
      const data = await res.json();
      const reply = res.ok && data.reply
        ? String(data.reply)
        : "I could not reach the AI service just now. Please try again in a moment.";
      set((s) => ({
        copilotMessages: [...s.copilotMessages, { role: "assistant", content: reply }],
        copilotBusy: false,
      }));
    } catch {
      set((s) => ({
        copilotMessages: [
          ...s.copilotMessages,
          { role: "assistant", content: "Network error — I could not reach the AI service. Please try again." },
        ],
        copilotBusy: false,
      }));
    }
  },

  clearCopilot: () => set({ copilotMessages: [] }),

  applyAiPatch: (patch) => {
    if (patch.design) set((s) => ({ design: { ...s.design, ...patch.design } }));
    if (patch.pack) set((s) => ({ pack: { ...s.pack, ...patch.pack } }));
  },
}));
