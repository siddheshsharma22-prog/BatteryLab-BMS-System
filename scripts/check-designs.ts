import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const d = await db.batteryDesign.findUnique({ where: { id: "cmvmmolt3000bmi1713v33cbi" } });
  const pick = (o: any) => ({ id: o.id, name: o.name, chemistry: o.chemistry, nominalV: o.nominalV, capacityAh: o.capacityAh, vmax: o.vmax, vmin: o.vmin, seriesCount: o.seriesCount, parallelCount: o.parallelCount, diameterMm: o.diameterMm, lengthMm: o.lengthMm, massKg: o.massKg, formFactor: o.formFactor });
  console.log("latest-run design:", JSON.stringify(pick(d), null, 1));
  const all = await db.batteryDesign.findMany({ select: { id: true, name: true, nominalV: true, diameterMm: true, lengthMm: true } });
  console.log("total designs:", all.length, "| null nominalV:", all.filter((x) => x.nominalV == null).length, "| null diameter:", all.filter((x) => x.diameterMm == null).length);
}
main().finally(() => db.$disconnect());
