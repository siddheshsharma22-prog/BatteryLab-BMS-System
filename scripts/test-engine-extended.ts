// Quick physics sanity test for the extended engine (all 8 chemistries)
import {
  blankDesign, simulate, ocvScaleOf, effectiveCapacityPct, loadedVoltageAtSoc,
  type CellDesign,
} from "../src/lib/lab/engine";
import { LIBRARY_CELLS, cellToDesign } from "../src/lib/lab/library";

function testCell(name: string, d: CellDesign, pack: { series: number; parallel: number }) {
  const r = simulate(d, pack, {
    profile: "discharge", cRate: 1, durationS: 14400, ambientC: 25,
    hConv: 10, socStart: 1, coolingOn: false, customSegments: [],
  });
  const s = r.summary;
  console.log(
    `${name.padEnd(26)} chem=${d.chemistry.padEnd(9)} scale=${ocvScaleOf(d).toFixed(2)} ` +
    `cutoff="${s.cutoff.slice(0, 34).padEnd(34)} Vcell ${s.vMin}-${s.vMax} ` +
    `soc ${s.socStart}->${s.socEnd}% ${s.durationS}s ${s.packEnergyWh}Wh(pack) checks:${r.checks.filter(c=>c.status!=="ok").length}`
  );
}

// 1) Trojan T-105 6S lead-acid (the failing case)
const trojan = LIBRARY_CELLS.find((c) => c.id === "trojan-t105")!;
const tDesign = { ...blankDesign(), ...cellToDesign(trojan) } as CellDesign;
testCell("Trojan T-105 6S1P", tDesign, { series: 6, parallel: 1 });

// 2) Samsung 40T 1S (should be unchanged vs previous behaviour)
const t40 = LIBRARY_CELLS.find((c) => c.id === "samsung-inr21700-40t")!;
const d40 = { ...blankDesign(), ...cellToDesign(t40) } as CellDesign;
testCell("Samsung 40T 1S1P", d40, { series: 1, parallel: 1 });

// 3) Eneloop AA NiMH
const en = LIBRARY_CELLS.find((c) => c.id === "panasonic-eneloop-aa")!;
const dEn = { ...blankDesign(), ...cellToDesign(en) } as CellDesign;
testCell("Eneloop AA 1S1P", dEn, { series: 1, parallel: 1 });

// 4) EVE LF280K LFP
const lf = LIBRARY_CELLS.find((c) => c.id === "eve-lf280k")!;
const dLf = { ...blankDesign(), ...cellToDesign(lf) } as CellDesign;
testCell("EVE LF280K 1S1P", dLf, { series: 1, parallel: 1 });

// 5) CC-CV charge check on 40T (should complete with CV taper)
const rcccv = simulate(d40, { series: 1, parallel: 1 }, {
  profile: "cccv", cRate: 0.5, durationS: 14400, ambientC: 25,
  hConv: 10, socStart: 0.2, coolingOn: false, customSegments: [],
});
console.log(`CC-CV 40T: cutoff="${rcccv.summary.cutoff}" vMax=${rcccv.summary.vMax} (must be <=4.2)`);

// 6) Effective capacity at max C for a high-IR cell (LCO S3 at 1.25C)
const s3 = LIBRARY_CELLS.find((c) => c.id === "lg-icr18650s3")!;
const dS3 = { ...blankDesign(), ...cellToDesign(s3) } as CellDesign;
console.log(`LCO S3 usable @1.25C: ${effectiveCapacityPct(dS3, 1.25)}% (should be < 100)`);
console.log(`LCO S3 loaded V @100%SOC 1.25C: ${loadedVoltageAtSoc(dS3, 1, 1.25).toFixed(2)}V (must be >= vmin 3.0)`);
console.log(`LCO S3 loaded V @50%SOC 1.25C: ${loadedVoltageAtSoc(dS3, 0.5, 1.25).toFixed(2)}V`);
