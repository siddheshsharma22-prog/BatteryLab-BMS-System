import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { simulate, type CellDesign, type PackConfig, type SimParams, type Chemistry } from "@/lib/lab/engine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // design may come inline (from client state) or by saved id
    let design = body.design as CellDesign | undefined;
    let pack = body.pack as PackConfig | undefined;
    const params = body.params as SimParams | undefined;

    if (body.designId && !design) {
      const saved = await db.batteryDesign.findUnique({ where: { id: body.designId } });
      if (!saved) return NextResponse.json({ error: "Design not found" }, { status: 404 });
      design = {
        name: saved.name, chemistry: saved.chemistry as Chemistry,
        brand: saved.brand ?? "", model: saved.model ?? "", formFactor: saved.formFactor ?? "",
        cathode: saved.cathode ?? "", anode: saved.anode ?? "", separator: saved.separator ?? "",
        electrolyte: saved.electrolyte ?? "", application: saved.application ?? "", sourceRef: saved.sourceRef ?? "",
        capacityAh: saved.capacityAh, nominalV: saved.nominalV ?? 0, vmax: saved.vmax, vmin: saved.vmin,
        r0: saved.r0, r1: saved.r1, c1: saved.c1, r2: saved.r2, c2: saved.c2,
        maxDischargeC: saved.maxDischargeC, maxPulseDischargeC: saved.maxPulseDischargeC ?? saved.maxDischargeC,
        maxChargeC: saved.maxChargeC, stdChargeC: saved.stdChargeC ?? saved.maxChargeC * 0.5,
        diameterMm: saved.diameterMm ?? 0, lengthMm: saved.lengthMm ?? 0, widthMm: saved.widthMm ?? 0,
        heightMm: saved.heightMm ?? 0, thicknessMm: saved.thicknessMm ?? 0,
        massKg: saved.massKg, cpJkgK: saved.cpJkgK, areaM2: saved.areaM2,
        entropicVperK: saved.entropicVperK,
        cycleLifeCycles: saved.cycleLifeCycles ?? 0, cycleLifeNote: saved.cycleLifeNote ?? "",
        chargeTempMinC: saved.chargeTempMinC ?? 0, chargeTempMaxC: saved.chargeTempMaxC ?? 45,
        dischargeTempMinC: saved.dischargeTempMinC ?? -20, dischargeTempMaxC: saved.dischargeTempMaxC ?? 60,
        selfDischargePctMonth: saved.selfDischargePctMonth ?? 0,
      };
      pack = { series: saved.seriesCount, parallel: saved.parallelCount };
    }

    if (!design || !pack || !params) {
      return NextResponse.json({ error: "design, pack and params are required" }, { status: 400 });
    }

    // basic validation
    if (!design.capacityAh || design.capacityAh <= 0) return NextResponse.json({ error: "capacityAh must be > 0" }, { status: 400 });
    if (design.r0 <= 0) return NextResponse.json({ error: "r0 must be > 0" }, { status: 400 });
    if (!pack.series || pack.series < 1 || !pack.parallel || pack.parallel < 1) {
      return NextResponse.json({ error: "pack series/parallel must be >= 1" }, { status: 400 });
    }

    const result = simulate(design, pack, params);

    // persist run (best effort — sim still returns if persistence fails)
    let runId: string | undefined;
    try {
      let designId = body.designId as string | undefined;
      if (!designId) {
        // reuse an identical existing design instead of duplicating rows
        const existing = await db.batteryDesign.findFirst({
          where: {
            name: design.name,
            chemistry: design.chemistry,
            capacityAh: design.capacityAh,
            vmax: design.vmax,
            vmin: design.vmin,
            r0: design.r0,
            seriesCount: pack.series,
            parallelCount: pack.parallel,
          },
        });
        if (existing) {
          designId = existing.id;
        } else {
          // persist EVERY design field (was 14 — nominalV/dims/materials/temps were
          // lost, breaking downstream 3D renders and pack stats read back from runs)
          const st = (v: string | undefined) => (v && v.trim() ? v.trim().slice(0, 200) : null);
          const num = (v: number | undefined) => {
            const x = Number(v);
            return Number.isFinite(x) && x !== 0 ? x : null;
          };
          const auto = await db.batteryDesign.create({
            data: {
              name: design.name,
              chemistry: design.chemistry,
              brand: st(design.brand), model: st(design.model), formFactor: st(design.formFactor),
              cathode: st(design.cathode), anode: st(design.anode), separator: st(design.separator),
              electrolyte: st(design.electrolyte), application: st(design.application), sourceRef: st(design.sourceRef),
              capacityAh: design.capacityAh, vmax: design.vmax, vmin: design.vmin,
              nominalV: num(design.nominalV),
              r0: design.r0, r1: design.r1 ?? 0, c1: design.c1 ?? 0, r2: design.r2 ?? 0, c2: design.c2 ?? 0,
              maxDischargeC: design.maxDischargeC ?? 2, maxPulseDischargeC: num(design.maxPulseDischargeC),
              maxChargeC: design.maxChargeC ?? 1, stdChargeC: num(design.stdChargeC),
              diameterMm: num(design.diameterMm), lengthMm: num(design.lengthMm),
              widthMm: num(design.widthMm), heightMm: num(design.heightMm), thicknessMm: num(design.thicknessMm),
              massKg: design.massKg, cpJkgK: design.cpJkgK ?? 1000, areaM2: design.areaM2 ?? 0.04,
              entropicVperK: design.entropicVperK ?? 0.0001,
              cycleLifeCycles: num(design.cycleLifeCycles), cycleLifeNote: st(design.cycleLifeNote),
              chargeTempMinC: num(design.chargeTempMinC), chargeTempMaxC: num(design.chargeTempMaxC),
              dischargeTempMinC: num(design.dischargeTempMinC), dischargeTempMaxC: num(design.dischargeTempMaxC),
              selfDischargePctMonth: num(design.selfDischargePctMonth),
              seriesCount: pack.series, parallelCount: pack.parallel,
            },
          });
          designId = auto.id;
        }
      }
      const run = await db.testRun.create({
        data: {
          designId,
          name: body.runName || `${params.profile.toUpperCase()} @ ${params.cRate}C`,
          profile: params.profile,
          cRate: params.cRate,
          ambientC: params.ambientC,
          hConv: params.coolingOn ? params.hConv : 0,
          summary: JSON.stringify(result.summary),
          series: JSON.stringify(result.series),
        },
      });
      runId = run.id;
    } catch (e) {
      console.error("Run persistence failed (non-fatal)", e);
    }

    return NextResponse.json({ ...result, runId });
  } catch (e) {
    console.error("POST /api/simulate failed", e);
    return NextResponse.json({ error: "Simulation failed" }, { status: 500 });
  }
}
