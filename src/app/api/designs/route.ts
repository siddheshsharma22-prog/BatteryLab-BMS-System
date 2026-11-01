import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const designs = await db.batteryDesign.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { runs: true } } },
    });
    return NextResponse.json({ designs });
  } catch (e) {
    console.error("GET /api/designs failed", e);
    return NextResponse.json({ error: "Failed to load designs" }, { status: 500 });
  }
}

const optN = (v: unknown, dflt?: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
};
const optS = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const required = ["name", "chemistry", "capacityAh", "vmax", "vmin", "r0", "massKg"];
    for (const k of required) {
      if (body[k] === undefined || body[k] === null || body[k] === "") {
        return NextResponse.json({ error: `Missing field: ${k}` }, { status: 400 });
      }
    }
    const design = await db.batteryDesign.create({
      data: {
        name: String(body.name).slice(0, 80),
        chemistry: String(body.chemistry),
        brand: optS(body.brand),
        model: optS(body.model),
        formFactor: optS(body.formFactor),
        cathode: optS(body.cathode),
        anode: optS(body.anode),
        separator: optS(body.separator),
        electrolyte: optS(body.electrolyte),
        application: optS(body.application),
        sourceRef: optS(body.sourceRef),
        capacityAh: Number(body.capacityAh),
        nominalV: optN(body.nominalV),
        vmax: Number(body.vmax),
        vmin: Number(body.vmin),
        r0: Number(body.r0),
        r1: Number(body.r1 ?? 0),
        c1: Number(body.c1 ?? 0),
        r2: Number(body.r2 ?? 0),
        c2: Number(body.c2 ?? 0),
        maxDischargeC: Number(body.maxDischargeC ?? 2),
        maxPulseDischargeC: optN(body.maxPulseDischargeC),
        maxChargeC: Number(body.maxChargeC ?? 1),
        stdChargeC: optN(body.stdChargeC),
        diameterMm: optN(body.diameterMm),
        lengthMm: optN(body.lengthMm),
        widthMm: optN(body.widthMm),
        heightMm: optN(body.heightMm),
        thicknessMm: optN(body.thicknessMm),
        massKg: Number(body.massKg),
        cpJkgK: Number(body.cpJkgK ?? 1000),
        areaM2: Number(body.areaM2 ?? 0.04),
        entropicVperK: Number(body.entropicVperK ?? 0.0001),
        cycleLifeCycles: optN(body.cycleLifeCycles),
        cycleLifeNote: optS(body.cycleLifeNote),
        chargeTempMinC: optN(body.chargeTempMinC),
        chargeTempMaxC: optN(body.chargeTempMaxC),
        dischargeTempMinC: optN(body.dischargeTempMinC),
        dischargeTempMaxC: optN(body.dischargeTempMaxC),
        selfDischargePctMonth: optN(body.selfDischargePctMonth),
        seriesCount: Math.max(1, Math.round(Number(body.series ?? body.seriesCount ?? 1))),
        parallelCount: Math.max(1, Math.round(Number(body.parallel ?? body.parallelCount ?? 1))),
      },
    });
    return NextResponse.json({ design }, { status: 201 });
  } catch (e) {
    console.error("POST /api/designs failed", e);
    return NextResponse.json({ error: "Failed to save design" }, { status: 500 });
  }
}
