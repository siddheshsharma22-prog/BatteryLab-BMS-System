/**
 * Pack-level engineering model.
 *
 * Physical approach (documented simplifications — see Traceability tab):
 *  - Algebraic sizing: voltage/capacity/energy/mass/volume/cost stack linearly.
 *  - Charging: piecewise-linear OCV(SOC) + series-R terminal voltage, CC-CV
 *    profile integrated with explicit Euler (dt = 2 s).
 *  - Thermal: single lumped node per cell, m·cp·dT/dt = I²R − UA·(T − T_amb).
 *    The hottest cell is the mean trajectory scaled by the cooling option's
 *    non-uniformity (spread) factor.
 */

import { CellSpec, CoolingSpec, getCell, getCooling } from "./data";

export interface PackInputs {
  cellId: string;
  series: number;
  parallel: number;
  coolingId: string;
  ambientC: number;
  dod: number;
  chargeCrate: number; // per-cell C-rate
  continuousLoadW: number;
  peakLoadW: number;
  targetUsableWh: number;
}

export interface SimPoint {
  t: number; // minutes
  soc: number; // %
  temp: number; // hottest cell °C
  current: number; // per-cell A
  vTerm: number; // per-cell terminal V
}

export interface ChargeSim {
  points: SimPoint[];
  totalTimeMin: number;
  ccTimeMin: number;
  timeTo80Min: number;
  peakTempC: number;
  finalSoc: number;
  ccHeatW: number; // mean per-cell heat during CC phase
}

export type CheckStatus = "pass" | "warn" | "fail";

export interface SafetyCheck {
  id: string;
  label: string;
  status: CheckStatus;
  value: string;
  limit: string;
  detail: string;
}

export interface DesignResult {
  cell: CellSpec;
  cooling: CoolingSpec;
  inputs: PackInputs;
  cellsTotal: number;
  packVnom: number;
  packVmax: number;
  packVmin: number;
  packAh: number;
  packWh: number;
  usableWh: number;
  cellMassKg: number;
  overheadMassKg: number;
  packMassKg: number;
  packVolumeL: number;
  costCells: number;
  costBms: number;
  costEnclosure: number;
  costCooling: number;
  costTotal: number;
  whPerKg: number;
  whPerL: number;
  costPerUsableKwh: number;
  costPerLifetimeKwh: number;
  contCurrentPackA: number;
  contCurrentCellA: number;
  contCrate: number;
  peakCurrentCellA: number;
  peakCrate: number;
  heatWPerCellCont: number;
  steadyStateDischargeTempC: number;
  charge: ChargeSim;
  tempSpreadC: number;
  cellTemps: number[]; // per series position (hottest parallel slot)
  checks: SafetyCheck[];
  failCount: number;
  warnCount: number;
  scores: Scores;
  totalScore: number;
}

export interface Scores {
  energy: number;
  charge: number;
  thermal: number;
  cost: number;
  mass: number;
  lifetime: number;
  safety: number;
}

export const SCORE_CRITERIA: { key: keyof Scores; label: string; weight: number }[] = [
  { key: "energy", label: "Usable energy", weight: 0.24 },
  { key: "safety", label: "Safety", weight: 0.2 },
  { key: "cost", label: "Cost efficiency", weight: 0.18 },
  { key: "charge", label: "Charge speed", weight: 0.14 },
  { key: "thermal", label: "Thermal margin", weight: 0.1 },
  { key: "mass", label: "Mass efficiency", weight: 0.08 },
  { key: "lifetime", label: "Cycle life", weight: 0.06 },
];

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

function ocvAt(cell: CellSpec, socPct: number): number {
  const c = cell.ocvCurve;
  if (socPct <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) {
    if (socPct <= c[i][0]) {
      const [s0, v0] = c[i - 1];
      const [s1, v1] = c[i];
      return v0 + ((socPct - s0) / (s1 - s0)) * (v1 - v0);
    }
  }
  return c[c.length - 1][1];
}

export function cellSurfaceAreaM2(cell: CellSpec): number {
  const d = cell.diameterMm / 1000;
  const h = cell.heightMm / 1000;
  return Math.PI * d * h + 2 * Math.PI * ((d / 2) ** 2);
}

export function cellVolumeL(cell: CellSpec): number {
  const d = cell.diameterMm / 1000;
  const h = cell.heightMm / 1000;
  return Math.PI * ((d / 2) ** 2) * h * 1000;
}

/** per-cell thermal conductance to ambient, W/K */
export function cellUA(cell: CellSpec, cooling: CoolingSpec): number {
  const area = cellSurfaceAreaM2(cell);
  return cooling.hEff * area * cooling.contactFraction;
}

