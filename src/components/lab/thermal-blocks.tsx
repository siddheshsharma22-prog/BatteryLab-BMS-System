"use client";

import { useId, useMemo } from "react";
import type { CellDesign, SimPoint } from "@/lib/lab/engine";
import { estimateAreaM2 } from "@/lib/lab/engine";
import { Badge } from "@/components/ui/badge";

// ------------------------------------------------------------
// Simulink-style thermal model:
//   m·Cp·dT/dt = Q(I) − hA·(T − T_amb)
// Blocks + animated signal wires + live scope. Values react live
// to the cooling sliders; when a real run exists, the scope plays
// back the measured curve instead of the analytic preview.
// ------------------------------------------------------------

const INK = "#334155";
const WIRE = "#475569";
const SIGNAL = "#0e7490";

function Block({
  x, y, w, h, title, lines, tone = "#ffffff",
}: {
  x: number; y: number; w: number; h: number;
  title: string; lines?: string[]; tone?: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={3} fill={tone} stroke={INK} strokeWidth={1.6} />
      <text x={x + w / 2} y={y + (lines && lines.length ? 20 : h / 2 + 4)} textAnchor="middle" fontSize={12} fontWeight={700} fill="#0f172a">
        {title}
      </text>
      {lines?.map((l, i) => (
        <text key={i} x={x + w / 2} y={y + 36 + i * 13} textAnchor="middle" fontSize={9.5} fill="#64748b">
          {l}
        </text>
      ))}
    </g>
  );
}

function Sum({ cx, cy, plus, minus }: { cx: number; cy: number; plus: "left" | "bottom"; minus: "top" | "bottom" }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={17} fill="#fff" stroke={INK} strokeWidth={1.6} />
      <text x={cx + (plus === "left" ? -8 : 0)} y={cy + (plus === "bottom" ? 13 : 4)} textAnchor="middle" fontSize={13} fontWeight={700} fill="#0f172a">+</text>
      <text x={cx} y={cy + (minus === "top" ? -6 : 15)} textAnchor="middle" fontSize={14} fontWeight={700} fill="#b91c1c">−</text>
    </g>
  );
}

function Wire({ d, uid, dots = 0, dur = 2.2, label, lx, ly, arrow = false }: {
  d: string; uid: string; dots?: number; dur?: number; label?: string; lx?: number; ly?: number; arrow?: boolean;
}) {
  return (
    <g>
      <path id={`w${uid}`} d={d} fill="none" stroke={WIRE} strokeWidth={1.6} markerEnd={arrow ? "url(#thArrow)" : undefined} />
      {dots > 0 &&
        Array.from({ length: dots }).map((_, k) => (
          <circle key={k} r={3} fill={SIGNAL}>
            <animateMotion dur={`${dur}s`} begin={`-${(k / dots) * dur}s`} repeatCount="indefinite">
              <mpath href={`#w${uid}`} />
            </animateMotion>
          </circle>
        ))}
      {label && (
        <text x={lx} y={ly} fontSize={9.5} fontWeight={700} fill="#0f766e" textAnchor="middle">
          {label}
        </text>
      )}
    </g>
  );
}

