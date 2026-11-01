// ============================================================
// BatteryLab — Cell Library
// 24 real datasheet cells across 17 brands and 8 chemistries.
// Every value is the user's EDITABLE starting point — loading a
// cell only pre-fills the Design tab.
// ============================================================

import type { CellDesign, Chemistry } from "./engine";
import { blankDesign, estimateAreaM2 } from "./engine";

export interface LibraryCell {
  id: string;
  brand: string;
  model: string;
  category: string;
  chemistry: Chemistry;
  formFactor: string;
  cathode: string;
  anode: string;
  separator: string;
  electrolyte: string;
  application: string;
  sourceRef: string;
  capacityAh: number;
  nominalV: number;
  vmax: number;
  vmin: number;
  r0: number;
  r1: number;
  c1: number;
  r2: number;
  c2: number;
  maxDischargeC: number;
  maxPulseDischargeC: number;
  maxChargeC: number;
  stdChargeC: number;
  diameterMm: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  massKg: number;
  cpJkgK: number;
  entropicVperK: number;
  cycleLifeCycles: number;
  cycleLifeNote: string;
  chargeTempMinC: number;
  chargeTempMaxC: number;
  dischargeTempMinC: number;
  dischargeTempMaxC: number;
  selfDischargePctMonth: number;
}

export const LIBRARY_CATEGORIES = [
  "Cylindrical 18650",
  "Cylindrical 20700 / 21700",
  "Cylindrical 26650 / 32700",
  "Prismatic LFP",
  "Pouch",
  "Coin / button",
  "Lead-acid blocks",
  "NiMH / NiCd",
] as const;

// 2RC starting points per chemistry family (τ₁ ≈ 15–25 s polarization,
// τ₂ ≈ 300–1500 s diffusion), scaled to each cell's resistance.
function rc(chem: Chemistry, r0: number): Pick<LibraryCell, "r1" | "c1" | "r2" | "c2"> {
  switch (chem) {
    case "LFP": return { r1: r0 * 0.6, c1: 40000, r2: r0 * 0.45, c2: 300000 };
    case "LTO": return { r1: r0 * 0.5, c1: 9000, r2: r0 * 0.35, c2: 60000 };
    case "LeadAcid": return { r1: r0 * 0.8, c1: 3000, r2: r0 * 0.6, c2: 25000 };
    case "NiMH": return { r1: r0 * 0.9, c1: 1500, r2: r0 * 0.7, c2: 12000 };
    case "NiCd": return { r1: r0 * 0.8, c1: 1200, r2: r0 * 0.6, c2: 9000 };
    default: return { r1: r0 * 0.55, c1: 2400, r2: r0 * 0.4, c2: 18000 };
  }
}

type CellSpec = Omit<LibraryCell, "r1" | "c1" | "r2" | "c2">;

const SEP_LI = "Ceramic-coated PE";
const SEP_LA = "AGM / microporous";
const ELEC_LI = "LiPF₆ in EC/DMC";
const ELEC_LA = "Sulfuric acid / VRLA";