/** Run the CC-CV charging + thermal simulation for the hottest cell. */
export function simulateCharge(inputs: PackInputs, cell: CellSpec, cooling: CoolingSpec): ChargeSim {
  const dt = 2; // s
  const maxT = 4.5 * 3600; // hard cap 4.5 h
  const rOhm = (cell.internalResistanceMohm / 1000) * 1.25; // DC IR ≈ 1.25× AC IR (documented)
  const ua = cellUA(cell, cooling);
  const heatScale = 1 + cooling.spreadFactor; // hottest-cell factor
  const thermalMass = (cell.weightG / 1000) * cell.specificHeatJPerKgK; // J/K

  const iCC = inputs.chargeCrate * cell.capacityAh; // per-cell A during CC
  let soc = 0; // %
  let temp = inputs.ambientC;
  let phase: "cc" | "cv" = "cc";
  let ccHeatAccum = 0;
  let ccT = 0;
  let tTo80 = 0;
  let t = 0;
  let peakTemp = temp;
  const points: SimPoint[] = [];

  const push = () => {
    const step = Math.max(1, Math.round(points.length > 0 ? t / 60 / 90 : 0));
    if (points.length === 0 || t / 60 - points[points.length - 1].t >= step) {
      const ocv = ocvAt(cell, soc);
      const cur = phase === "cc" ? iCC : Math.max(0, (cell.chargeVoltageMax - ocv) / rOhm);
      points.push({
        t: t / 60,
        soc,
        temp,
        current: cur,
        vTerm: Math.min(cell.chargeVoltageMax, ocv + cur * rOhm),
      });
    }
  };

  while (t < maxT && soc < 99.9) {
    const ocv = ocvAt(cell, soc);
    let cur: number;
    if (phase === "cc") {
      cur = iCC;
      if (ocv + cur * rOhm >= cell.chargeVoltageMax) phase = "cv";
    } else {
      cur = Math.max(0, (cell.chargeVoltageMax - ocv) / rOhm);
    }
    const heat = cur * cur * rOhm * heatScale;
    const dT = (heat - ua * (temp - inputs.ambientC)) / thermalMass;
    temp += dT * dt;
    peakTemp = Math.max(peakTemp, temp);
    soc = Math.min(100, soc + (cur * dt) / (3600 * cell.capacityAh) * 100);
    if (phase === "cc") {
      ccHeatAccum += heat;
      ccT += dt;
    }
    if (tTo80 === 0 && soc >= 80) tTo80 = t;
    t += dt;
    push();
  }
  if (tTo80 === 0) tTo80 = t;

  return {
    points,
    totalTimeMin: t / 60,
    ccTimeMin: ccT / 60,
    timeTo80Min: tTo80 / 60,
    peakTempC: peakTemp,
    finalSoc: soc,
    ccHeatW: ccT > 0 ? ccHeatAccum / ccT : 0,
  };
}

/** Estimated temperature of every series position (hottest parallel slot), °C */
function estimateCellTemps(
  meanRiseC: number,
  series: number,
  cooling: CoolingSpec,
  ambientC: number,
): number[] {
  const spread = cooling.spreadFactor;
  const edge = 1 - spread;
  const temps: number[] = [];
  for (let i = 1; i <= series; i++) {
    const p = (i - 0.5) / series; // 0 = coolant/air inlet end, 1 = outlet end
    const factor = edge + (1 - edge) * p;
    // tiny deterministic parallel-layer variation (pairing asymmetry)
    const jitter = 0.15 * Math.sin(i * 2.399963); // golden-angle sequence
    temps.push(ambientC + meanRiseC * factor + jitter * Math.max(0.2, meanRiseC * 0.05));
  }
  return temps;
}

const mapLinear = (x: number, x0: number, s0: number, x1: number, s1: number) =>
  clamp(s0 + ((x - x0) / (x1 - x0)) * (s1 - s0), Math.min(s0, s1), Math.max(s0, s1));

function computeScores(
  inputs: PackInputs,
  r: Omit<DesignResult, "scores" | "totalScore" | "checks" | "failCount" | "warnCount">,
): Scores {
  const energy = clamp(mapLinear(r.usableWh / Math.max(1, inputs.targetUsableWh), 0.4, 15, 1.3, 100), 0, 100);
  const charge = mapLinear(r.charge.timeTo80Min, 15, 100, 300, 15);
  const limitC = r.cell.tempChargeMaxC;
  const margin = limitC - Math.max(r.charge.peakTempC, r.steadyStateDischargeTempC);
  const thermal = clamp(mapLinear(margin, -5, 0, 30, 100), 0, 100);
  const cost = clamp(
    100 * ((Math.log(400) - Math.log(Math.max(30, r.costPerLifetimeKwh))) / (Math.log(400) - Math.log(50))),
    0,
    100,
  );
  const mass = mapLinear(r.whPerKg, 60, 20, 240, 100);
  const lifetime = clamp(r.cell.cycleLife * 0.1, 0, 100);
  const chemBase = r.cell.chemistry === "LFP" ? 95 : 72;
  const safety = clamp(chemBase - r.failCount * 22 - r.warnCount * 6 + (margin > 25 ? 5 : 0), 0, 100);
  return { energy, charge, thermal, cost, mass, lifetime, safety };
}

