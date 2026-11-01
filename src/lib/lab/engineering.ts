// ============================================================
// BatteryLab — Engineering module
// Cost model · Ageing model · Protection & interface-conflict
// checks · Requirements pass/fail · Recommendation scoring
//
// These functions wrap the physics engine and the pack math so a
// reviewer can answer the brief's higher-order questions:
//   • Is the design affordable?  (cost / kWh, BOM)
//   • Will it survive the warranty window?  (calendar + cycle ageing)
//   • Are the safety / control devices sized correctly?  (OVP/UVP/OCP/OTP,
//     fuse, contactor, BMS voltage range, thermistor count)
//   • Does it meet the stated requirements?  (target V/E, max T,
//     charge time, max cost, min cycle life)
//   • Which of several alternatives is the balanced choice?  (weighted
//     scoring with stated risks and limitations)
// All pure, side-effect free, client-safe.
// ============================================================

import type {
  CellDesign, Chemistry, PackConfig, RunSummary, SimParams,
} from "./engine";
import { packMath as packMathBase } from "./engine";

// ------------------------------------------------------------
// Assumptions — editable, surfaced in the UI as a panel so the
// 25% structure allowance (and every other fudge factor) is no
// longer hidden inside the engine. Defaults reproduce the prior
// behaviour exactly so existing runs stay consistent.
// ------------------------------------------------------------

export interface Assumptions {
  // Mass/energy density overheads
  structureAllowancePct: number;   // was hard-coded 0.25 in packMath
  packOverheadPct: number;         // BMS + housing + wiring mass on top of structure allowance (cost model only)

  // Cost model — cell price by chemistry ($/Wh) + pack overhead
  cellPricePerWh: Record<Chemistry, number>;
  packAssemblyPerCell: number;     // $ — BMS share, wiring, fixtures per cell
  coolingOverhead: {               // $ added to BOM when cooling is selected
    none: number; naturalAir: number; forcedAir: number; liquid: number;
  };

  // Ageing model
  ageingActivationEnergyKjPerMol: number;   // Arrhenius Ea (default 35 kJ/mol — empirical NMC/LFP)
  calendarRefTempC: number;                  // T_ref for calendar ageing (default 25°C)
  dodExponent: number;                       // DoD severity exponent (default 0.5 — half-cycle law)

  // Protection sizing factors
  ocpSafetyFactor: number;        // continuous trip margin above design max (default 1.2)
  fuseDerating: number;           // fuse must carry ≥ OCP × derating (default 1.25)
  contactorDerating: number;      // contactor continuous ≥ OCP × derating (default 1.25)
  contactorPulseDerating: number; // contactor pulse ≥ pulse current × derating (default 1.5)
  thermistorsPerCell: number;     // sensing density (default 1 per 4 cells)

  // Requirements tolerances
  voltageTolerancePct: number;    // ± % versus target V (default 2%)
  energyTolerancePct: number;     // ± % versus target Wh (default 5%)
}

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  structureAllowancePct: 0.25,
  packOverheadPct: 0.18,
  cellPricePerWh: {
    NMC: 0.20,
    NCA: 0.24,
    LFP: 0.14,
    LTO: 0.55,
    LCO: 0.32,
    LeadAcid: 0.09,
    NiMH: 0.33,
    NiCd: 0.42,
  },
  packAssemblyPerCell: 1.40,
  coolingOverhead: { none: 0, naturalAir: 0.5, forcedAir: 4, liquid: 28 },
  ageingActivationEnergyKjPerMol: 35,
  calendarRefTempC: 25,
  dodExponent: 0.5,
  ocpSafetyFactor: 1.2,
  fuseDerating: 1.25,
  contactorDerating: 1.25,
  contactorPulseDerating: 1.5,
  thermistorsPerCell: 0.25, // 1 per 4 cells
  voltageTolerancePct: 2,
  energyTolerancePct: 5,
};

// ------------------------------------------------------------
// Pack math — now takes the (editable) structure allowance so
// mass and energy density are no longer locked to 25%.
// ------------------------------------------------------------

export interface PackMath {
  packNominalV: number;
  packVmax: number;
  packVmin: number;
  packCapacityAh: number;
  packEnergyWh: number;
  gravimetricWhKg: number;
  r0Pack: number;
  r1Pack: number;
  r2Pack: number;
  cellCount: number;
  packMassKg: number;
  iCellAt1C: number;
  maxContPowerW: number;
  structureAllowancePct: number;
}

export function packMath(d: CellDesign, p: PackConfig, assumptions: Pick<Assumptions, "structureAllowancePct"> = { structureAllowancePct: 0.25 }): PackMath {
  const base = packMathBase(d, p);
  const sa = Math.max(0, assumptions.structureAllowancePct);
  const factor = 1 + sa;
  const packMassKg = +(d.massKg * (p.series * p.parallel) * factor).toFixed(2);
  const cellWh = (d.nominalV > 0 ? d.nominalV : (d.vmax + d.vmin) / 2 + 0.05) * d.capacityAh;
  const gravimetricWhKg = d.massKg > 0 ? +((cellWh) / (d.massKg * factor)).toFixed(0) : 0;
  return {
    ...base,
    packMassKg,
    gravimetricWhKg,
    structureAllowancePct: sa,
  };
}

