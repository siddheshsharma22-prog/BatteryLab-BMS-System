"use client";

import { useMemo } from "react";
import { Wind } from "lucide-react";
import type { CellDesign, SimPoint } from "@/lib/lab/engine";
import { cellTemps, cellVoltages, tempColor, MAX_RENDERED_CELLS } from "@/lib/lab/pack";

// ============================================================
// PackThermalMap — live thermal map of the FULL pack:
// every cell in the S×P matrix, coloured by its temperature as
// the test replays. Cells pick up a physically-motivated spread
// (airflow gradient downstream, cooler perimeter, contact noise)
// around the lumped mean temperature from the engine.
// ============================================================

export function PackThermalMap({
  design,
  series,
  parallel,
  cur,
  ambientC,
  hConv,
  coolingOn,
}: {
  design: CellDesign;
  series: number;
  parallel: number;
  cur: SimPoint;
  ambientC: number;
  hConv: number;
  coolingOn: boolean;
}) {
  const total = series * parallel;
  const shown = Math.min(total, MAX_RENDERED_CELLS);
  // wrap long series strings into banks (max 14 columns each)
  const groupCols = Math.min(series, 14);
  const banks = Math.ceil(series / groupCols);
  const shownS = Math.min(series, Math.ceil(shown / parallel));

  const temps = useMemo(
    () => cellTemps(cur.tempC, ambientC, shown, { hConv: coolingOn ? hConv : 0, cols: groupCols, rows: Math.ceil(shownS / groupCols) * parallel }),
    [cur.tempC, ambientC, shown, hConv, coolingOn, groupCols, shownS, parallel]
  );
  const volts = useMemo(
    () => cellVoltages(cur.vCell, shown, cur.soc / 100, cur.iCell, design.capacityAh),
    [cur.vCell, shown, cur.soc, cur.iCell, design.capacityAh]
  );

  const hottest = temps.reduce((m, t, i) => (t > temps[m] ? i : m), 0);
  const coldest = temps.reduce((m, t, i) => (t < temps[m] ? i : m), 0);
  const spread = temps.length ? temps[hottest] - temps[coldest] : 0;
  const packHeat = cur.qGen * series * parallel;

  const CW = 21, CH = 30, GAP = 3.5, BANK_GAP = 14;
  const bankW = groupCols * (CW + GAP) - GAP;
  const gridH = parallel * (CH + GAP) - GAP;
  const W = banks * bankW + (banks - 1) * BANK_GAP + 34; // + left labels
  const cellTop = coolingOn ? 34 : 24;
  // Widen/tall-enough canvas: small packs (1S1P…) must not upscale text into
  // overlapping glyphs, and the scale bar must never touch the last cell row
  // (cells shift down 10px when the airflow lane is shown — H must follow).
  const VW = Math.max(W, 240);
  const VH = Math.max(cellTop + gridH + 36, 84);
  const ox = (VW - W) / 2;

  let cellIdx = 0;
  const soc = cur.soc / 100;

  return (
    <div className="space-y-3">
      {/* live stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 stagger">
        <div className="rounded-lg border bg-card p-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Pack mean</div>
          <div className="text-base font-bold tabular-nums">{cur.tempC.toFixed(1)} °C</div>
        </div>
        <div className="rounded-lg border bg-card p-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Hottest cell</div>
          <div className="text-base font-bold tabular-nums text-red-600">
            S{Math.floor(hottest / parallel) + 1}P{(hottest % parallel) + 1}
            <span className="ml-1 font-semibold">{temps[hottest]?.toFixed(1)}°</span>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Coldest cell</div>
          <div className="text-base font-bold tabular-nums text-cyan-700">
            S{Math.floor(coldest / parallel) + 1}P{(coldest % parallel) + 1}
            <span className="ml-1 font-semibold">{temps[coldest]?.toFixed(1)}°</span>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">ΔT spread</div>
          <div className="text-base font-bold tabular-nums">{spread.toFixed(1)} K</div>
        </div>
        <div className="rounded-lg border bg-card p-2 col-span-2 sm:col-span-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Pack heat rate</div>
          <div className="text-base font-bold tabular-nums">{packHeat.toFixed(1)} W</div>
        </div>
      </div>

      {/* the map */}
      <div className="overflow-x-auto rounded-lg border bg-gradient-to-b from-slate-50 to-slate-100 p-2 dark:from-slate-900 dark:to-slate-950">
        <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full min-w-[420px]" role="img" aria-label="Live thermal map of the battery pack">
          {/* airflow lane — full viewBox width, text and line never cross */}
          {coolingOn && hConv > 0 && (
            <g>
              <text x={34} y={14} fontSize={9.5} fill="#0e7490" fontWeight={700}>
                airflow · h = {hConv} W/m²K
              </text>
              <line x1={158} y1={10} x2={VW - 12} y2={10} stroke="#0e7490" strokeWidth={1.6} strokeDasharray="7 5" markerEnd="url(#airArrow)" />
              {Array.from({ length: 3 }, (_, k) => (
                <circle key={k} r={2.4} fill="#0e7490" opacity={0.85}>
                  <animateMotion dur={`${Math.max(0.9, 2.6 - hConv / 90)}s`} begin={`-${k * 0.55}s`} repeatCount="indefinite" path={`M 158 10 H ${VW - 14}`} />
                </circle>
              ))}
            </g>
          )}

          <defs>
            <marker id="airArrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <polygon points="0 0, 7 3.5, 0 7" fill="#0e7490" />
            </marker>
          </defs>

          {/* banks × columns × rows — translated so packs narrower than the
              canvas stay centred instead of upscaled into overlap */}
          <g transform={`translate(${ox},0)`}>
          {Array.from({ length: banks }, (_, bank) => {
            const colsThisBank = Math.min(groupCols, shownS - bank * groupCols);
            const bankX = 34 + bank * (bankW + BANK_GAP);
            return (
              <g key={bank}>
                {Array.from({ length: colsThisBank }, (_, col) => {
                  const gi = bank * groupCols + col; // series group index
                  const x = bankX + col * (CW + GAP);
                  return (
                    <g key={col}>
                      <text x={x + CW / 2} y={cellTop - 4} fontSize={8.5} textAnchor="middle" fill="#64748b" fontWeight={700}>
                        S{gi + 1}
                      </text>
                      {Array.from({ length: parallel }, (_, pi) => {
                        const i = gi * parallel + pi;
                        if (i >= shown) return null;
                        const y = cellTop + pi * (CH + GAP);
                        const t = temps[i];
                        const isHot = i === hottest;
                        const isCold = i === coldest;
                        return (
                          <g key={pi}>
                            <rect
                              x={x}
                              y={y}
                              width={CW}
                              height={CH}
                              rx={4.5}
                              fill={tempColor(t, ambientC)}
                              stroke={isHot ? "#dc2626" : isCold ? "#0e7490" : "rgba(15,23,42,0.18)"}
                              strokeWidth={isHot || isCold ? 2 : 1}
                              style={{ transition: "fill .3s linear" }}
                            >
                              <title>{`S${gi + 1}P${pi + 1} · ${t.toFixed(2)} °C · ${volts[i]?.toFixed(3)} V · SOC ${(soc * 100).toFixed(0)}%`}</title>
                            </rect>
                            {parallel <= 6 && (
                              <text x={x + CW / 2} y={y + CH - 4} fontSize={7.5} textAnchor="middle" fill="rgba(255,255,255,0.92)" fontWeight={600}>
                                {t.toFixed(1)}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* parallel labels on the left */}
          {parallel > 1 && Array.from({ length: Math.min(parallel, 8) }, (_, pi) => (
            <text key={pi} x={4} y={cellTop + pi * (CH + GAP) + CH / 2 + 3} fontSize={8.5} fill="#64748b" fontWeight={700}>
              P{pi + 1}
            </text>
          ))}
          </g>

          {/* temperature scale — full viewBox width, pinned below the cells */}
          {(() => {
            const sx = 34, sy = VH - 12, sw = Math.min(220, VW - 48);
            const stops = [ambientC, 35, 45, 60, 85, 130];
            return (
              <g>
                {Array.from({ length: 40 }, (_, k) => (
                  <rect key={k} x={sx + (k * sw) / 40} y={sy - 7} width={sw / 40 + 0.5} height={7} fill={tempColor(stops[0] + ((stops[stops.length - 1] - stops[0]) * k) / 39, ambientC)} />
                ))}
                <text x={sx} y={sy + 9} fontSize={8.5} fill="#64748b">{stops[0].toFixed(0)}°C</text>
                <text x={sx + sw} y={sy + 9} fontSize={8.5} fill="#64748b" textAnchor="end">130°C</text>
              </g>
            );
          })()}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Wind className="h-3 w-3 text-cyan-700" /> airflow gradient: downstream cells run hotter</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-cyan-700" /> coldest</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-red-600" /> hottest</span>
        <span className="ml-auto">{shown < total ? `showing first ${shown} of ${total} cells` : `${total} cells · follows playback`}</span>
      </div>
    </div>
  );
}
