"use client";

import { useId } from "react";
import type { CellDesign, SimPoint } from "@/lib/lab/engine";
import type { PackUIState } from "@/lib/lab/store";
import { PlaybackBar, fmtClock } from "./shared";
import { cn } from "@/lib/utils";

// Playback engine lives in src/lib/lab/use-playback.ts —
// the whole recorded test plays in ~40 s at 1× speed.
const PLAY_SECONDS = 40;
void PLAY_SECONDS;

function modeOf(cur: SimPoint | undefined): { label: string; cls: string; dot: string } {
  const i = cur?.iCell ?? 0;
  if (i > 0.05) return { label: "DISCHARGING", cls: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300", dot: "#d97706" };
  if (i < -0.05) return { label: "CHARGING", cls: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300", dot: "#059669" };
  return { label: "REST", cls: "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300", dot: "#64748b" };
}

export interface BenchProps {
  series: SimPoint[];
  cur: SimPoint;
  tick: number;
  playing: boolean;
  speed: number;
  syncCharts: boolean;
  design: CellDesign;
  pack: PackUIState;
  coolingOn: boolean;
  hConv: number;
  ambientC: number;
  onPlayPause: () => void;
  onRestart: () => void;
  onSpeed: (v: number) => void;
  onScrub: (v: number) => void;
  onSyncToggle: (v: boolean) => void;
}

export function SimBench(props: BenchProps) {
  const { series, cur, tick, playing, speed, syncCharts, design, pack, coolingOn, hConv, ambientC } = props;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const len = series.length;
  const frac = len > 1 ? tick / (len - 1) : 0;

  const soc = cur.soc / 100; // engine always reports percent (0–100)
  const T = cur.tempC;
  const I = cur.iCell;
  const V = cur.vCell;
  const mode = modeOf(cur);
  const socColor = soc > 0.5 ? "#10b981" : soc > 0.2 ? "#f59e0b" : "#ef4444";
  const tColor = T > 60 ? "#dc2626" : T > 45 ? "#d97706" : "#0f172a";
  const glow = Math.min(0.75, Math.max(0, (T - 30) / 70));

  // wire electron speed: faster with |I|; direction by sign
  const iRef = Math.max(0.25, Math.abs(design.capacityAh) || 1);
  const dur = Math.min(6, Math.max(0.45, 2.2 * (iRef / Math.max(0.15, Math.abs(I)))));
  const dirKey = I > 0.05 ? "dis" : I < -0.05 ? "chg" : "rest";
  const eOpacity = Math.abs(I) > 0.05 ? 1 : 0;

  // SOC liquid geometry (inside the cell body)
  const bodyY = 96, bodyH = 118, innerTop = 104, innerBot = 208;
  const liqH = Math.max(2, (innerBot - innerTop) * soc);
  const liqY = innerBot - liqH;

  // fan speed
  const fanDur = Math.min(3.2, Math.max(0.45, 3.2 - hConv / 70));

  const fanBlades = (
    <g>
      {[0, 90, 180, 270].map((a) => (
        <rect key={a} x={-2.5} y={-20} width={5} height={17} rx={2.5} fill="#64748b" transform={`rotate(${a})`} />
      ))}
    </g>
  );

  return (
    <div className="space-y-3">
      {/* controls — shared live clock across bench / scopes / monitor */}
      <PlaybackBar
        tick={tick}
        len={len}
        playing={playing}
        speed={speed}
        syncCharts={syncCharts}
        clock={<>{fmtClock(cur.t)} / {fmtClock(series[len - 1]?.t ?? 0)}</>}
        onPlayPause={props.onPlayPause}
        onRestart={props.onRestart}
        onSpeed={props.onSpeed}
        onScrub={props.onScrub}
        onSyncToggle={props.onSyncToggle}
      />

      {/* the bench */}
      <div className="overflow-x-auto rounded-lg border bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 p-2">
        <svg viewBox="0 0 960 312" className="min-w-[700px] w-full" role="img" aria-label="Animated battery test bench">
          <defs>
            <radialGradient id={`glow${uid}`}>
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.55" />
              <stop offset="55%" stopColor="#f97316" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`screen${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0b1220" />
              <stop offset="100%" stopColor="#101d33" />
            </linearGradient>
            <clipPath id={`cellClip${uid}`}>
              <rect x={439} y={innerTop} width={62} height={innerBot - innerTop} rx={7} />
            </clipPath>
            <marker id={`arr${uid}`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <polygon points="0 0, 7 3.5, 0 7" fill="#64748b" />
            </marker>
          </defs>

          {/* ambient note */}
          <text x={16} y={20} fontSize={10} fill="#64748b" className="fill-slate-500 dark:fill-slate-400">
            Ambient {ambientC}°C · forced convection {coolingOn ? `h = ${hConv} W/m²K` : "off"}
          </text>

          {/* heat glow behind the cell */}
          <ellipse cx={470} cy={155} rx={95} ry={110} fill={`url(#glow${uid})`} opacity={glow} />

          {/* ---- cycler machine ---- */}
          <g>
            <rect x={20} y={62} width={190} height={182} rx={10} fill="#1e293b" stroke="#0f172a" />
            <rect x={36} y={78} width={158} height={72} rx={5} fill={`url(#screen${uid})`} stroke="#334155" />
            <text x={48} y={100} fontSize={15} fontWeight={700} fill="#4ade80" fontFamily="ui-monospace, monospace">
              {V.toFixed(3)} V
            </text>
            <text x={48} y={122} fontSize={15} fontWeight={700} fill="#22d3ee" fontFamily="ui-monospace, monospace">
              {I >= 0 ? "" : "−"}
              {Math.abs(I).toFixed(2)} A
            </text>
            <text x={140} y={138} fontSize={9} fill="#64748b">
              {mode.label}
            </text>
            <circle cx={190} cy={90} r={3.5} fill="#10b981" className={playing ? "animate-pulse" : ""} />
            <circle cx={190} cy={102} r={3.5} fill={playing ? "#fbbf24" : "#475569"} />
            <text x={36} y={170} fontSize={10} fontWeight={700} fill="#94a3b8" letterSpacing={1}>
              BATTERYLAB CYCLER
            </text>
            <text x={36} y={184} fontSize={9} fill="#64748b">
              CH {String(1).padStart(2, "0")} · {pack.series}S{pack.parallel}P · {design.name || "cell"}
            </text>
            {/* knobs */}
            <circle cx={60} cy={214} r={11} fill="#334155" stroke="#475569" />
            <circle cx={94} cy={214} r={11} fill="#334155" stroke="#475569" />
            <rect x={130} y={204} width={64} height={20} rx={3} fill="#0f172a" />
            <text x={162} y={218} fontSize={9} fill="#4ade80" textAnchor="middle" fontFamily="ui-monospace, monospace">
              {fmtClock(cur.t)}
            </text>
          </g>

          {/* ---- wires with electron dots ---- */}
          {/* + wire */}
          <path id={`wp${uid}`} d="M 210 112 H 300 V 88 H 452" fill="none" stroke="#dc2626" strokeWidth={2.5} strokeLinecap="round" />
          {/* − wire */}
          <path id={`wn${uid}`} d="M 210 194 H 300 V 222 H 452" fill="none" stroke="#334155" strokeWidth={2.5} strokeLinecap="round" />
          <text x={244} y={104} fontSize={10} fontWeight={700} fill="#dc2626">+</text>
          <text x={244} y={190} fontSize={10} fontWeight={700} fill="#334155">−</text>
          {[0, 1, 2].map((k) => (
            <circle key={`ep${k}`} r={3.2} fill="#f59e0b" opacity={eOpacity}>
              <animateMotion dur={`${dur}s`} begin={`-${k * dur * 0.33}s`} repeatCount="indefinite" rotate="auto">
                <mpath href={`#wp${uid}`} />
              </animateMotion>
            </circle>
          ))}
          {[0, 1, 2].map((k) => (
            <circle key={`en${k}`} r={3.2} fill={dirKey === "chg" ? "#10b981" : "#f59e0b"} opacity={eOpacity}>
              <animateMotion
                key={dirKey}
                dur={`${dur}s`}
                begin={`-${(0.5 + k * 0.33) * dur}s`}
                repeatCount="indefinite"
                rotate="auto"
              >
                <mpath href={`#wn${uid}`} />
              </animateMotion>
            </circle>
          ))}
          {/* current direction arrow label */}
          <g opacity={eOpacity}>
            <line x1={330} y1={70} x2={370} y2={70} stroke={mode.dot} strokeWidth={2} markerEnd={`url(#arr${uid})`} />
            <text x={350} y={62} fontSize={9} fontWeight={700} fill={mode.dot} textAnchor="middle">
              {dirKey === "chg" ? "charge" : dirKey === "dis" ? "discharge" : "no current"}
            </text>
          </g>

          {/* ---- cell fixture ---- */}
          <g>
            <rect x={420} y={222} width={100} height={16} rx={4} fill="#94a3b8" opacity={0.35} />
            <text x={470} y={252} fontSize={10} fontWeight={600} fill="#475569" className="fill-slate-500 dark:fill-slate-400" textAnchor="middle">
              test fixture
            </text>
            {/* body */}
            <rect x={435} y={96} width={70} height={bodyH} rx={10} fill="#e2e8f0" className="fill-slate-200 dark:fill-slate-700" stroke="#94a3b8" strokeWidth={1.5} />
            {/* + terminal nub */}
            <rect x={458} y={88} width={24} height={9} rx={2} fill="#c0c4cc" stroke="#94a3b8" />
            {/* steel top band */}
            <rect x={437} y={98} width={66} height={16} rx={6} fill="#b9bec8" />
            {/* SOC liquid */}
            <g clipPath={`url(#cellClip${uid})`}>
              <rect x={439} y={liqY} width={62} height={liqH} fill={socColor} opacity={0.85} style={{ transition: "y .25s linear, height .25s linear" }} />
              {/* liquid surface line */}
              <rect x={439} y={liqY} width={62} height={2} fill="#ffffff" opacity={0.5} style={{ transition: "y .25s linear" }} />
            </g>
            {/* SOC text */}
            <text x={470} y={162} fontSize={17} fontWeight={800} fill="#ffffff" textAnchor="middle" stroke="#0f172a" strokeWidth={0.5} paintOrder="stroke">
              {(soc * 100).toFixed(0)}%
            </text>
          </g>

          {/* ---- cooling fan ---- */}
          {coolingOn && (
            <g>
              <circle cx={575} cy={155} r={27} fill="#f8fafc" className="fill-slate-50 dark:fill-slate-800" stroke="#94a3b8" strokeWidth={2} />
              <g transform="translate(575 155)">
                <g>
                  {fanBlades}
                  <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur={`${fanDur}s`} repeatCount="indefinite" />
                </g>
                <circle r={4.5} fill="#334155" />
              </g>
              <text x={575} y={196} fontSize={9} fill="#64748b" className="fill-slate-500 dark:fill-slate-400" textAnchor="middle">
                {hConv >= 150 ? "liquid plate" : hConv >= 30 ? "fan" : "natural"} · h={hConv}
              </text>
              {/* airflow */}
              {[0, 1, 2].map((k) => (
                <path
                  key={k}
                  d={`M 548 ${138 + k * 17} H 512`}
                  stroke="#38bdf8"
                  strokeWidth={2}
                  strokeDasharray="6 8"
                  opacity={0.7}
                  fill="none"
                >
                  <animate attributeName="stroke-dashoffset" from="14" to="0" dur="0.6s" repeatCount="indefinite" />
                </path>
              ))}
            </g>
          )}

          {/* ---- mode pill ---- */}
          <g>
            <rect x={430} y={44} width={80} height={22} rx={11} className={cn(mode.cls, "fill-card")} stroke={mode.dot} opacity={0.95} />
            <circle cx={444} cy={55} r={3.5} fill={mode.dot} className={playing ? "animate-pulse" : ""} />
            <text x={476} y={59} fontSize={9} fontWeight={800} fill={mode.dot} textAnchor="middle">
              {mode.label}
            </text>
          </g>

          {/* ---- gauges ---- */}
          {[
            {
              x: 640, y: 56, label: "CELL VOLTAGE", value: `${V.toFixed(3)} V`, sub: `pack ${(V * pack.series).toFixed(1)} V`,
              bar: Math.max(0, Math.min(1, (V - design.vmin * 0.97) / Math.max(0.01, design.vmax * 1.03 - design.vmin * 0.97))), color: "#1e5a96",
            },
            {
              x: 806, y: 56, label: "CURRENT / CELL", value: `${I >= 0 ? "" : "−"}${Math.abs(I).toFixed(2)} A`, sub: `pack ${(Math.abs(I) * pack.parallel).toFixed(1)} A`,
              bar: Math.min(1, Math.abs(I) / Math.max(0.5, Math.abs(design.capacityAh) * 10)), color: mode.dot,
            },
            {
              x: 640, y: 172, label: "STATE OF CHARGE", value: `${(soc * 100).toFixed(1)} %`, sub: `P = ${(V * I).toFixed(1)} W`,
              bar: soc, color: socColor,
            },
            {
              x: 806, y: 172, label: "CELL TEMPERATURE", value: `${T.toFixed(1)} °C`, sub: T > 60 ? "over limit" : T > 45 ? "hot" : "in band",
              bar: Math.max(0, Math.min(1, (T - 20) / 90)), color: tColor === "#0f172a" ? "#0e7490" : tColor,
            },
          ].map((g) => (
            <g key={g.label}>
              <rect x={g.x} y={g.y} width={150} height={96} rx={9} fill="#ffffff" className="fill-card stroke-border" stroke="#e2e8f0" />
              <rect x={g.x} y={g.y} width={150} height={3} rx={1.5} fill={g.color} opacity={0.85} />
              <text x={g.x + 12} y={g.y + 24} fontSize={8.5} fill="#64748b" className="fill-slate-500 dark:fill-slate-400" letterSpacing={0.8} fontWeight={700}>
                {g.label}
              </text>
              <text x={g.x + 12} y={g.y + 50} fontSize={21} fontWeight={800} fill="#0f172a" className="fill-foreground" fontFamily="ui-monospace, monospace">
                {g.value}
              </text>
              <text x={g.x + 12} y={g.y + 66} fontSize={9} fill="#94a3b8" className="fill-slate-400 dark:fill-slate-500">
                {g.sub}
              </text>
              <rect x={g.x + 12} y={g.y + 76} width={126} height={6} rx={3} fill="#e2e8f0" className="fill-slate-200 dark:fill-slate-700" />
              <rect
                x={g.x + 12}
                y={g.y + 76}
                width={Math.max(2, 126 * g.bar)}
                height={6}
                rx={3}
                fill={g.color}
                style={{ transition: "width .25s linear" }}
              />
            </g>
          ))}

          {/* ---- progress ---- */}
          <rect x={640} y={286} width={316} height={7} rx={3.5} fill="#e2e8f0" className="fill-slate-200 dark:fill-slate-700" />
          <rect x={640} y={286} width={Math.max(2, 316 * frac)} height={7} rx={3.5} fill="#1e5a96" style={{ transition: "width .2s linear" }} />
          <text x={958} y={292} fontSize={9} fill="#94a3b8" className="fill-slate-400 dark:fill-slate-500" textAnchor="end">
            {(frac * 100).toFixed(0)}%
          </text>
          <text x={640} y={280} fontSize={9} fill="#64748b" className="fill-slate-500 dark:fill-slate-400">
            test progress — {fmtClock(cur.t)} elapsed
          </text>
        </svg>
      </div>
    </div>
  );
}