// ------------------------------------------------------------
// Cost model — BOM-style estimate.
// ------------------------------------------------------------

export type CoolingTier = "none" | "naturalAir" | "forcedAir" | "liquid";

export interface CostBreakdown {
  cellCostUsd: number;
  assemblyCostUsd: number;
  coolingCostUsd: number;
  bmsCostUsd: number;
  totalUsd: number;
  perKwhUsd: number;
  perCellUsd: number;
  breakdownPct: { cells: number; assembly: number; cooling: number; bms: number };
}

export function costModel(
  d: CellDesign,
  p: PackConfig,
  cooling: CoolingTier,
  a: Pick<Assumptions, "cellPricePerWh" | "packAssemblyPerCell" | "coolingOverhead" | "packOverheadPct"> = DEFAULT_ASSUMPTIONS,
): CostBreakdown {
  const cellCount = p.series * p.parallel;
  const cellWh = (d.nominalV > 0 ? d.nominalV : (d.vmax + d.vmin) / 2 + 0.05) * d.capacityAh;
  const packWh = cellWh * cellCount;
  const pricePerWh = a.cellPricePerWh[d.chemistry] ?? 0.2;
  const cellCost = packWh * pricePerWh;
  const assemblyCost = cellCount * a.packAssemblyPerCell;
  const coolingCost = a.coolingOverhead[cooling] ?? 0;
  // BMS cost scales with series count (per-module BMS + master) and pack Wh
  const bmsCost = 12 * p.series + Math.max(20, packWh * 0.005) * (1 + a.packOverheadPct);
  const total = cellCost + assemblyCost + coolingCost + bmsCost;
  return {
    cellCostUsd: +cellCost.toFixed(2),
    assemblyCostUsd: +assemblyCost.toFixed(2),
    coolingCostUsd: +coolingCost.toFixed(2),
    bmsCostUsd: +bmsCost.toFixed(2),
    totalUsd: +total.toFixed(2),
    perKwhUsd: packWh > 0 ? +((total / packWh) * 1000).toFixed(2) : 0,
    perCellUsd: cellCount > 0 ? +(total / cellCount).toFixed(2) : 0,
    breakdownPct: {
      cells: +(cellCost / Math.max(1, total) * 100).toFixed(1),
      assembly: +(assemblyCost / Math.max(1, total) * 100).toFixed(1),
      cooling: +(coolingCost / Math.max(1, total) * 100).toFixed(1),
      bms: +(bmsCost / Math.max(1, total) * 100).toFixed(1),
    },
  };
}

// ------------------------------------------------------------
// Ageing model — cycle + calendar, semi-empirical.
//   • Cycle fade (per Wang/Schmalstieg): ΔQ/Q = k_cyc · sqrt(N) · DoD^α
//     k_cyc is back-calculated so the datasheet cycleLifeCycles
//     reaches 20% fade (EoL).
//   • Calendar fade (Arrhenius): ΔQ/Q = k_cal · sqrt(t_days) · exp(-Ea/R·(1/T − 1/T_ref))
//     k_cal anchored so 10 years at 25°C and 50% SOC ≈ 8% fade.
// ------------------------------------------------------------

export interface AgeingInput {
  cycles: number;                 // equivalent full cycles over the service life
  serviceYears: number;           // calendar ageing horizon
  avgSocPct: number;              // average state of charge (0..100) — high SOC accelerates calendar fade
  avgTempC: number;               // average operating/storage temperature
  dodPct: number;                 // depth-of-discharge per cycle (0..100)
}

export interface AgeingResult {
  cycleFadePct: number;
  calendarFadePct: number;
  totalFadePct: number;
  sohPct: number;                 // state of health (100 − totalFade)
  eolYears: number | null;        // years until 20% fade (EoL); null if never within 30y
  eolCycles: number | null;       // cycles until 20% fade
  assumptions: { ea: number; tRefC: number; dodExp: number; cycleLife: number };
}

