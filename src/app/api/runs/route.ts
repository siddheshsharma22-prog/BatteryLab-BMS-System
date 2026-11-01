import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const designId = req.nextUrl.searchParams.get("designId") || undefined;
    const runs = await db.testRun.findMany({
      where: designId ? { designId } : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { design: true }, // full design row — Analysis renders the 3D final pack from it
    });
    return NextResponse.json({ runs });
  } catch (e) {
    console.error("GET /api/runs failed", e);
    return NextResponse.json({ error: "Failed to load runs" }, { status: 500 });
  }
}
