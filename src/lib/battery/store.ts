"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PackInputs } from "./model";

export type SlotId = "baseline" | "optionA" | "optionB";

export interface SavedDesign {
  slot: SlotId;
  label: string;
  savedAt: string;
  inputs: PackInputs;
  totalScore: number;
  usableWh: number;
  costTotal: number;
  chargeMinutes: number;
  peakTempC: number;
  packMassKg: number;
  failCount: number;
  warnCount: number;
  whPerKg: number;
  costPerLifetimeKwh: number;
  cellName: string;
  coolingName: string;
  scores: Record<string, number>;
}

interface DesignStore {
  designs: Record<SlotId, SavedDesign | null>;
  saveDesign: (slot: SlotId, label: string, d: Omit<SavedDesign, "slot" | "label" | "savedAt">) => void;
  clearSlot: (slot: SlotId) => void;
  clearAll: () => void;
}

export const SLOT_META: { id: SlotId; label: string; hint: string }[] = [
  { id: "baseline", label: "Baseline", hint: "Starting design to improve upon" },
  { id: "optionA", label: "Option A", hint: "First alternative design" },
  { id: "optionB", label: "Option B", hint: "Second alternative design" },
];

export const useDesignStore = create<DesignStore>()(
  persist(
    (set) => ({
      designs: { baseline: null, optionA: null, optionB: null },
      saveDesign: (slot, label, d) =>
        set((s) => ({
          designs: { ...s.designs, [slot]: { ...d, slot, label, savedAt: new Date().toISOString() } },
        })),
      clearSlot: (slot) => set((s) => ({ designs: { ...s.designs, [slot]: null } })),
      clearAll: () => set({ designs: { baseline: null, optionA: null, optionB: null } }),
    }),
    { name: "bess-design-slots" },
  ),
);