export function ageingModel(d: CellDesign, input: AgeingInput, a: Pick<Assumptions, "ageingActivationEnergyKjPerMol" | "calendarRefTempC" | "dodExponent"> = DEFAULT_ASSUMPTIONS): AgeingResult {
  const cycleLife = d.cycleLifeCycles > 0 ? d.cycleLifeCycles : 1000;
  const dodExp = a.dodExponent;
  // k_cyc such that at N = cycleLife, full DoD → 20% fade:
  //   20 = k_cyc · sqrt(cycleLife) · 100^dodExp
  // → k_cyc = 20 / (sqrt(cycleLife) · 100^dodExp)
  const kCyc = 20 / (Math.sqrt(cycleLife) * Math.pow(100, dodExp));
  const dod = Math.min(100, Math.max(0, input.dodPct));
  const cycleFade = kCyc * Math.sqrt(Math.max(0, input.cycles)) * Math.pow(dod, dodExp);

  // Calendar: anchor at 10y @ 25°C, 50% SOC → 8% fade.
  //   8 = k_cal · sqrt(3650) · 1 · f_soc(50)
  //   f_soc(x) = 0.5 + (x/100)^2   (high-SOC penalty)
  const fSoc = (soc: number) => 0.5 + Math.pow(Math.max(0, soc) / 100, 2);
  const kCal = 8 / (Math.sqrt(3650) * fSoc(50));
  const R = 8.314; // J/mol·K
  const EaJ = a.ageingActivationEnergyKjPerMol * 1000;
  const T = (input.avgTempC + 273.15);
  const Tref = (a.calendarRefTempC + 273.15);
  const arrhenius = Math.exp(-EaJ / R * (1 / T - 1 / Tref));
  const tDays = Math.max(0, input.serviceYears) * 365;
  const calendarFade = kCal * Math.sqrt(tDays) * arrhenius * fSoc(input.avgSocPct);

  const totalFade = Math.min(100, cycleFade + calendarFade);

  // EOL: cycle to 20% fade
  //   20 = k_cyc · sqrt(N_eol) · DoD^dodExp  →  N_eol = (20 / (k_cyc · DoD^dodExp))^2
  let eolCycles: number | null = Math.pow(20 / (kCyc * Math.pow(dod, dodExp)), 2);
  if (!Number.isFinite(eolCycles) || eolCycles > 1e6) eolCycles = null;

  // EOL years: solve calendar to 20% fade (assuming no cycling). Use bisection.
  let eolYears: number | null = null;
  if (arrhenius > 0 && fSoc(input.avgSocPct) > 0) {
    let lo = 0, hi = 30 * 365;
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2;
      const fade = kCal * Math.sqrt(mid) * arrhenius * fSoc(input.avgSocPct);
      if (fade >= 20) hi = mid;
      else lo = mid;
    }
    if (hi < 30 * 365) eolYears = +(hi / 365).toFixed(2);
  }

  return {
    cycleFadePct: +cycleFade.toFixed(2),
    calendarFadePct: +calendarFade.toFixed(2),
    totalFadePct: +totalFade.toFixed(2),
    sohPct: +(100 - totalFade).toFixed(2),
    eolYears,
    eolCycles: eolCycles !== null ? +eolCycles.toFixed(0) : null,
    assumptions: { ea: a.ageingActivationEnergyKjPerMol, tRefC: a.calendarRefTempC, dodExp: a.dodExponent, cycleLife },
  };
}

// ------------------------------------------------------------
// Protection & sensing sizing — derived from pack + design.
// ------------------------------------------------------------

export type ProtStatus = "ok" | "warn" | "fail";

export interface ProtectionThreshold {
  label: string;
  threshold: string;
  rationale: string;
}

export interface ProtectionCheck {
  label: string;
  status: ProtStatus;
  detail: string;
  threshold?: ProtectionThreshold;
}

export interface ProtectionPlan {
  packVmax: number;            // OVP set-point (V)
  packVmin: number;            // UVP set-point (V)
  ocpContinuousA: number;      // continuous over-current trip (A) — design max × safety
  ocpPulseA: number;           // pulse trip (A)
  otpC: number;                // over-temperature set-point (°C)
  fuseRatingA: number;         // fuse sizing (A)
  contactorContinuousA: number;// contactor continuous rating (A)
  contactorPulseA: number;     // contactor pulse rating (A)
  thermistorCount: number;     // sensing layout — # thermistors
  bmsVoltageRange: { min: number; max: number }; // BMS nominal operating range
  cellBalanceCurrentA: number; // passive balancing current (assume C/30)
  checks: ProtectionCheck[];
}

