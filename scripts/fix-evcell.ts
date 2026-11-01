import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const d = await db.batteryDesign.findFirst({ where: { name: "NMC 21700 EV Cell" } });
  if (!d) return console.log("not found");
  console.log("before:", JSON.stringify({ nominalV: d.nominalV, vmax: d.vmax, vmin: d.vmin, diameterMm: d.diameterMm, lengthMm: d.lengthMm, formFactor: d.formFactor, cathode: d.cathode }));
  const nominalV = d.nominalV ?? (d.vmax && d.vmin ? Math.round(((d.vmax + d.vmin) / 2 + 0.05) * 100) / 100 : null);
  await db.batteryDesign.update({
    where: { id: d.id },
    data: {
      nominalV,
      formFactor: d.formFactor ?? "cylindrical",
      cathode: d.cathode ?? "NMC 811",
      anode: d.anode ?? "Graphite/Si",
      diameterMm: d.diameterMm ?? 21.0,
      lengthMm: d.lengthMm ?? 65.9,
    },
  });
  console.log("patched with nominalV =", nominalV);
}
main().finally(() => db.$disconnect());
