/* Reproduce sag computation for the saved 40T design */
import { ocvSoc, loadedVoltageAtSoc, ocvScaleOf } from "../src/lib/lab/engine";

const d = {
  chemistry: "NMC",
  capacityAh: 4,
  nominalV: 3.6,
  vmax: 4.2,
  vmin: 2.5,
  r0: 0.011,
  seriesCount: 5,
  parallelCount: 4,
} as any;

console.log("ocvScaleOf:", ocvScaleOf(d));
console.log("ocvSoc(NMC, 0.5):", ocvSoc("NMC", 0.5));
console.log("loadedVoltageAtSoc(d, 0.5, 1):", loadedVoltageAtSoc(d, 0.5, 1));
const sag = (ocvSoc("NMC", 0.5) - loadedVoltageAtSoc(d, 0.5, 1)) * 1000;
console.log("sag1C (mV):", sag);