export function protectionPlan(
  d: CellDesign,
  p: PackConfig,
  a: Pick<Assumptions, "ocpSafetyFactor" | "fuseDerating" | "contactorDerating" | "contactorPulseDerating" | "thermistorsPerCell"> = DEFAULT_ASSUMPTIONS,
): ProtectionPlan {
  const cellCount = p.series * p.parallel;
  const packVmax = +(d.vmax * p.series * 1.02).toFixed(2);    // 2% head-room above charge cut-off
  const packVmin = +(d.vmin * p.series * 0.98).toFixed(2);    // 2% margin below discharge cut-off
  const i1c = d.capacityAh * p.parallel;
  const maxContCellA = d.maxDischargeC > 0 ? d.maxDischargeC * d.capacityAh : d.capacityAh;
  const ocpContinuous = +(maxContCellA * p.parallel * a.ocpSafetyFactor).toFixed(1);
  const pulseCellA = d.maxPulseDischargeC > 0 ? d.maxPulseDischargeC * d.capacityAh : maxContCellA * 1.5;
  const ocpPulse = +(pulseCellA * p.parallel).toFixed(1);
  const otpC = d.dischargeTempMaxC > 0 ? d.dischargeTempMaxC : 60;
  const fuseRating = +(ocpContinuous * a.fuseDerating).toFixed(1);
  const contactorCont = +(ocpContinuous * a.contactorDerating).toFixed(1);
  const contactorPulse = +(ocpPulse * a.contactorPulseDerating).toFixed(1);
  const thermistors = Math.max(p.series, Math.ceil(cellCount * a.thermistorsPerCell));
  const bmsRange = { min: +(d.vmin * p.series * 0.9).toFixed(1), max: +(d.vmax * p.series * 1.1).toFixed(1) };
  const balanceCurrent = +(d.capacityAh / 30).toFixed(3);

  const checks: ProtectionCheck[] = [
    {
      label: "OVP / UVP set-points defined",
      status: "ok",
      detail: `OVP ${packVmax} V · UVP ${packVmin} V`,
      threshold: { label: "Over-voltage protection", threshold: `${packVmax} V pack`, rationale: `Cell Vmax × S × 1.02 head-room` },
    },
    {
      label: "Continuous OCP sized",
      status: ocpContinuous > 0 ? "ok" : "fail",
      detail: `Trip at ${ocpContinuous} A pack (${maxContCellA.toFixed(1)} A/cell × ${p.parallel}P × ${a.ocpSafetyFactor})`,
      threshold: { label: "Over-current (continuous)", threshold: `${ocpContinuous} A`, rationale: `Max discharge C × capacity × P × safety factor` },
    },
    {
      label: "Pulse OCP sized",
      status: ocpPulse > 0 ? "ok" : "warn",
      detail: `Trip at ${ocpPulse} A pack (pulse ${pulseCellA.toFixed(1)} A/cell × ${p.parallel}P)`,
      threshold: { label: "Over-current (pulse, ≤10 s)", threshold: `${ocpPulse} A`, rationale: `Pulse C × capacity × P` },
    },
    {
      label: "OTP set-point",
      status: otpC <= 60 ? "ok" : "warn",
      detail: `Trip at ${otpC}°C — ${d.dischargeTempMaxC > 0 ? "datasheet" : "default"} discharge limit`,
      threshold: { label: "Over-temperature", threshold: `${otpC}°C`, rationale: `Datasheet discharge temp max (or 60°C default)` },
    },
    {
      label: "Fuse sizing",
      status: fuseRating > 0 ? "ok" : "fail",
      detail: `≥ ${fuseRating} A (OCP ${ocpContinuous} A × ${a.fuseDerating} derating)`,
      threshold: { label: "Main pack fuse", threshold: `${fuseRating} A`, rationale: `Must carry OCP × 1.25; interrupt rating ≥ pack short-circuit current` },
    },
    {
      label: "Contactor sizing",
      status: contactorCont > 0 ? "ok" : "fail",
      detail: `Cont. ≥ ${contactorCont} A · pulse ≥ ${contactorPulse} A`,
      threshold: { label: "Pack contactor", threshold: `${contactorCont} A cont / ${contactorPulse} A pulse`, rationale: `Continuous derating × 1.25, pulse × 1.5` },
    },
    {
      label: "Sensing layout — thermistors",
      status: thermistors >= p.series ? "ok" : "warn",
      detail: `${thermistors} thermistors (1 per ${Math.round(1 / a.thermistorsPerCell)} cells, min 1 per series group)`,
      threshold: { label: "Temperature sensing", threshold: `${thermistors}× NTC`, rationale: `1 per series group minimum; 1 per 4 cells typical` },
    },
    {
      label: "Cell balancing",
      status: d.capacityAh > 0 ? "ok" : "warn",
      detail: `Passive balancing @ ${balanceCurrent} A (C/30)`,
      threshold: { label: "Balancing current", threshold: `${balanceCurrent} A`, rationale: `Passive bleed at C/30 — sufficient for ≤2% cell mismatch over a full charge` },
    },
  ];

  return {
    packVmax, packVmin, ocpContinuousA: ocpContinuous, ocpPulseA: ocpPulse, otpC,
    fuseRatingA: fuseRating, contactorContinuousA: contactorCont, contactorPulseA: contactorPulse,
    thermistorCount: thermistors, bmsVoltageRange: bmsRange, cellBalanceCurrentA: balanceCurrent,
    checks,
  };
}

// ------------------------------------------------------------
// Interface-conflict checks — catch incompatibilities between
// pack, protection, and BMS specs.
// ------------------------------------------------------------

export interface InterfaceConflict {
  label: string;
  status: ProtStatus;
  detail: string;
}

