/**
 * Cell library — parameters transcribed from manufacturer datasheets and
 * verified secondary sources. Each field carries a documented source.
 * See the Traceability tab for the full source register.
 */

export type Chemistry = "NMC" | "LFP";

export interface CellSpec {
  id: string;
  name: string;
  manufacturer: string;
  chemistry: Chemistry;
  format: string;
  tagline: string;
  capacityAh: number;
  nominalVoltage: number;
  chargeVoltageMax: number;
  voltageCutoff: number;
  internalResistanceMohm: number;
  maxDischargeA: number;
  maxChargeA: number;
  stdChargeA: number;
  weightG: number;
  diameterMm: number;
  heightMm: number;
  cycleLife: number;
  cycleLifeNote: string;
  priceUsd: number;
  tempChargeMaxC: number;
  tempDischargeMaxC: number;
  thermalRunawayOnsetC: number;
  /** Approximate open-circuit-voltage vs SOC polyline [soc%, volts] */
  ocvCurve: [number, number][];
  specificHeatJPerKgK: number;
  source: string;
}

export const CELLS: CellSpec[] = [
  {
    id: "samsung-25r",
    name: "Samsung INR18650-25R",
    manufacturer: "Samsung SDI",
    chemistry: "NMC",
    format: "18650",
    tagline: "Proven power cell — balanced cost",
    capacityAh: 2.5,
    nominalVoltage: 3.6,
    chargeVoltageMax: 4.2,
    voltageCutoff: 2.5,
    internalResistanceMohm: 22,
    maxDischargeA: 20,
    maxChargeA: 4,
    stdChargeA: 1.25,
    weightG: 45,
    diameterMm: 18.35,
    heightMm: 64.85,
    cycleLife: 250,
    cycleLifeNote: "≈250 cycles to 60% at rated loads (datasheet basis)",
    priceUsd: 2.9,
    tempChargeMaxC: 45,
    tempDischargeMaxC: 60,
    thermalRunawayOnsetC: 210,
    ocvCurve: [
      [0, 3.3], [10, 3.55], [25, 3.65], [50, 3.75],
      [75, 3.9], [90, 4.05], [100, 4.2],
    ],
    specificHeatJPerKgK: 1050,
    source: "Samsung INR18650-25R datasheet (rev. 2015); retail listings 2025",
  },
  {
    id: "lg-mj1",
    name: "LG INR18650-MJ1",
    manufacturer: "LG Energy Solution",
    chemistry: "NMC",
    format: "18650",
    tagline: "High energy density — gentle currents only",
    capacityAh: 3.5,
    nominalVoltage: 3.635,
    chargeVoltageMax: 4.2,
    voltageCutoff: 2.5,
    internalResistanceMohm: 32,
    maxDischargeA: 10,
    maxChargeA: 3.4,
    stdChargeA: 1.7,
    weightG: 49,
    diameterMm: 18.3,
    heightMm: 65.1,
    cycleLife: 400,
    cycleLifeNote: "≈400 cycles to 80% at moderate C-rates (est. from datasheet cycle curves)",
    priceUsd: 4.6,
    tempChargeMaxC: 45,
    tempDischargeMaxC: 60,
    thermalRunawayOnsetC: 210,
    ocvCurve: [
      [0, 3.3], [10, 3.55], [25, 3.65], [50, 3.75],
      [75, 3.9], [90, 4.05], [100, 4.2],
    ],
    specificHeatJPerKgK: 1050,
    source: "LG INR18650-MJ1 product specification (Farnell/DNK 2025); HKJ test data",
  },
  {
    id: "samsung-40t",
    name: "Samsung INR21700-40T",
    manufacturer: "Samsung SDI",
    chemistry: "NMC",
    format: "21700",
    tagline: "High-power 21700 — fast charge & discharge",
    capacityAh: 4.0,
    nominalVoltage: 3.6,
    chargeVoltageMax: 4.2,
    voltageCutoff: 2.5,
    internalResistanceMohm: 10.5,
    maxDischargeA: 35,
    maxChargeA: 6,
    stdChargeA: 2.0,
    weightG: 68,
    diameterMm: 21.1,
    heightMm: 70.4,
    cycleLife: 250,
    cycleLifeNote: "250 cycles to 60% at 6 A charge / 35 A discharge (datasheet)",
    priceUsd: 5.5,
    tempChargeMaxC: 45,
    tempDischargeMaxC: 60,
    thermalRunawayOnsetC: 210,
    ocvCurve: [
      [0, 3.3], [10, 3.55], [25, 3.65], [50, 3.75],
      [75, 3.9], [90, 4.05], [100, 4.2],
    ],
    specificHeatJPerKgK: 1050,
    source: "Samsung INR21700-40T datasheet (HKJ verified test, 2018); retail listings 2025",
  },
  {
    id: "a123-m1b",
    name: "A123 ANR26650M1B (LiFePO4)",
    manufacturer: "A123 Systems / Lithium Werks",
    chemistry: "LFP",
    format: "26650",
    tagline: "Safest chemistry — extreme power, 1000+ cycles",
    capacityAh: 2.5,
    nominalVoltage: 3.3,
    chargeVoltageMax: 3.6,
    voltageCutoff: 2.0,
    internalResistanceMohm: 6,
    maxDischargeA: 50,
    maxChargeA: 10,
    stdChargeA: 2.5,
    weightG: 76,
    diameterMm: 26.4,
    heightMm: 65.2,
    cycleLife: 1000,
    cycleLifeNote: ">1000 cycles at 100% DoD, 10C discharge (datasheet)",
    priceUsd: 7.8,
    tempChargeMaxC: 50,
    tempDischargeMaxC: 60,
    thermalRunawayOnsetC: 270,
    ocvCurve: [
      [0, 2.9], [5, 3.15], [15, 3.26], [40, 3.29],
      [65, 3.31], [85, 3.35], [100, 3.6],
    ],
    specificHeatJPerKgK: 1050,
    source: "A123 Nanophosphate ANR26650M1B datasheet (batteryspace/EVLithium 2025); Lithium Werks M1-B",
  },
];