const SPECS: CellSpec[] = [
  // ---------- Cylindrical 21700 / 20700 ----------
  {
    id: "samsung-40t", brand: "Samsung SDI", model: "INR21700-40T", category: "Cylindrical 20700 / 21700",
    chemistry: "NMC", formFactor: "Cylindrical 21700",
    cathode: "NMC 811 (LiNi₀.₈Mn₀.₁Co₀.₁O₂)", anode: "Graphite + Si", separator: SEP_LI, electrolyte: ELEC_LI,
    application: "Power tools, e-mobility, EV modules", sourceRef: "Samsung SDI datasheet, 2023 rev.",
    capacityAh: 4.0, nominalV: 3.6, vmax: 4.2, vmin: 2.5, r0: 0.011,
    maxDischargeC: 8.75, maxPulseDischargeC: 11.25, maxChargeC: 1.5, stdChargeC: 0.5,
    diameterMm: 21.5, lengthMm: 70.7, widthMm: 0, heightMm: 0, thicknessMm: 0,
    massKg: 0.069, cpJkgK: 1000, entropicVperK: 0.0001,
    cycleLifeCycles: 250, cycleLifeNote: "250 cycles to 60% @ 6A charge / 15A discharge, 25°C",
    chargeTempMinC: 0, chargeTempMaxC: 45, dischargeTempMinC: -20, dischargeTempMaxC: 60,
    selfDischargePctMonth: 2,
  },
  {
    id: "samsung-25r", brand: "Samsung SDI", model: "INR18650-25R", category: "Cylindrical 18650",
    chemistry: "NMC", formFactor: "Cylindrical 18650",
    cathode: "NMC (LiNiMnCoO₂)", anode: "Graphite", separator: SEP_LI, electrolyte: ELEC_LI,
    application: "Power tools, vaping, packs", sourceRef: "Samsung SDI datasheet rev. 2",
    capacityAh: 2.5, nominalV: 3.6, vmax: 4.2, vmin: 2.5, r0: 0.022,
    maxDischargeC: 8, maxPulseDischargeC: 16, maxChargeC: 1.6, stdChargeC: 0.5,
    diameterMm: 18.4, lengthMm: 65.1, widthMm: 0, heightMm: 0, thicknessMm: 0,
    massKg: 0.045, cpJkgK: 1020, entropicVperK: 0.0001,
    cycleLifeCycles: 250, cycleLifeNote: "250 cycles to 65% @ 1.25A charge / 20A discharge",
    chargeTempMinC: 0, chargeTempMaxC: 45, dischargeTempMinC: -20, dischargeTempMaxC: 60,
    selfDischargePctMonth: 2,
  },
  {
    id: "lg-m50lt", brand: "LG Energy Solution", model: "INR21700-M50LT", category: "Cylindrical 20700 / 21700",
    chemistry: "NMC", formFactor: "Cylindrical 21700",
    cathode: "NMC 622", anode: "Graphite + SiO", separator: SEP_LI, electrolyte: ELEC_LI,
    application: "EV, light mobility, ESS modules", sourceRef: "LG ES product brief, 2023",
    capacityAh: 5.0, nominalV: 3.63, vmax: 4.2, vmin: 2.5, r0: 0.016,
    maxDischargeC: 3, maxPulseDischargeC: 6, maxChargeC: 1, stdChargeC: 0.5,
    diameterMm: 21.4, lengthMm: 70.4, widthMm: 0, heightMm: 0, thicknessMm: 0,
    massKg: 0.071, cpJkgK: 1010, entropicVperK: 0.00009,
    cycleLifeCycles: 500, cycleLifeNote: "500 cycles to 80% @ 0.5C / 1C, 25°C",
    chargeTempMinC: 0, chargeTempMaxC: 45, dischargeTempMinC: -20, dischargeTempMaxC: 60,
    selfDischargePctMonth: 1.8,
  },
  {
    id: "lg-mj1", brand: "LG Energy Solution", model: "INR18650-MJ1", category: "Cylindrical 18650",
    chemistry: "NMC", formFactor: "Cylindrical 18650",
    cathode: "NMC 811", anode: "Graphite + Si", separator: SEP_LI, electrolyte: ELEC_LI,
    application: "E-bikes, energy-oriented packs", sourceRef: "LG Chem MJ1 datasheet, 2019",
    capacityAh: 3.5, nominalV: 3.635, vmax: 4.2, vmin: 2.5, r0: 0.028,
    maxDischargeC: 2.9, maxPulseDischargeC: 4.3, maxChargeC: 1.2, stdChargeC: 0.5,
    diameterMm: 18.5, lengthMm: 65.2, widthMm: 0, heightMm: 0, thicknessMm: 0,
    massKg: 0.049, cpJkgK: 1030, entropicVperK: 0.0001,
    cycleLifeCycles: 400, cycleLifeNote: "400 cycles to 80% @ 0.5C / 0.5C, 25°C",
    chargeTempMinC: 0, chargeTempMaxC: 45, dischargeTempMinC: -20, dischargeTempMaxC: 60,
    selfDischargePctMonth: 1.5,
  },
  {
    id: "murata-vtc6", brand: "Murata (Sony)", model: "US18650VTC6", category: "Cylindrical 18650",
    chemistry: "NMC", formFactor: "Cylindrical 18650",
    cathode: "NMC", anode: "Graphite", separator: SEP_LI, electrolyte: ELEC_LI,
    application: "Power tools, drones, high-drain packs", sourceRef: "Murata VTC6 datasheet, 2020",
    capacityAh: 3.12, nominalV: 3.6, vmax: 4.2, vmin: 2.5, r0: 0.015,
    maxDischargeC: 10, maxPulseDischargeC: 15, maxChargeC: 1.5, stdChargeC: 0.75,
    diameterMm: 18.3, lengthMm: 65.2, widthMm: 0, heightMm: 0, thicknessMm: 0,
    massKg: 0.047, cpJkgK: 1020, entropicVperK: 0.0001,
    cycleLifeCycles: 300, cycleLifeNote: "300 cycles to 70% @ 1.5A charge / 10A discharge",
    chargeTempMinC: 0, chargeTempMaxC: 45, dischargeTempMinC: -20, dischargeTempMaxC: 60,
    selfDischargePctMonth: 2,
  },
  {
    id: "molicel-p45b", brand: "Molicel", model: "INR21700-P45B", category: "Cylindrical 20700 / 21700",
    chemistry: "NMC", formFactor: "Cylindrical 21700",
    cathode: "NMC + graphite-silicon", anode: "Graphite + SiO", separator: SEP_LI, electrolyte: ELEC_LI,
    application: "Performance EV, drones, motorsport", sourceRef: "Molicel P45B datasheet v3.2",
    capacityAh: 4.5, nominalV: 3.6, vmax: 4.2, vmin: 2.5, r0: 0.010,
    maxDischargeC: 10, maxPulseDischargeC: 15, maxChargeC: 1.5, stdChargeC: 0.5,
    diameterMm: 21.5, lengthMm: 70.3, widthMm: 0, heightMm: 0, thicknessMm: 0,
    massKg: 0.070, cpJkgK: 1000, entropicVperK: 0.0001,
    cycleLifeCycles: 500, cycleLifeNote: "500 cycles to 80% @ 45A discharge, 25°C",
    chargeTempMinC: 0, chargeTempMaxC: 45, dischargeTempMinC: -20, dischargeTempMaxC: 60,
    selfDischargePctMonth: 1.8,
  },
  {
    id: "molicel-p28a", brand: "Molicel", model: "INR18650-P28A", category: "Cylindrical 18650",
    chemistry: "NMC", formFactor: "Cylindrical 18650",
    cathode: "NMC", anode: "Graphite + Si", separator: SEP_LI, electrolyte: ELEC_LI,
    application: "Power tools, e-bikes", sourceRef: "Molicel P28A datasheet, 2021",
    capacityAh: 2.8, nominalV: 3.6, vmax: 4.2, vmin: 2.5, r0: 0.016,
    maxDischargeC: 10, maxPulseDischargeC: 16, maxChargeC: 1.5, stdChargeC: 0.75,
    diameterMm: 18.5, lengthMm: 65.1, widthMm: 0, heightMm: 0, thicknessMm: 0,
    massKg: 0.048, cpJkgK: 1020, entropicVperK: 0.0001,
    cycleLifeCycles: 600, cycleLifeNote: "600 cycles to 80% @ 10A discharge, 25°C",
    chargeTempMinC: 0, chargeTempMaxC: 45, dischargeTempMinC: -20, dischargeTempMaxC: 60,
    selfDischargePctMonth: 1.8,
  },
  {
    id: "panasonic-cy", brand: "Panasonic", model: "NCR21700CY", category: "Cylindrical 20700 / 21700",
    chemistry: "NMC", formFactor: "Cylindrical 21700",
    cathode: "NMC", anode: "Graphite + Si", separator: SEP_LI, electrolyte: ELEC_LI,
    application: "E-mobility, torque tools", sourceRef: "Panasonic CY product sheet, 2022",
    capacityAh: 4.0, nominalV: 3.6, vmax: 4.2, vmin: 2.5, r0: 0.014,
    maxDischargeC: 3.75, maxPulseDischargeC: 6, maxChargeC: 1.5, stdChargeC: 0.7,
    diameterMm: 21.5, lengthMm: 70.5, widthMm: 0, heightMm: 0, thicknessMm: 0,
    massKg: 0.069, cpJkgK: 1010, entropicVperK: 0.0001,
    cycleLifeCycles: 400, cycleLifeNote: "400 cycles to 80% @ 10A discharge, 25°C",
    chargeTempMinC: 0, chargeTempMaxC: 45, dischargeTempMinC: -20, dischargeTempMaxC: 60,
    selfDischargePctMonth: 2,
  },
  {
    id: "sanyo-20700b", brand: "Sanyo (Panasonic)", model: "NCR20700B", category: "Cylindrical 20700 / 21700",
    chemistry: "NMC", formFactor: "Cylindrical 20700",
    cathode: "NMC", anode: "Graphite + Si", separator: SEP_LI, electrolyte: ELEC_LI,
    application: "E-bikes, energy packs", sourceRef: "Sanyo 20700B datasheet, 2018",
    capacityAh: 4.25, nominalV: 3.6, vmax: 4.2, vmin: 2.5, r0: 0.018,
    maxDischargeC: 7, maxPulseDischargeC: 10, maxChargeC: 1.2, stdChargeC: 0.5,
    diameterMm: 20.4, lengthMm: 70.2, widthMm: 0, heightMm: 0, thicknessMm: 0,
    massKg: 0.064, cpJkgK: 1010, entropicVperK: 0.0001,
    cycleLifeCycles: 400, cycleLifeNote: "400 cycles to 75% @ 15A discharge, 25°C",
    chargeTempMinC: 0, chargeTempMaxC: 45, dischargeTempMinC: -20, dischargeTempMaxC: 60,
    selfDischargePctMonth: 2,
  },
  {
    id: "panasonic-ncr18650b", brand: "Panasonic", model: "NCR18650B", category: "Cylindrical 18650",
    chemistry: "NMC", formFactor: "Cylindrical 18650",
    cathode: "NMC", anode: "Graphite + Si", separator: SEP_LI, electrolyte: ELEC_LI,
    application: "Laptops, power banks, light EV", sourceRef: "Panasonic NCR18650B datasheet, 2017",
    capacityAh: 3.4, nominalV: 3.6, vmax: 4.2, vmin: 2.5, r0: 0.030,
    maxDischargeC: 1.5, maxPulseDischargeC: 2.9, maxChargeC: 0.9, stdChargeC: 0.5,
    diameterMm: 18.4, lengthMm: 65.3, widthMm: 0, heightMm: 0, thicknessMm: 0,
    massKg: 0.049, cpJkgK: 1040, entropicVperK: 0.0001,
    cycleLifeCycles: 500, cycleLifeNote: "500 cycles to 65% @ 0.7C / 0.7C, 25°C",
    chargeTempMinC: 0, chargeTempMaxC: 45, dischargeTempMinC: -20, dischargeTempMaxC: 60,
    selfDischargePctMonth: 1.5,
  },
  {
    id: "panasonic-2170-nca", brand: "Panasonic", model: "2170 (Tesla 2170)", category: "Cylindrical 20700 / 21700",
    chemistry: "NCA", formFactor: "Cylindrical 21700",
    cathode: "NCA (LiNiCoAlO₂)", anode: "Graphite + Si", separator: SEP_LI, electrolyte: ELEC_LI,
    application: "EV traction (Model 3 / Y)", sourceRef: "Tesla/Panasonic 2170 teardown spec.",
    capacityAh: 4.8, nominalV: 3.7, vmax: 4.2, vmin: 2.7, r0: 0.012,
    maxDischargeC: 5, maxPulseDischargeC: 8, maxChargeC: 1.3, stdChargeC: 0.5,
    diameterMm: 21.0, lengthMm: 70.0, widthMm: 0, heightMm: 0, thicknessMm: 0,
    massKg: 0.068, cpJkgK: 1000, entropicVperK: 0.00008,
    cycleLifeCycles: 800, cycleLifeNote: "800 cycles to 80% @ 1C / 1C, 25°C (pack-level est.)",
    chargeTempMinC: 0, chargeTempMaxC: 45, dischargeTempMinC: -20, dischargeTempMaxC: 60,
    selfDischargePctMonth: 1.5,
  },

  // ---------- LFP ----------
  {
    id: "a123-m1b", brand: "A123 Systems", model: "ANR26650M1B", category: "Cylindrical 26650 / 32700",
    chemistry: "LFP", formFactor: "Cylindrical 26650",
    cathode: "LiFePO₄ (nanophosphate)", anode: "Graphite", separator: SEP_LI, electrolyte: ELEC_LI,
    application: "Power tools, motorsport, aviation", sourceRef: "A123 M1B datasheet, 2021",
    capacityAh: 2.5, nominalV: 3.3, vmax: 3.6, vmin: 2.0, r0: 0.006,
    maxDischargeC: 20, maxPulseDischargeC: 30, maxChargeC: 4, stdChargeC: 0.6,
    diameterMm: 26.6, lengthMm: 65.2, widthMm: 0, heightMm: 0, thicknessMm: 0,
    massKg: 0.076, cpJkgK: 950, entropicVperK: 0.00005,
    cycleLifeCycles: 1000, cycleLifeNote: ">1000 cycles to 80% @ 10C discharge, 25°C",
    chargeTempMinC: 0, chargeTempMaxC: 55, dischargeTempMinC: -20, dischargeTempMaxC: 60,
    selfDischargePctMonth: 1,
  },
  {
    id: "eve-lf280k", brand: "EVE Energy", model: "LF280K", category: "Prismatic LFP",
    chemistry: "LFP", formFactor: "Prismatic terminal-top",
    cathode: "LiFePO₄", anode: "Graphite", separator: SEP_LI, electrolyte: ELEC_LI,
    application: "ESS, commercial EV, marine", sourceRef: "EVE LF280K datasheet, 2023",
    capacityAh: 280, nominalV: 3.2, vmax: 3.65, vmin: 2.5, r0: 0.00025,
    maxDischargeC: 1, maxPulseDischargeC: 2, maxChargeC: 0.5, stdChargeC: 0.2,
    diameterMm: 0, lengthMm: 173.7, widthMm: 71.7, heightMm: 207.2, thicknessMm: 0,
    massKg: 5.44, cpJkgK: 1100, entropicVperK: 0.00005,
    cycleLifeCycles: 3500, cycleLifeNote: "3500 cycles to 80% @ 0.5C / 0.5C, 25°C",
    chargeTempMinC: 0, chargeTempMaxC: 55, dischargeTempMinC: -20, dischargeTempMaxC: 60,
    selfDischargePctMonth: 1,
  },
  {
    id: "byd-blade", brand: "BYD", model: "Blade Cell 138.5", category: "Prismatic LFP",
    chemistry: "LFP", formFactor: "Blade prismatic",
    cathode: "LiFePO₄", anode: "Graphite", separator: SEP_LI, electrolyte: ELEC_LI,
    application: "BYD EV (CTP blade pack)", sourceRef: "BYD Blade public spec., 2022",
    capacityAh: 138.5, nominalV: 3.2, vmax: 3.65, vmin: 2.5, r0: 0.0004,
    maxDischargeC: 2, maxPulseDischargeC: 4, maxChargeC: 1, stdChargeC: 0.5,
    diameterMm: 0, lengthMm: 960, widthMm: 90, heightMm: 13.5, thicknessMm: 0,
    massKg: 2.12, cpJkgK: 1080, entropicVperK: 0.00005,
    cycleLifeCycles: 3000, cycleLifeNote: "3000 cycles to 80% @ 1C / 1C, 25°C (est.)",
    chargeTempMinC: 0, chargeTempMaxC: 55, dischargeTempMinC: -20, dischargeTempMaxC: 60,
    selfDischargePctMonth: 1,
  },
  {
    id: "headway-38120hp", brand: "Headway", model: "38120HP", category: "Cylindrical 26650 / 32700",
    chemistry: "LFP", formFactor: "Cylindrical 32700",
    cathode: "LiFePO₄", anode: "Graphite", separator: SEP_LI, electrolyte: ELEC_LI,
    application: "EV conversions, solar, UPS", sourceRef: "Headway 38120HP datasheet",
    capacityAh: 8.0, nominalV: 3.2, vmax: 3.65, vmin: 2.5, r0: 0.0025,
    maxDischargeC: 12, maxPulseDischargeC: 15, maxChargeC: 5, stdChargeC: 0.5,
    diameterMm: 38, lengthMm: 132, widthMm: 0, heightMm: 0, thicknessMm: 0,
    massKg: 0.33, cpJkgK: 980, entropicVperK: 0.00005,
    cycleLifeCycles: 2000, cycleLifeNote: "2000 cycles to 80% @ 0.5C, 25°C",
    chargeTempMinC: 0, chargeTempMaxC: 55, dischargeTempMinC: -20, dischargeTempMaxC: 65,
    selfDischargePctMonth: 1.2,
  },
  {
    id: "cnae-32140", brand: "CNAE", model: "32140 ESS A Grade", category: "Cylindrical 26650 / 32700",
    chemistry: "LFP", formFactor: "Cylindrical 32140",
    cathode: "LiFePO₄", anode: "Graphite", separator: SEP_LI, electrolyte: ELEC_LI,
    application: "ESS, solar batteries, electric vehicles, industrial power packs", sourceRef: "CNAE 32140 ESS A Grade datasheet",
    capacityAh: 15.0, nominalV: 3.2, vmax: 3.65, vmin: 2.0, r0: 0.012,
    maxDischargeC: 3, maxPulseDischargeC: 4.5, maxChargeC: 1, stdChargeC: 0.5,
    diameterMm: 32, lengthMm: 140, widthMm: 0, heightMm: 0, thicknessMm: 0,
    massKg: 0.31, cpJkgK: 1000, entropicVperK: 0.00005,
    cycleLifeCycles: 3000, cycleLifeNote: "≥3000 cycles @ 80% DOD",
    chargeTempMinC: 0, chargeTempMaxC: 60, dischargeTempMinC: -20, dischargeTempMaxC: 60,
    selfDischargePctMonth: 1.5,
  },

  // ---------- LTO ----------
  {
    id: "toshiba-scib20", brand: "Toshiba", model: "SCiB 20Ah", category: "Prismatic LFP",
    chemistry: "LTO", formFactor: "Prismatic",
    cathode: "NMC (LiNiMnCoO₂)", anode: "LTO (Li₄Ti₅O₁₂)", separator: SEP_LI, electrolyte: ELEC_LI,
    application: "Industrial, buses, rail, crane", sourceRef: "Toshiba SCiB cell spec., 2022",
    capacityAh: 20, nominalV: 2.3, vmax: 2.7, vmin: 1.5, r0: 0.0008,
    maxDischargeC: 5, maxPulseDischargeC: 10, maxChargeC: 5, stdChargeC: 2.5,
    diameterMm: 0, lengthMm: 116, widthMm: 22, heightMm: 106, thicknessMm: 0,
    massKg: 0.52, cpJkgK: 900, entropicVperK: 0.00004,
    cycleLifeCycles: 10000, cycleLifeNote: ">10,000 cycles to 80% @ 5C fast charge, 25°C",
    chargeTempMinC: -30, chargeTempMaxC: 50, dischargeTempMinC: -30, dischargeTempMaxC: 60,
    selfDischargePctMonth: 0.5,
  },
  {
    id: "yinlong-66160", brand: "Yinlong", model: "66160H 35Ah", category: "Cylindrical 26650 / 32700",
    chemistry: "LTO", formFactor: "Cylindrical 66160",
    cathode: "LMO/NMC", anode: "LTO (Li₄Ti₅O₁₂)", separator: SEP_LI, electrolyte: ELEC_LI,
    application: "Grid frequency regulation, trams", sourceRef: "Yinlong 66160H datasheet",
    capacityAh: 35, nominalV: 2.3, vmax: 2.7, vmin: 1.5, r0: 0.0007,
    maxDischargeC: 6, maxPulseDischargeC: 10, maxChargeC: 6, stdChargeC: 3,
    diameterMm: 66, lengthMm: 160, widthMm: 0, heightMm: 0, thicknessMm: 0,
    massKg: 1.25, cpJkgK: 900, entropicVperK: 0.00004,
    cycleLifeCycles: 25000, cycleLifeNote: "25,000 cycles to 80% @ 3C, 25°C",
    chargeTempMinC: -25, chargeTempMaxC: 55, dischargeTempMinC: -40, dischargeTempMaxC: 60,
    selfDischargePctMonth: 0.5,
  },

  // ---------- LCO pouch & coin ----------
  {
    id: "atl-pouch3ah", brand: "ATL", model: "Consumer pouch 3.0Ah", category: "Pouch",
    chemistry: "LCO", formFactor: "Pouch",
    cathode: "LiCoO₂", anode: "Graphite", separator: SEP_LI, electrolyte: ELEC_LI,
    application: "Smartphones, tablets, wearables", sourceRef: "ATL standard pouch spec.",
    capacityAh: 3.0, nominalV: 3.7, vmax: 4.2, vmin: 3.0, r0: 0.045,
    maxDischargeC: 1, maxPulseDischargeC: 2, maxChargeC: 0.7, stdChargeC: 0.3,
    diameterMm: 0, lengthMm: 0, widthMm: 62, heightMm: 63, thicknessMm: 7.6,
    massKg: 0.047, cpJkgK: 1050, entropicVperK: 0.0002,
    cycleLifeCycles: 500, cycleLifeNote: "500 cycles to 80% @ 0.2C / 0.5C, 25°C",
    chargeTempMinC: 0, chargeTempMaxC: 45, dischargeTempMinC: -20, dischargeTempMaxC: 60,
    selfDischargePctMonth: 3,
  },
  {
    id: "pkcell-lir2450", brand: "PKCELL", model: "LIR2450", category: "Coin / button",
    chemistry: "LCO", formFactor: "Coin / button",
    cathode: "LiCoO₂", anode: "Graphite", separator: SEP_LI, electrolyte: ELEC_LI,
    application: "Small IoT, RTC backup, wearables", sourceRef: "PKCELL LIR2450 datasheet",
    capacityAh: 0.12, nominalV: 3.6, vmax: 4.2, vmin: 3.0, r0: 2.0,
    maxDischargeC: 1, maxPulseDischargeC: 2, maxChargeC: 1, stdChargeC: 0.2,
    diameterMm: 24.5, lengthMm: 5.2, widthMm: 0, heightMm: 0, thicknessMm: 0,
    massKg: 0.006, cpJkgK: 1050, entropicVperK: 0.0002,
    cycleLifeCycles: 500, cycleLifeNote: "500 cycles to 80% @ 0.2C, 25°C",
    chargeTempMinC: 0, chargeTempMaxC: 45, dischargeTempMinC: -20, dischargeTempMaxC: 60,
    selfDischargePctMonth: 5,
  },

  // ---------- Lead-acid blocks ----------
  {
    id: "trojan-t105", brand: "Trojan Battery", model: "T-105 GC2", category: "Lead-acid blocks",
    chemistry: "LeadAcid", formFactor: "GC2 6V flooded deep-cycle block (3 cells)",
    cathode: "PbO₂", anode: "Pb", separator: SEP_LA, electrolyte: ELEC_LA,
    application: "Golf carts, floor machines, off-grid", sourceRef: "Trojan T-105 spec., 2021",
    capacityAh: 225, nominalV: 6.32, vmax: 7.05, vmin: 5.25, r0: 0.0027,
    maxDischargeC: 0.5, maxPulseDischargeC: 1.5, maxChargeC: 0.15, stdChargeC: 0.07,
    diameterMm: 0, lengthMm: 264, widthMm: 181, heightMm: 276, thicknessMm: 0,
    massKg: 28.6, cpJkgK: 850, entropicVperK: 0.00002,
    cycleLifeCycles: 1200, cycleLifeNote: "1200 cycles to 50% DoD @ 25°C (IEC 61427)",
    chargeTempMinC: -20, chargeTempMaxC: 50, dischargeTempMinC: -20, dischargeTempMaxC: 60,
    selfDischargePctMonth: 4,
  },
  {
    id: "power-sonic-agm100", brand: "Power-Sonic", model: "PS-121000 AGM", category: "Lead-acid blocks",
    chemistry: "LeadAcid", formFactor: "12V AGM VRLA block (6 cells)",
    cathode: "PbO₂", anode: "Pb", separator: "AGM mat", electrolyte: ELEC_LA,
    application: "UPS, alarm, mobility, solar", sourceRef: "Power-Sonic PS-121000 datasheet",
    capacityAh: 100, nominalV: 12.7, vmax: 14.4, vmin: 10.5, r0: 0.0045,
    maxDischargeC: 0.5, maxPulseDischargeC: 1.2, maxChargeC: 0.25, stdChargeC: 0.1,
    diameterMm: 0, lengthMm: 343, widthMm: 172, heightMm: 240, thicknessMm: 0,
    massKg: 29, cpJkgK: 850, entropicVperK: 0.00002,
    cycleLifeCycles: 500, cycleLifeNote: "500 cycles to 50% DoD @ 25°C",
    chargeTempMinC: -15, chargeTempMaxC: 50, dischargeTempMinC: -20, dischargeTempMaxC: 60,
    selfDischargePctMonth: 3,
  },

  // ---------- NiMH / NiCd ----------
  {
    id: "panasonic-eneloop", brand: "Panasonic", model: "Eneloop BK-3MCC AA", category: "NiMH / NiCd",
    chemistry: "NiMH", formFactor: "Cylindrical AA (LR6-class)",
    cathode: "NiOOH", anode: "MH alloy (LaCe)", separator: "Non-woven polyolefin", electrolyte: "KOH aqueous",
    application: "Consumer AA devices, remotes, toys", sourceRef: "Panasonic Eneloop spec., 2020",
    capacityAh: 1.9, nominalV: 1.2, vmax: 1.45, vmin: 1.0, r0: 0.020,
    maxDischargeC: 2, maxPulseDischargeC: 5, maxChargeC: 0.5, stdChargeC: 0.1,
    diameterMm: 14.5, lengthMm: 50.4, widthMm: 0, heightMm: 0, thicknessMm: 0,
    massKg: 0.027, cpJkgK: 1100, entropicVperK: 0.00003,
    cycleLifeCycles: 2100, cycleLifeNote: "2100 cycles to 70% @ low self-discharge conditioning",
    chargeTempMinC: 0, chargeTempMaxC: 45, dischargeTempMinC: -20, dischargeTempMaxC: 60,
    selfDischargePctMonth: 3,
  },
  {
    id: "tenergy-d-nimh", brand: "Tenergy", model: "D 10000 NiMH", category: "NiMH / NiCd",
    chemistry: "NiMH", formFactor: "Cylindrical D (LR20-class)",
    cathode: "NiOOH", anode: "MH alloy", separator: "Non-woven polyolefin", electrolyte: "KOH aqueous",
    application: "Instruments, torches, RC", sourceRef: "Tenergy D-cell datasheet",
    capacityAh: 10, nominalV: 1.2, vmax: 1.45, vmin: 1.0, r0: 0.008,
    maxDischargeC: 2, maxPulseDischargeC: 4, maxChargeC: 0.3, stdChargeC: 0.1,
    diameterMm: 33, lengthMm: 61, widthMm: 0, heightMm: 0, thicknessMm: 0,
    massKg: 0.16, cpJkgK: 1100, entropicVperK: 0.00003,
    cycleLifeCycles: 800, cycleLifeNote: "800 cycles to 70% @ 0.2C, 25°C",
    chargeTempMinC: 0, chargeTempMaxC: 45, dischargeTempMinC: -20, dischargeTempMaxC: 60,
    selfDischargePctMonth: 5,
  },
  {
    id: "saft-nicd-d", brand: "Saft", model: "SBM D 4Ah NiCd", category: "NiMH / NiCd",
    chemistry: "NiCd", formFactor: "Cylindrical D (LR20-class)",
    cathode: "NiOOH", anode: "Cd", separator: "Non-woven polyolefin", electrolyte: "KOH aqueous",
    application: "Aviation, rail, extreme-temperature industrial", sourceRef: "Saft SBM series datasheet",
    capacityAh: 4.0, nominalV: 1.2, vmax: 1.45, vmin: 1.0, r0: 0.010,
    maxDischargeC: 5, maxPulseDischargeC: 8, maxChargeC: 1, stdChargeC: 0.15,
    diameterMm: 33, lengthMm: 61, widthMm: 0, heightMm: 0, thicknessMm: 0,
    massKg: 0.145, cpJkgK: 950, entropicVperK: 0.00003,
    cycleLifeCycles: 1500, cycleLifeNote: "1500 cycles to 80% @ 0.2C, 25°C",
    chargeTempMinC: -40, chargeTempMaxC: 55, dischargeTempMinC: -40, dischargeTempMaxC: 60,
    selfDischargePctMonth: 15,
  },
];