export function interfaceConflicts(
  d: CellDesign,
  p: PackConfig,
  plan: ProtectionPlan,
  bmsSpec?: { vMin?: number; vMax?: number; iMaxContA?: number; iMaxPulseA?: number },
): InterfaceConflict[] {
  const out: InterfaceConflict[] = [];
  const packVnom = (d.nominalV > 0 ? d.nominalV : (d.vmax + d.vmin) / 2 + 0.05) * p.series;

  // 1. BMS voltage range vs pack voltage range
  if (bmsSpec?.vMin !== undefined && bmsSpec.vMax !== undefined) {
    const okMin = bmsSpec.vMin <= plan.packVmin;
    const okMax = bmsSpec.vMax >= plan.packVmax;
    if (!okMin || !okMax) {
      out.push({
        label: "BMS voltage range vs pack",
        status: "fail",
        detail: `BMS ${bmsSpec.vMin}–${bmsSpec.vMax} V does not cover pack UVP ${plan.packVmin} V / OVP ${plan.packVmax} V — the BMS will blind-out before the cell limits are reached.`,
      });
    } else {
      out.push({ label: "BMS voltage range vs pack", status: "ok", detail: `BMS ${bmsSpec.vMin}–${bmsSpec.vMax} V covers pack ${plan.packVmin}–${plan.packVmax} V` });
    }
  } else {
    out.push({
      label: "BMS voltage range vs pack",
      status: "warn",
      detail: `No BMS voltage rating entered — assumed ${plan.bmsVoltageRange.min}–${plan.bmsVoltageRange.max} V (±10% of cell window × S). Enter the actual BMS datasheet values to verify.`,
    });
  }

  // 2. BMS continuous current vs pack OCP
  if (bmsSpec?.iMaxContA !== undefined) {
    if (bmsSpec.iMaxContA < plan.ocpContinuousA) {
      out.push({
        label: "BMS current vs pack OCP",
        status: "fail",
        detail: `BMS continuous rating ${bmsSpec.iMaxContA} A < pack OCP ${plan.ocpContinuousA} A — the BMS will trip before the fuse; verify the BMS can sustain pack peak current.`,
      });
    } else {
      out.push({ label: "BMS current vs pack OCP", status: "ok", detail: `BMS cont. ${bmsSpec.iMaxContA} A ≥ pack OCP ${plan.ocpContinuousA} A` });
    }
  }

  // 3. Contactor pulse vs pack pulse current
  if (plan.contactorPulseA < plan.ocpPulseA) {
    out.push({
      label: "Contactor pulse vs pack pulse",
      status: "fail",
      detail: `Contactor pulse rating ${plan.contactorPulseA} A < pack pulse trip ${plan.ocpPulseA} A — contactor may weld under pulse loads.`,
    });
  } else {
    out.push({ label: "Contactor pulse vs pack pulse", status: "ok", detail: `Contactor pulse ${plan.contactorPulseA} A ≥ pack pulse ${plan.ocpPulseA} A` });
  }

  // 4. Fuse interrupt vs short-circuit current
  const iscCellApprox = d.vmax / Math.max(1e-6, d.r0); // crude single-cell short current
  const iscPack = (iscCellApprox * p.parallel).toFixed(0);
  out.push({
    label: "Fuse interrupt rating",
    status: "warn",
    detail: `Estimated pack short-circuit ≈ ${iscPack} A — verify the selected fuse has an interrupt rating ≥ this value (typical automotive fuse AIC ≥ 1000 A).`,
  });

  // 5. Cooling capacity vs heat generated (uses pack power and an estimated ΔT)
  if (d.maxDischargeC > 0) {
    const iMaxCell = d.maxDischargeC * d.capacityAh;
    const qPerCell = iMaxCell * iMaxCell * d.r0;
    const qTotal = qPerCell * p.series * p.parallel;
    if (qTotal > 500) {
      out.push({
        label: "Cooling capacity vs heat",
        status: "warn",
        detail: `Estimated ${qTotal.toFixed(0)} W worst-case Joule heat at ${d.maxDischargeC}C — verify the cooling system can dissipate this continuously.`,
      });
    } else {
      out.push({ label: "Cooling capacity vs heat", status: "ok", detail: `≈ ${qTotal.toFixed(0)} W worst-case Joule heat — within typical fan/liquid cooling range` });
    }
  }

  return out;
}

// ------------------------------------------------------------
// Requirements — pass / fail with stated tolerance.
// ------------------------------------------------------------

export interface Requirements {
  application: string;
  targetPackV: number;
  targetPackWh: number;
  maxTempC: number;
  chargeTimeMin: number;
  maxCostUsd: number;
  minCycleLife: number;
  serviceYears: number;
}