export interface CoolingSpec {
  id: string;
  name: string;
  /** effective convective coefficient applied to wetted cell surface, W/m²K */
  hEff: number;
  /** fraction of cell surface actively cooled (liquid touches a cold plate) */
  contactFraction: number;
  addedFixedMassKg: number;
  addedMassPerCellKg: number;
  parasiticW: number;
  costFixed: number;
  costPerCell: number;
  /** ΔT non-uniformity factor: hottest cell runs (1+spread)× the mean rise */
  spreadFactor: number;
  addedVolumeL: number;
  description: string;
  pros: string[];
  cons: string[];
}

export const COOLING: CoolingSpec[] = [
  {
    id: "passive",
    name: "Passive air (natural convection)",
    hEff: 8,
    contactFraction: 1,
    addedFixedMassKg: 0,
    addedMassPerCellKg: 0.002,
    parasiticW: 0,
    costFixed: 0,
    costPerCell: 0.05,
    spreadFactor: 0.25,
    addedVolumeL: 0.15,
    description:
      "Cells radiate and convect to still air inside a vented enclosure. Zero parasitic power and no moving parts, but heat removal is capped at roughly 8 W/m²K — large packs overheat and cell-to-cell temperature spread grows.",
    pros: ["No parasitic energy", "Silent, no moving parts", "Lowest cost & mass"],
    cons: ["Weak heat removal (h≈8 W/m²K)", "Poor temperature uniformity", "Blocks fast charging"],
  },
  {
    id: "forced",
    name: "Forced air (axial fan)",
    hEff: 35,
    contactFraction: 1,
    addedFixedMassKg: 0.12,
    addedMassPerCellKg: 0.004,
    parasiticW: 3,
    costFixed: 6,
    costPerCell: 0.1,
    spreadFactor: 0.12,
    addedVolumeL: 0.45,
    description:
      "A fan drives air through cell channels, lifting the convective coefficient to ≈35 W/m²K. Cheap and light, but air's low heat capacity means downstream cells run hotter — the failure mode that plagued the air-cooled Nissan Leaf pack.",
    pros: ["5–7× heat removal vs passive", "Light and cheap", "Simple service"],
    cons: ["Fan noise + 3 W parasitic", "Downstream cells hotter", "Dust/water ingress paths"],
  },
  {
    id: "liquid",
    name: "Liquid cold plate (water/glycol)",
    hEff: 180,
    contactFraction: 0.45,
    addedFixedMassKg: 1.8,
    addedMassPerCellKg: 0.01,
    parasiticW: 8,
    costFixed: 45,
    costPerCell: 0.2,
    spreadFactor: 0.05,
    addedVolumeL: 1.1,
    description:
      "An aluminium cold plate contacts the cell base; pumped water/glycol gives an effective ≈180 W/m²K on the wetted area. Best temperature uniformity and enables maximum fast-charge rates, at the cost of ~1.8 kg, ~$45 and pump complexity — the mainstream EV solution.",
    pros: ["Highest cooling capacity", "Excellent uniformity (ΔT<5%)", "Enables fastest charging"],
    cons: ["+1.8 kg and ~$45 added", "Pump leak/complexity risk", "8 W parasitic load"],
  },
];

export interface Scenario {
  id: string;
  name: string;
  description: string;
  continuousW: number;
  peakW: number;
  targetUsableWh: number;
  ambientC: number;
  voltageHint: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "ebike",
    name: "Light e-mobility",
    description: "E-bike / e-scooter drive, 350 W cruise with hill-start surges.",
    continuousW: 350,
    peakW: 900,
    targetUsableWh: 400,
    ambientC: 30,
    voltageHint: "36–48 V class",
  },
  {
    id: "station",
    name: "Portable power station",
    description: "Campsite / emergency backup inverter, moderate loads, indoor temps.",
    continuousW: 300,
    peakW: 800,
    targetUsableWh: 600,
    ambientC: 25,
    voltageHint: "24–48 V class",
  },
  {
    id: "drone",
    name: "Delivery drone",
    description: "Multirotor UAV: high continuous hover power, extreme peak draw.",
    continuousW: 900,
    peakW: 2200,
    targetUsableWh: 250,
    ambientC: 35,
    voltageHint: "12S (44–50 V)",
  },
];

export const DOD_OPTIONS = [0.8, 0.9, 1.0];

export const CHEMISTRY_SCALE_PRICE = {
  NMC: { cellUsdPerKwh: 65.2, packUsdPerKwh: 128, source: "Benchmark Mineral Intelligence Q3 2025 / BNEF Dec 2025" },
  LFP: { cellUsdPerKwh: 48.6, packUsdPerKwh: 81, source: "Benchmark Mineral Intelligence Q3 2025 / BNEF Dec 2025" },
} as const;

export function getCell(id: string): CellSpec {
  return CELLS.find((c) => c.id === id) ?? CELLS[0];
}
export function getCooling(id: string): CoolingSpec {
  return COOLING.find((c) => c.id === id) ?? COOLING[0];
}