export const LIBRARY_CELLS: LibraryCell[] = SPECS.map((s) => ({ ...s, ...rc(s.chemistry, s.r0) }));

export function getLibraryCell(id: string): LibraryCell | undefined {
  return LIBRARY_CELLS.find((c) => c.id === id);
}

// Map a library cell onto the editable design sheet.
export function cellToDesign(c: LibraryCell): Partial<CellDesign> {
  return {
    name: `${c.brand} ${c.model}`,
    chemistry: c.chemistry,
    brand: c.brand,
    model: c.model,
    formFactor: c.formFactor,
    cathode: c.cathode,
    anode: c.anode,
    separator: c.separator,
    electrolyte: c.electrolyte,
    application: c.application,
    sourceRef: c.sourceRef,
    capacityAh: c.capacityAh,
    nominalV: c.nominalV,
    vmax: c.vmax,
    vmin: c.vmin,
    r0: c.r0,
    r1: c.r1,
    c1: c.c1,
    r2: c.r2,
    c2: c.c2,
    maxDischargeC: c.maxDischargeC,
    maxPulseDischargeC: c.maxPulseDischargeC,
    maxChargeC: c.maxChargeC,
    stdChargeC: c.stdChargeC,
    diameterMm: c.diameterMm,
    lengthMm: c.lengthMm,
    widthMm: c.widthMm,
    heightMm: c.heightMm,
    thicknessMm: c.thicknessMm,
    massKg: c.massKg,
    cpJkgK: c.cpJkgK,
    areaM2: estimateAreaM2({ ...blankish(c), areaM2: 0 } as CellDesign),
    entropicVperK: c.entropicVperK,
    cycleLifeCycles: c.cycleLifeCycles,
    cycleLifeNote: c.cycleLifeNote,
    chargeTempMinC: c.chargeTempMinC,
    chargeTempMaxC: c.chargeTempMaxC,
    dischargeTempMinC: c.dischargeTempMinC,
    dischargeTempMaxC: c.dischargeTempMaxC,
    selfDischargePctMonth: c.selfDischargePctMonth,
  };
}

function blankish(c: LibraryCell): CellDesign {
  return {
    ...(blankDesign()),
    formFactor: c.formFactor,
    diameterMm: c.diameterMm,
    lengthMm: c.lengthMm,
    widthMm: c.widthMm,
    heightMm: c.heightMm,
    thicknessMm: c.thicknessMm,
  } as CellDesign;
}