export const DEFAULT_REQUIREMENTS: Requirements = {
  application: "",
  targetPackV: 0,
  targetPackWh: 0,
  maxTempC: 60,
  chargeTimeMin: 0,
  maxCostUsd: 0,
  minCycleLife: 0,
  serviceYears: 10,
};

export interface RequirementResult {
  key: keyof Omit<Requirements, "application">;
  label: string;
  target: string;
  actual: string;
  status: ProtStatus;
  detail: string;
}

export function checkRequirements(
  req: Requirements,
  ctx: {
    d: CellDesign;
    p: PackConfig;
    pm: PackMath;
    cost: CostBreakdown;
    ageing: AgeingResult;
    lastSummary?: RunSummary | null;
    simParams?: SimParams | null;
    a: Pick<Assumptions, "voltageTolerancePct" | "energyTolerancePct">;
  },
): RequirementResult[] {
  const { d, p, pm, cost, ageing, lastSummary, simParams, a } = ctx;
  const out: RequirementResult[] = [];

  // Pack voltage target (± tol %)
  if (req.targetPackV > 0) {
    const tol = req.targetPackV * a.voltageTolerancePct / 100;
    const diff = Math.abs(pm.packNominalV - req.targetPackV);
    out.push({
      key: "targetPackV",
      label: "Pack nominal voltage",
      target: `${req.targetPackV} V (±${a.voltageTolerancePct}%)`,
      actual: `${pm.packNominalV} V`,
      status: diff <= tol ? "ok" : diff <= tol * 2 ? "warn" : "fail",
      detail: diff <= tol
        ? `Within tolerance of ${req.targetPackV} V target`
        : `Off by ${diff.toFixed(1)} V — adjust S count (${p.series}S × ${d.nominalV || "?"} V nominal)`,
    });
  }

  // Pack energy target (± tol %)
  if (req.targetPackWh > 0) {
    const tol = req.targetPackWh * a.energyTolerancePct / 100;
    const diff = Math.abs(pm.packEnergyWh - req.targetPackWh);
    out.push({
      key: "targetPackWh",
      label: "Pack usable energy",
      target: `${req.targetPackWh} Wh (±${a.energyTolerancePct}%)`,
      actual: `${pm.packEnergyWh} Wh`,
      status: diff <= tol ? "ok" : diff <= tol * 2 ? "warn" : "fail",
      detail: diff <= tol
        ? `Within tolerance of ${req.targetPackWh} Wh target`
        : `Off by ${diff.toFixed(0)} Wh — adjust P count or cell capacity`,
    });
  }

  // Max temperature — needs a run
  if (lastSummary && simParams) {
    const peakT = lastSummary.tempMaxC;
    out.push({
      key: "maxTempC",
      label: "Peak temperature ≤ requirement",
      target: `≤ ${req.maxTempC}°C`,
      actual: `${peakT.toFixed(1)}°C`,
      status: peakT <= req.maxTempC ? "ok" : peakT <= req.maxTempC + 5 ? "warn" : "fail",
      detail: peakT <= req.maxTempC
        ? `Peak ${peakT.toFixed(1)}°C under ${simParams.profile} @ ${simParams.cRate}C`
        : `Peak ${peakT.toFixed(1)}°C exceeds ${req.maxTempC}°C limit — add cooling or reduce C-rate`,
    });
  } else {
    out.push({
      key: "maxTempC",
      label: "Peak temperature ≤ requirement",
      target: `≤ ${req.maxTempC}°C`,
      actual: "—",
      status: "warn",
      detail: "Run a simulation or thermal test to verify",
    });
  }

  // Charge time — only meaningful for a CC-CV run
  if (req.chargeTimeMin > 0) {
    if (lastSummary && simParams?.profile === "cccv") {
      const mins = lastSummary.durationS / 60;
      out.push({
        key: "chargeTimeMin",
        label: "Charge time ≤ requirement",
        target: `≤ ${req.chargeTimeMin} min`,
        actual: `${mins.toFixed(0)} min`,
        status: mins <= req.chargeTimeMin ? "ok" : mins <= req.chargeTimeMin * 1.1 ? "warn" : "fail",
        detail: mins <= req.chargeTimeMin
          ? `CC-CV completed in ${mins.toFixed(0)} min`
          : `${mins.toFixed(0)} min exceeds ${req.chargeTimeMin} min — raise CC-rate or accept lower cell life`,
      });
    } else {
      out.push({
        key: "chargeTimeMin",
        label: "Charge time ≤ requirement",
        target: `≤ ${req.chargeTimeMin} min`,
        actual: "—",
        status: "warn",
        detail: "Run a CC-CV charge simulation to verify",
      });
    }
  }

  // Cost ≤ max
  if (req.maxCostUsd > 0) {
    out.push({
      key: "maxCostUsd",
      label: "Pack cost ≤ budget",
      target: `≤ $${req.maxCostUsd}`,
      actual: `$${cost.totalUsd.toFixed(0)}`,
      status: cost.totalUsd <= req.maxCostUsd ? "ok" : cost.totalUsd <= req.maxCostUsd * 1.1 ? "warn" : "fail",
      detail: cost.totalUsd <= req.maxCostUsd
        ? `$${cost.totalUsd.toFixed(0)} total ($${cost.perKwhUsd}/kWh)`
        : `$${cost.totalUsd.toFixed(0)} over $${req.maxCostUsd} budget`,
    });
  }

  // Cycle life ≥ min (using the ageing model's EOL)
  if (req.minCycleLife > 0) {
    const eol = ageing.eolCycles;
    out.push({
      key: "minCycleLife",
      label: "Cycle life to EoL ≥ requirement",
      target: `≥ ${req.minCycleLife} cycles (80% SoH)`,
      actual: eol !== null ? `${eol} cycles` : "—",
      status: eol === null ? "warn" : eol >= req.minCycleLife ? "ok" : eol >= req.minCycleLife * 0.9 ? "warn" : "fail",
      detail: eol === null
        ? "EoL not reached within model horizon"
        : eol >= req.minCycleLife
          ? `${eol} cycles at ${ageing.assumptions.dodExp === 0.5 ? "√DoD" : ""} law before 20% fade`
          : `${eol} cycles below ${req.minCycleLife} target — reduce DoD or pick a higher-cycle chemistry`,
    });
  }

  return out;
}

