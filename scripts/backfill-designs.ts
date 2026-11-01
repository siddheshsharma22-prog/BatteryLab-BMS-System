// Backfill design rows that were auto-created by /api/simulate with only 14
// fields (nominalV / dims / materials / cycle life were null). Matches each
// design to a library cell by model substring in the design name and fills
// every null field from datasheet values via cellToDesign().
import { PrismaClient } from "@prisma/client";
import { LIBRARY_CELLS, cellToDesign } from "../src/lib/lab/library";

const db = new PrismaClient();

async function main() {
  const designs = await db.batteryDesign.findMany();
  let patched = 0;
  for (const d of designs) {
    // find a library cell whose model (or brand+model) appears in the design name
    const cell = LIBRARY_CELLS.find((c) => d.name.toLowerCase().includes(c.model.toLowerCase()))
      ?? LIBRARY_CELLS.find((c) => d.name.toLowerCase().includes(`${c.brand} ${c.model}`.toLowerCase()));
    if (!cell) {
      console.log(`SKIP (no library match): ${d.name}`);
      continue;
    }
    const ref = cellToDesign(cell);
    const data: Record<string, unknown> = {};
    const setIfNull = (k: string, v: unknown) => {
      if ((d as Record<string, unknown>)[k] === null && v !== null && v !== undefined && v !== 0) data[k] = v;
    };
    (["brand", "model", "formFactor", "cathode", "anode", "separator", "electrolyte", "application", "sourceRef",
      "nominalV", "maxPulseDischargeC", "stdChargeC", "diameterMm", "lengthMm", "widthMm", "heightMm",
      "thicknessMm", "cycleLifeCycles", "cycleLifeNote", "chargeTempMinC", "chargeTempMaxC",
      "dischargeTempMinC", "dischargeTempMaxC", "selfDischargePctMonth"] as const).forEach((k) => setIfNull(k, ref[k]));
    if (Object.keys(data).length === 0) {
      console.log(`OK (nothing to fill): ${d.name}`);
      continue;
    }
    await db.batteryDesign.update({ where: { id: d.id }, data });
    patched++;
    console.log(`PATCHED ${d.name}: ${Object.keys(data).join(", ")}`);
  }
  console.log(`\nDone — ${patched}/${designs.length} design rows backfilled.`);
}
main().finally(() => db.$disconnect());
