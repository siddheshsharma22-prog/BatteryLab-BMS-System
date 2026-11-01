import { evaluateDesign, DEFAULT_INPUTS } from "../src/lib/battery/model";

function probe(label: string, inputs: any) {
  const r = evaluateDesign(inputs);
  console.log("=== " + label + " ===");
  console.log("usableWh", r.usableWh, "chargeMin", r.charge.timeTo80Min.toFixed(1), "peakT", r.charge.peakTempC.toFixed(1));
  console.log("costLifetimeKwh", r.costPerLifetimeKwh, "whPerKg", r.whPerKg.toFixed(1));
  console.log("scores", Object.fromEntries(Object.entries(r.scores).map(([k, v]) => [k, v.toFixed(1)])));
  console.log("totalScore", r.totalScore);
}

probe("DEFAULT baseline MJ1 10S2P passive 0.5C", DEFAULT_INPUTS);
probe("40T liquid 2C", { ...DEFAULT_INPUTS, cellId: "samsung-40t", coolingId: "liquid", chargeCrate: 2 });