// ------------------------------------------------------------
// Recommendation — weighted scoring across the alternatives.
// Mirrors the brief's scoring rubric (desirability / feasibility /
// engineering quality / cost / innovation / business viability).
// ------------------------------------------------------------

export interface AltInput {
  id: string;
  name: string;
  d: CellDesign;
  p: PackConfig;
  cooling: CoolingTier;
  // optional cached run summary (last test against this alt)
  summary?: RunSummary | null;
}

export interface ScoredAlt {
  id: string;
  name: string;
  metrics: {
    packWh: number;
    packMassKg: number;
    peakTempC: number | null;
    chargeTimeMin: number | null;
    costUsd: number;
    costPerKwh: number;
    eolCycles: number | null;
    sohAtServiceYears: number;
  };
  score: number;                 // weighted 0..100
  scoreBreakdown: { label: string; weight: number; raw: number; weighted: number }[];
  recommendation: string;
  risks: string[];
  assumptions: string[];
}

export interface RecommendationWeights {
  desirability: number;
  feasibility: number;
  engineering: number;
  cost: number;
  innovation: number;
  business: number;
}

export const DEFAULT_WEIGHTS: RecommendationWeights = {
  desirability: 15,
  feasibility: 20,
  engineering: 15,
  cost: 20,
  innovation: 10,
  business: 20,
};