export function evaluateDesign(inputs: PackInputs): DesignResult {
  const cell = getCell(inputs.cellId);
  const cooling = getCooling(inputs.coolingId);
  const S = Math.max(1, Math.round(inputs.series));
  const P = Math.max(1, Math.round(inputs.parallel));
  const cellsTotal = S * P;

  // ---------- electrical ----------
  const packVnom = S * cell.nominalVoltage;
  const packVmax = S * cell.chargeVoltageMax;
  const packVmin = S * cell.voltageCutoff;
  const packAh = P * cell.capacityAh;
  const packWh = packVnom * packAh;
  const usableWh = packWh * inputs.dod;

  // ---------- mass / volume / cost ----------
  const cellMassKg = (cellsTotal * cell.weightG) / 1000;
  const overheadMassKg =
    cellMassKg * 0.15 + // structure, busbars, BMS wiring
    0.2 + // connectors, hardware, enclosure hardware
    cooling.addedFixedMassKg +
    cellsTotal * cooling.addedMassPerCellKg;
  const packMassKg = cellMassKg + overheadMassKg;
  const packVolumeL = (cellVolumeL(cell) * cellsTotal) / 0.55 + cooling.addedVolumeL;

  const costCells = cellsTotal * cell.priceUsd;
  const costBms = 18 + 1.2 * S;
  const costEnclosure = 12 + 0.35 * cellsTotal;
  const costCooling = cooling.costFixed + cooling.costPerCell * cellsTotal;
  const costTotal = costCells + costBms + costEnclosure + costCooling;

  const costPerUsableKwh = (costTotal / Math.max(1, usableWh)) * 1000;
  const lifetimeKwh = (usableWh * cell.cycleLife * 0.9) / 1000;
  const costPerLifetimeKwh = costTotal / Math.max(0.1, lifetimeKwh);

  const whPerKg = usableWh / packMassKg;
  const whPerL = usableWh / packVolumeL;

  // ---------- load analysis ----------
  const contCurrentPackA = inputs.continuousLoadW / Math.max(1, packVnom);
  const contCurrentCellA = contCurrentPackA / P;
  const contCrate = contCurrentCellA / cell.capacityAh;
  const peakCurrentCellA = inputs.peakLoadW / Math.max(1, packVnom) / P;
  const peakCrate = peakCurrentCellA / cell.capacityAh;
  const rOhm = (cell.internalResistanceMohm / 1000) * 1.25;
  const heatWPerCellCont = contCurrentCellA ** 2 * rOhm;
  const ua = cellUA(cell, cooling);
  const meanRiseDis = heatWPerCellCont / ua;
  const steadyStateDischargeTempC = inputs.ambientC + meanRiseDis * (1 + cooling.spreadFactor);

  // ---------- charging simulation ----------
  const charge = simulateCharge(inputs, cell, cooling);
  const tempSpreadC = (charge.peakTempC - inputs.ambientC) * cooling.spreadFactor;
  const cellTemps = estimateCellTemps(
    (charge.peakTempC - inputs.ambientC) / (1 + cooling.spreadFactor),
    S,
    cooling,
    inputs.ambientC,
  );

  // ---------- safety checks ----------
  const checks: SafetyCheck[] = [];
  const add = (
    id: string, label: string, status: CheckStatus, value: string, limit: string, detail: string,
  ) => checks.push({ id, label, status, value, limit, detail });

  add(
    "cont-crate",
    "Continuous discharge vs cell limit",
    contCurrentCellA <= cell.maxDischargeA ? "pass" : contCurrentCellA <= cell.maxDischargeA * 1.15 ? "warn" : "fail",
    `${contCurrentCellA.toFixed(1)} A/cell (${contCrate.toFixed(1)}C)`,
    `≤ ${cell.maxDischargeA} A`,
    `Pack draws ${contCurrentPackA.toFixed(1)} A; each parallel group shares ${P}-way.`,
  );
  add(
    "peak-crate",
    "Peak discharge (pulse)",
    peakCurrentCellA <= cell.maxDischargeA * 1.5 ? "pass" : "fail",
    `${peakCurrentCellA.toFixed(1)} A/cell (${peakCrate.toFixed(1)}C)`,
    `≤ ${cell.maxDischargeA * 1.5} A (2× pulse class)`,
    "Short surges above the continuous limit are acceptable for <10 s if temperature stays in range.",
  );
  add(
    "charge-crate",
    "Charge C-rate vs cell capability",
    inputs.chargeCrate * cell.capacityAh <= cell.maxChargeA
      ? "pass"
      : inputs.chargeCrate * cell.capacityAh <= cell.maxChargeA * 1.2
        ? "warn"
        : "fail",
    `${(inputs.chargeCrate * cell.capacityAh).toFixed(1)} A/cell (${inputs.chargeCrate.toFixed(2)}C)`,
    `≤ ${cell.maxChargeA} A`,
    "Exceeding the datasheet charge current accelerates degradation and risks lithium plating.",
  );
  add(
    "charge-temp",
    "Hottest cell during charge",
    charge.peakTempC <= cell.tempChargeMaxC ? "pass" : charge.peakTempC <= cell.tempChargeMaxC + 8 ? "warn" : "fail",
    `${charge.peakTempC.toFixed(1)} °C`,
    `≤ ${cell.tempChargeMaxC} °C`,
    "Charging above the limit shortens life and precedes runaway onset under fault conditions.",
  );
  add(
    "discharge-temp",
    "Hottest cell during continuous discharge",
    steadyStateDischargeTempC <= cell.tempDischargeMaxC
      ? "pass"
      : steadyStateDischargeTempC <= cell.tempDischargeMaxC + 5
        ? "warn"
        : "fail",
    `${steadyStateDischargeTempC.toFixed(1)} °C`,
    `≤ ${cell.tempDischargeMaxC} °C`,
    `Steady state at ${inputs.continuousLoadW} W with ${cooling.name.toLowerCase()}.`,
  );
  add(
    "cold-charge",
    "Low-temperature charge risk",
    inputs.ambientC >= 5 ? "pass" : inputs.ambientC >= 0 ? "warn" : "fail",
    `${inputs.ambientC.toFixed(0)} °C ambient`,
    "≥ 0 °C (≥5 °C preferred)",
    "Charging below 0 °C plates metallic lithium on the anode — permanent capacity loss and internal short risk.",
  );
  add(
    "pack-voltage",
    "Pack voltage in safe DC window",
    packVmax <= 60 ? "pass" : packVmax <= 100 ? "warn" : "fail",
    `${packVmax.toFixed(0)} V max`,
    "≤ 60 V (≤ 100 V absolute)",
    "Above 60 V DC shock protection requirements escalate (SELV limit); above 100 V needs reinforced insulation.",
  );
  const imbalance = P >= 3 ? Math.min(12, 2.5 * P) : P === 2 ? 4 : 0;
  add(
    "cell-variation",
    "Cell variation & parallel imbalance",
    imbalance <= 5 ? "pass" : imbalance <= 9 ? "warn" : "fail",
    P > 1 ? `±${imbalance.toFixed(0)}% current skew` : "1P — N/A",
    "±5% preferred",
    P > 1
      ? `Capacity/resistance spread across ${P} parallel cells skews current share; estimates grow with group size.`
      : "Single parallel cell per group — no imbalance, but any cell fault is a hard outage.",
  );

  const failCount = checks.filter((c) => c.status === "fail").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;

  // ---------- scores ----------
  const partial = {
    cell, cooling, inputs, cellsTotal,
    packVnom, packVmax, packVmin, packAh, packWh, usableWh,
    cellMassKg, overheadMassKg, packMassKg, packVolumeL,
    costCells, costBms, costEnclosure, costCooling, costTotal,
    whPerKg, whPerL, costPerUsableKwh, costPerLifetimeKwh,
    contCurrentPackA, contCurrentCellA, contCrate, peakCurrentCellA, peakCrate,
    heatWPerCellCont, steadyStateDischargeTempC, charge, tempSpreadC, cellTemps,
    failCount, warnCount,
  };
  const scores = computeScores(inputs, partial);
  const totalScore = SCORE_CRITERIA.reduce((acc, c) => acc + c.weight * scores[c.key], 0);

  return { ...partial, checks, scores, totalScore };
}

export const DEFAULT_INPUTS: PackInputs = {
  cellId: "lg-mj1",
  series: 10,
  parallel: 4,
  coolingId: "passive",
  ambientC: 30,
  dod: 0.8,
  chargeCrate: 0.5,
  continuousLoadW: 350,
  peakLoadW: 900,
  targetUsableWh: 400,
};