export function ThermalBlocks({
  design,
  ambientC,
  hConv,
  coolingOn,
  cRate,
  series,
}: {
  design: CellDesign;
  ambientC: number;
  hConv: number;
  coolingOn: boolean;
  cRate: number;
  series: SimPoint[];
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  const h = coolingOn ? hConv : 0;
  const A = Math.max(0.005, estimateAreaM2(design));
  const m = Math.max(0.001, design.massKg);
  const cp = Math.max(200, design.cpJkgK);
  const I = Math.max(0, cRate * design.capacityAh);
  const Reff = Math.max(0.0001, design.r0 + design.r1 + design.r2);
  const Q = I * I * Reff; // Joule-dominated preview (W)
  const Cth = m * cp; // J/K
  const tau = h > 0 ? Cth / (h * A) : Infinity;
  const hA = h * A;

  // trace: real run data if available, else analytic first-order response
  const { trace, driven } = useMemo(() => {
    if (series.length > 20) {
      const step = Math.max(1, Math.floor(series.length / 160));
      return {
        trace: series.filter((_, i) => i % step === 0).map((p) => ({ t: p.t, T: p.tempC })),
        driven: true,
      };
    }
    const pts: { t: number; T: number }[] = [];
    const TMAX = 130;
    for (let k = 0; k <= 140; k++) {
      const t = (k / 140) * 7200;
      let T: number;
      if (h > 0) T = ambientC + (Q / hA) * (1 - Math.exp(-t / tau));
      else T = ambientC + (Q / Cth) * t;
      if (T >= TMAX) {
        pts.push({ t, T: TMAX });
        break;
      }
      pts.push({ t, T });
    }
    return { trace: pts, driven: false };
  }, [series, h, Q, hA, tau, Cth, ambientC]);

  const tEnd = trace[trace.length - 1]?.T ?? ambientC;
  const tMax = trace.reduce((a, p) => Math.max(a, p.T), 0);
  const convNow = hA * Math.max(0, tEnd - ambientC);
  const runaway = tMax >= 129.5;

  // scope geometry
  const sx = 700, sy = 44, sw = 210, sh = 148;
  const tSpan = Math.max(1, trace[trace.length - 1]?.t ?? 1);
  const lo = Math.min(...trace.map((p) => p.T), ambientC) - 3;
  const hi = Math.max(...trace.map((p) => p.T), ambientC + 5) + 3;
  const px = (t: number) => sx + 10 + (t / tSpan) * (sw - 22);
  const py = (T: number) => sy + sh - 12 - ((T - lo) / Math.max(1, hi - lo)) * (sh - 26);
  const traceStr = trace.map((p) => `${px(p.t).toFixed(1)},${py(p.T).toFixed(1)}`).join(" ");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-[11px] font-semibold border-[#1e5a96] text-[#1e5a96]">
          m·Cp·dT/dt = Q − hA·(T − T_amb)
        </Badge>
        {driven ? (
          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px]">Scope: last run data</Badge>
        ) : (
          <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-[11px] whitespace-normal text-left">Live analytic preview</Badge>
        )}
        {runaway && <Badge className="bg-red-50 text-red-700 border border-red-200 text-[11px] font-bold">Runaway onset reached</Badge>}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-[#f8fafc] p-2">
        <svg viewBox="0 0 940 372" className="min-w-[720px] w-full" role="img" aria-label="Simulink-style thermal block diagram">
          <defs>
            <pattern id={`grid${uid}`} width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.8" fill="#dbe3ec" />
            </pattern>
            <marker id="thArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <polygon points="0 0, 8 4, 0 8" fill={WIRE} />
            </marker>
          </defs>
          <rect x="0" y="0" width="940" height="372" fill={`url(#grid${uid})`} />

          {/* ---- wires ---- */}
          {/* I → Q */}
          <Wire uid={`a${uid}`} d="M 100 90 H 146" arrow />
          {/* Q → sum1(+) */}
          <Wire uid={`b${uid}`} d="M 300 90 H 350" dots={3} dur={1.8} label={`Q̇ = ${Q.toFixed(2)} W`} lx={325} ly={78} arrow />
          {/* sum1 → integrator */}
          <Wire uid={`c${uid}`} d="M 387 90 H 437" dots={2} dur={1.2} arrow />
          {/* integrator → T node → scope */}
          <Wire uid={`d${uid}`} d="M 577 90 H 697" dots={4} dur={2.4} label="T_cell" lx={635} ly={78} arrow />
          {/* T branch → down → feedback to sum2(+) at y=352 */}
          <Wire uid={`e${uid}`} d="M 660 90 V 352 H 330 V 284" dots={3} dur={2.6} label="T − T_amb" lx={430} ly={344} />
          {/* T_amb → sum2(−) */}
          <Wire uid={`f${uid}`} d="M 260 262 H 330 V 247" dots={2} dur={1.6} arrow />
          <text x={295} y={254} fontSize={9.5} fontWeight={700} fill="#0f766e" textAnchor="middle">
            {ambientC} °C
          </text>
          {/* sum2 → gain */}
          <Wire uid={`g${uid}`} d="M 347 262 H 397" dots={2} dur={1} arrow />
          {/* gain → sum1(−): right, down to 330, left to 370, up to 108 */}
          <Wire uid={`h${uid}`} d="M 577 262 H 600 V 330 H 370 V 111" dots={3} dur={2.4} label={`h·A·ΔT = ${convNow.toFixed(2)} W`} lx={480} ly={322} arrow />
          {/* branch dot at (660,262) → display */}
          <Wire uid={`i${uid}`} d="M 660 262 H 697" dots={2} dur={0.9} arrow />
          {/* junction dots */}
          <circle cx={660} cy={90} r={3.2} fill={WIRE} />
          <circle cx={660} cy={262} r={3.2} fill={WIRE} />

          {/* ---- blocks ---- */}
          <Block x={30} y={70} w={70} h={40} title="I" lines={["cycler"]} tone="#eef2f7" />
          <Block x={150} y={58} w={150} h={64} title="Q̇ Bernardi" lines={["I²·R₀ + I·T·dU/dT"]} tone="#fff7ed" />
          <Sum cx={370} cy={90} plus="left" minus="bottom" />
          <Block x={437} y={58} w={140} h={64} title="1 / (m·Cp)" lines={[`∫ dt  →  T_cell`, `Cth = ${(Cth / 1000).toFixed(2)} kJ/K`]} tone="#eff6ff" />
          <Block x={150} y={240} w={110} h={44} title="T_amb" tone="#f1f5f9" />
          <Sum cx={330} cy={262} plus="bottom" minus="top" />
          <Block x={397} y={240} w={180} h={44} title="h·A  (convection)" tone="#ecfeff" />
          {/* Display block */}
          <g>
            <rect x={697} y={240} width={120} height={44} rx={3} fill="#0f172a" stroke={INK} strokeWidth={1.6} />
            <text x={757} y={268} textAnchor="middle" fontSize={17} fontWeight={800} fill="#4ade80" fontFamily="ui-monospace, monospace">
              {tEnd.toFixed(1)} °C
            </text>
            <text x={697} y={300} fontSize={9} fill="#64748b">Display — end temperature</text>
          </g>

          {/* signal annotations */}
          <text x={116} y={80} fontSize={9.5} fontWeight={700} fill="#0f766e" textAnchor="middle">
            {I.toFixed(2)} A
          </text>
          <text x={507} y={136} fontSize={9} fill="#64748b" textAnchor="middle">
            τ = m·Cp / h·A = {h > 0 && Number.isFinite(tau) ? `${Math.round(tau)} s` : "∞ (adiabatic)"}
          </text>

          {/* ---- scope ---- */}
          <g>
            <rect x={697} y={30} width={216} height={162} rx={4} fill="#334155" />
            <rect x={sx} y={sy} width={sw} height={sh} rx={2} fill="#0b1220" />
            {/* grid */}
            {[1, 2, 3].map((k) => (
              <line key={`v${k}`} x1={sx + (k * (sw - 22)) / 4 + 10} y1={sy + 6} x2={sx + (k * (sw - 22)) / 4 + 10} y2={sy + sh - 8} stroke="#1e293b" strokeWidth={1} />
            ))}
            {[1, 2].map((k) => (
              <line key={`hz${k}`} x1={sx + 10} y1={sy + 12 + (k * (sh - 26)) / 3} x2={sx + sw - 12} y2={sy + 12 + (k * (sh - 26)) / 3} stroke="#1e293b" strokeWidth={1} />
            ))}
            {/* limit lines */}
            {[
              { T: 45, c: "#eab308", l: "45" },
              { T: 60, c: "#f87171", l: "60" },
            ].map((r) =>
              r.T > lo && r.T < hi ? (
                <line key={r.l} x1={sx + 10} y1={py(r.T)} x2={sx + sw - 12} y2={py(r.T)} stroke={r.c} strokeWidth={1} strokeDasharray="4 4" opacity={0.8} />
              ) : null
            )}
            {/* trace */}
            <polyline points={traceStr} fill="none" stroke="#4ade80" strokeWidth={2} strokeLinejoin="round" />
            {/* live end dot */}
            <circle cx={px(trace[trace.length - 1]?.t ?? 0)} cy={py(tEnd)} r={3.5} fill="#4ade80">
              <animate attributeName="opacity" values="1;0.25;1" dur="1.2s" repeatCount="indefinite" />
            </circle>
            {/* labels */}
            <text x={sx + 12} y={sy + 16} fontSize={9} fill="#94a3b8" fontWeight={700}>
              T_cell [°C]
            </text>
            <text x={sx + 12} y={sy + sh - 16} fontSize={8} fill="#64748b">
              {lo.toFixed(0)}
            </text>
            <text x={sx + 12} y={sy + 26} fontSize={8} fill="#64748b">
              {hi.toFixed(0)}
            </text>
            <text x={sx + sw - 12} y={sy + sh - 4} fontSize={8} fill="#64748b" textAnchor="end">
              t [s] → 0–{Math.round(tSpan)}
            </text>
            <text x={805} y={22} fontSize={9.5} fontWeight={700} fill="#334155">
              Scope — cell temperature
            </text>
          </g>
        </svg>
      </div>

      {/* legend row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        <div className="rounded-lg bg-muted/60 p-2">
          <div className="text-[10px] uppercase text-muted-foreground">Heat Q̇ (Joule ≈)</div>
          <div className="font-bold text-sm tabular-nums">{Q.toFixed(2)} W</div>
        </div>
        <div className="rounded-lg bg-muted/60 p-2">
          <div className="text-[10px] uppercase text-muted-foreground">Thermal mass m·Cp</div>
          <div className="font-bold text-sm tabular-nums">{(Cth / 1000).toFixed(2)} kJ/K</div>
        </div>
        <div className="rounded-lg bg-muted/60 p-2">
          <div className="text-[10px] uppercase text-muted-foreground">Convection h·A</div>
          <div className="font-bold text-sm tabular-nums">{hA.toFixed(3)} W/K</div>
        </div>
        <div className="rounded-lg bg-muted/60 p-2">
          <div className="text-[10px] uppercase text-muted-foreground">Steady-state ΔT</div>
          <div className="font-bold text-sm tabular-nums">
            {h > 0 ? `+${(Q / hA).toFixed(1)} K` : `${((Q / Cth) * 3600).toFixed(1)} K/h`}
          </div>
        </div>
      </div>
    </div>
  );
}