export function scoreAlternatives(
  alts: AltInput[],
  req: Requirements,
  weights: RecommendationWeights = DEFAULT_WEIGHTS,
  a: Assumptions = DEFAULT_ASSUMPTIONS,
): ScoredAlt[] {
  const wSum = Object.values(weights).reduce((s, v) => s + v, 0) || 1;

  return alts.map((alt) => {
    const pm = packMath(alt.d, alt.p, a);
    const cost = costModel(alt.d, alt.p, alt.cooling, a);
    const ageing = ageingModel(alt.d, {
      cycles: req.serviceYears * 250, // ~1 cycle/day
      serviceYears: req.serviceYears,
      avgSocPct: 50,
      avgTempC: 30,
      dodPct: 80,
    }, a);

    const peakTempC = alt.summary ? alt.summary.tempMaxC : null;
    const chargeTimeMin = alt.summary && alt.summary.durationS > 0 ? alt.summary.durationS / 60 : null;

    const m: ScoredAlt["metrics"] = {
      packWh: pm.packEnergyWh,
      packMassKg: pm.packMassKg,
      peakTempC,
      chargeTimeMin,
      costUsd: cost.totalUsd,
      costPerKwh: cost.perKwhUsd,
      eolCycles: ageing.eolCycles,
      sohAtServiceYears: ageing.sohPct,
    };

    // Sub-scores 0..100 — higher is better.
    const desirRaw = clamp100((m.packWh / Math.max(1, req.targetPackWh || m.packWh)) * 100);
    const feasibilityRaw = peakTempC === null ? 60
      : clamp100(100 - Math.max(0, peakTempC - req.maxTempC) * 4);
    const engineeringRaw = clamp100(
      (m.eolCycles !== null && req.minCycleLife > 0
        ? Math.min(1, m.eolCycles / req.minCycleLife) * 50
        : 40) +
      (peakTempC !== null && peakTempC <= req.maxTempC ? 30 : 0) +
      (m.sohAtServiceYears >= 80 ? 20 : m.sohAtServiceYears / 5)
    );
    const costRaw = req.maxCostUsd > 0
      ? clamp100(100 - Math.max(0, (m.costUsd - req.maxCostUsd) / req.maxCostUsd * 100))
      : clamp100(100 - Math.max(0, m.costPerKwh - 150) * 1.5);
    const innovationRaw = alt.cooling === "liquid" ? 75 : alt.cooling === "forcedAir" ? 70 : 65;
    const businessRaw = clamp100(100 - Math.max(0, m.costPerKwh - 150) * 1.2);

    const breakdown = [
      { label: "Desirability", weight: weights.desirability, raw: desirRaw, weighted: +(desirRaw * weights.desirability / wSum).toFixed(1) },
      { label: "Feasibility", weight: weights.feasibility, raw: feasibilityRaw, weighted: +(feasibilityRaw * weights.feasibility / wSum).toFixed(1) },
      { label: "Engineering quality", weight: weights.engineering, raw: engineeringRaw, weighted: +(engineeringRaw * weights.engineering / wSum).toFixed(1) },
      { label: "Cost", weight: weights.cost, raw: costRaw, weighted: +(costRaw * weights.cost / wSum).toFixed(1) },
      { label: "Innovation", weight: weights.innovation, raw: innovationRaw, weighted: +(innovationRaw * weights.innovation / wSum).toFixed(1) },
      { label: "Business viability", weight: weights.business, raw: businessRaw, weighted: +(businessRaw * weights.business / wSum).toFixed(1) },
    ];
    const score = +breakdown.reduce((s, b) => s + b.weighted, 0).toFixed(1);

    // Risks — state the ones attached to this option.
    const risks: string[] = [];
    if (peakTempC !== null && peakTempC > req.maxTempC) risks.push(`Peak temperature ${peakTempC.toFixed(1)}°C exceeds the ${req.maxTempC}°C limit — needs stronger cooling or derating.`);
    if (m.eolCycles !== null && req.minCycleLife > 0 && m.eolCycles < req.minCycleLife) risks.push(`Cycle life ${m.eolCycles} below the ${req.minCycleLife} target — reduce DoD or pick a higher-cycle chemistry.`);
    if (req.maxCostUsd > 0 && m.costUsd > req.maxCostUsd) risks.push(`Pack cost $${m.costUsd.toFixed(0)} exceeds the $${req.maxCostUsd} budget — look at LFP or fewer parallel strings.`);
    if (alt.cooling === "none" && peakTempC !== null && peakTempC > 45) risks.push("Adiabatic test exceeded 45°C — production pack will need at least natural-air cooling.");
    if (m.sohAtServiceYears < 80) risks.push(`SoH drops to ${m.sohAtServiceYears}% after ${req.serviceYears} years — calendar ageing dominates; lower average SOC and storage temperature.`);
    if (alt.d.r0 * 1000 > 30) risks.push(`Cell R₀ ${(alt.d.r0 * 1000).toFixed(1)} mΩ is high — heat and sag at high C-rates will be significant.`);

    // Assumptions — make the model's hidden inputs explicit.
    const assumptions = [
      `Cell price $${a.cellPricePerWh[alt.d.chemistry]}/Wh (chemistry ${alt.d.chemistry}) + $${a.packAssemblyPerCell}/cell assembly + cooling overhead $${a.coolingOverhead[alt.cooling]}.`,
      `Structure allowance ${(a.structureAllowancePct * 100).toFixed(0)}% of cell mass added to pack mass (editable in Assumptions).`,
      `Ageing: Arrhenius Ea = ${a.ageingActivationEnergyKjPerMol} kJ/mol, ref T = ${a.calendarRefTempC}°C, DoD exponent ${a.dodExponent}. Cycle life anchored to datasheet ${alt.d.cycleLifeCycles || 1000} cycles.`,
      `Protection sizing: OCP × ${a.ocpSafetyFactor}, fuse × ${a.fuseDerating}, contactor cont. × ${a.contactorDerating}, pulse × ${a.contactorPulseDerating}.`,
    ];

    const rec = score >= 75
      ? "Recommended — balanced trade-off across cost, performance and life."
      : score >= 60
        ? "Acceptable — meets most requirements with manageable risks."
        : "Not recommended — significant risks or cost overruns.";

    return { id: alt.id, name: alt.name, metrics: m, score, scoreBreakdown: breakdown, recommendation: rec, risks, assumptions };
  }).sort((x, y) => y.score - x.score);
}

function clamp100(v: number): number {
  return Math.max(0, Math.min(100, +v.toFixed(1)));
}

// ------------------------------------------------------------
// BMS spec — a small set of values entered alongside the pack so
// the interface-conflict checks can verify compatibility.
// ------------------------------------------------------------

export interface BmsSpec {
  vMin?: number;
  vMax?: number;
  iMaxContA?: number;
  iMaxPulseA?: number;
}

export const DEFAULT_BMS_SPEC: BmsSpec = { vMin: undefined, vMax: undefined, iMaxContA: undefined, iMaxPulseA: undefined };
