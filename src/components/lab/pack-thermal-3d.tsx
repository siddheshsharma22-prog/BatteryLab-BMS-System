"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Edges } from "@react-three/drei";
import * as THREE from "three";
import type { CellDesign } from "@/lib/lab/engine";
import { MAX_RENDERED_CELLS, hash01, tempColor, cellTemps } from "@/lib/lab/pack";
import { Button } from "@/components/ui/button";
import { layoutOf, WORLD_H } from "./pack-3d";
import { cn } from "@/lib/utils";

// ============================================================
// PackThermal3D — the full pack rendered as a live 3D thermal
// simulation: every cell is coloured by its modelled temperature
// (Bernardi lumped mean + airflow-gradient per-cell field), glows
// as it heats up, sheds heat-shimmer above ~48 °C, and the chosen
// cooling strategy is drawn as an animated airflow across the pack.
// Everything is driven by the shared playback clock (tMean).
// ============================================================

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** per-cell temperatures: per-group airflow/edge field from cellTemps + contact noise */
function useThermalField(tMean: number, ambient: number, hConv: number, s: number, p: number) {
  return useMemo(() => {
    const rendered = Math.min(s * p, MAX_RENDERED_CELLS);
    const groups = Math.ceil(rendered / p);
    // same row/col geometry as layoutOf(): groups fill row by row along Z (airflow axis)
    const rows = Math.max(1, Math.ceil(s / 10));
    const perRow = Math.ceil(s / rows);
    const base = cellTemps(tMean, ambient, groups, { hConv, cols: perRow, rows });
    const out: number[] = [];
    for (let i = 0; i < rendered; i++) {
      const gi = Math.floor(i / p);
      const noise = (hash01(i * 5 + 3) - 0.5) * 0.5;
      out.push(base[gi] + noise);
    }
    return out;
  }, [tMean, ambient, hConv, s, p]);
}

function ThermalCell({
  design,
  x,
  z,
  R,
  isPouch,
  temp,
  ambient,
}: {
  design: CellDesign;
  x: number;
  z: number;
  R: number;
  isPouch: boolean;
  temp: number;
  ambient: number;
}) {
  const color = tempColor(temp, ambient);
  const glow = 0.08 + 0.55 * clamp01((temp - ambient - 4) / 50);
  if (isPouch) {
    return (
      <group position={[x, 0, z]}>
        <mesh castShadow>
          <boxGeometry args={[0.16, WORLD_H * 0.94, R * 1.9]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} roughness={0.45} metalness={0.1} />
        </mesh>
        <mesh position={[0, WORLD_H / 2 + 0.05, 0]}>
          <boxGeometry args={[0.13, 0.1, 0.3]} />
          <meshStandardMaterial color="#c8ccd4" metalness={0.9} roughness={0.25} />
        </mesh>
      </group>
    );
  }
  return (
    <group position={[x, 0, z]}>
      <mesh castShadow>
        <cylinderGeometry args={[R, R, WORLD_H * 0.965, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} roughness={0.4} metalness={0.25} />
      </mesh>
      <mesh position={[0, WORLD_H / 2 + 0.045, 0]}>
        <cylinderGeometry args={[R * 0.24, R * 0.26, 0.09, 16]} />
        <meshStandardMaterial color="#c8ccd4" metalness={0.95} roughness={0.2} />
      </mesh>
    </group>
  );
}

/** Animated cooling airflow — dashes streaming across the pack along +Z, fan spinning at the inlet */
function Airflow({ totalX, totalZ, hConv }: { totalX: number; totalZ: number; hConv: number }) {
  const dashes = useRef<(THREE.Mesh | null)[]>([]);
  const fan = useRef<THREE.Group>(null);
  const speed = 0.5 + Math.min(2.6, hConv / 22);
  const span = totalZ + 1.6;
  const lanes = 3;
  const perLane = 7;

  useFrame((_, dt) => {
    const step = speed * Math.min(dt, 0.05);
    dashes.current.forEach((m) => {
      if (!m) return;
      m.position.z += step;
      if (m.position.z > span / 2) m.position.z -= span;
    });
    if (fan.current) fan.current.rotation.z += step * 4;
  });

  const op = Math.min(0.5, 0.14 + hConv / 140);

  return (
    <group>
      {Array.from({ length: lanes * perLane }, (_, i) => {
        const lane = Math.floor(i / perLane);
        const k = i % perLane;
        const x = (lane - (lanes - 1) / 2) * (totalX / lanes) * 0.8;
        return (
          <mesh
            key={i}
            ref={(el) => {
              dashes.current[i] = el;
            }}
            position={[x, WORLD_H * 0.35, -span / 2 + (k / perLane) * span]}
          >
            <boxGeometry args={[0.05, 0.02, 0.34]} />
            <meshBasicMaterial color="#22d3ee" transparent opacity={op} />
          </mesh>
        );
      })}
      {/* inlet fan on the front face */}
      <group position={[0, 0, -totalZ / 2 - 0.34]}>
        <group ref={fan}>
          {[0, 2.1, 4.2].map((a) => (
            <mesh key={a} rotation={[Math.PI / 2, 0, a]}>
              <boxGeometry args={[0.03, 0.42, 0.015]} />
              <meshBasicMaterial color="#67e8f9" transparent opacity={0.85} />
            </mesh>
          ))}
        </group>
        <mesh>
          <torusGeometry args={[0.3, 0.025, 8, 32]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.35} />
        </mesh>
      </group>
    </group>
  );
}

/** Heat shimmer — small bubbles rising above hot cells (> 48 °C), capped for performance */
function HeatShimmer({ positions, temps }: { positions: [number, number, number][]; temps: number[] }) {
  const hot = useMemo(() => {
    const idx = temps
      .map((t, i) => ({ t, i }))
      .filter((d) => d.t > 48)
      .sort((a, b) => b.t - a.t)
      .slice(0, 20);
    return idx.map((d) => positions[d.i]);
  }, [positions, temps]);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const seeds = useMemo(() => hot.map((_, i) => hash01(i * 13 + 7) * 1.4), [hot]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    hot.forEach((_, i) => {
      const m = refs.current[i];
      if (!m) return;
      const phase = (t * 0.5 + seeds[i]) % 1.4;
      m.position.y = WORLD_H / 2 + 0.1 + phase * 0.9;
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.3 * clamp01(1 - phase / 1.4);
      const s = 0.75 + phase * 0.9;
      m.scale.set(s, s, s);
    });
  });

  if (hot.length === 0) return null;
  return (
    <group>
      {hot.map((p, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          position={p}
        >
          <sphereGeometry args={[0.075, 10, 10]} />
          <meshBasicMaterial color="#fb923c" transparent opacity={0.25} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Hottest / coldest markers — floating colour halos (red = hottest, cyan = coldest),
 *  gently bobbing so they're easy to spot while the pack spins. Deliberately text-free:
 *  the old floating Html labels ("hottest 31.2°C", "coldest …", "cooling airflow …")
 *  used to pile on top of each other while orbiting — the coldest cell sits right at
 *  the airflow inlet next to the fan label, and hot/cold cells are often neighbours.
 *  The values live in the screen-space chips at the top-left of the canvas instead. */
function HotColdRings({
  hotPos,
  coldPos,
  ringR,
}: {
  hotPos: [number, number, number];
  coldPos: [number, number, number];
  ringR: number;
}) {
  const g = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!g.current) return;
    const y = WORLD_H / 2 + 0.18 + Math.sin(state.clock.elapsedTime * 2.2) * 0.04;
    g.current.children.forEach((c) => {
      c.position.y = y;
    });
  });
  return (
    <group ref={g}>
      <mesh position={[hotPos[0], WORLD_H / 2 + 0.18, hotPos[2]]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[ringR, 0.035, 8, 32]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      <mesh position={[coldPos[0], WORLD_H / 2 + 0.18, coldPos[2]]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[ringR, 0.035, 8, 32]} />
        <meshBasicMaterial color="#22d3ee" />
      </mesh>
    </group>
  );
}

function ThermalScene({
  design,
  s,
  p,
  temps,
  ambient,
  hConv,
  coolingOn,
  showEnclosure,
  spin,
}: {
  design: CellDesign;
  s: number;
  p: number;
  temps: number[];
  ambient: number;
  hConv: number;
  coolingOn: boolean;
  showEnclosure: boolean;
  spin: boolean;
}) {
  const L = layoutOf(design, s, p);
  const rendered = Math.min(s * p, MAX_RENDERED_CELLS);
  const groups = Math.ceil(rendered / p);

  const centers = useMemo(() => {
    const out: { x: number; z: number; gi: number }[] = [];
    const rowX = (row: number) => row * (L.groupW + 0.8) - (L.totalX - L.groupW) / 2;
    for (let gi = 0; gi < groups; gi++) {
      const row = Math.floor(gi / L.perRow);
      const k = gi % L.perRow;
      out.push({ x: rowX(row), z: (k - (L.perRow - 1) / 2) * L.groupPitch, gi });
    }
    return out;
  }, [L, groups]);

  const cellPositions = useMemo<[number, number, number][]>(() => {
    const out: [number, number, number][] = [];
    centers.forEach(({ x, z }) => {
      for (let ci = 0; ci < p; ci++) out.push([x - L.groupW / 2 + (ci + 0.5) * L.pitch, 0, z]);
    });
    return out;
  }, [centers, L, p]);

  const hot = temps.reduce((m, t, i) => (t > temps[m] ? i : m), 0);
  const cold = temps.reduce((m, t, i) => (t < temps[m] ? i : m), 0);

  return (
    <group>
      {/* base tray */}
      <mesh position={[0, -WORLD_H / 2 - 0.03, 0]} receiveShadow>
        <boxGeometry args={[L.totalX + 0.55, 0.06, L.totalZ + 0.55]} />
        <meshStandardMaterial color="#475569" metalness={0.4} roughness={0.6} />
      </mesh>

      {/* temperature-coloured cells */}
      {centers.map(({ x, z, gi }) =>
        Array.from({ length: p }, (_, ci) => {
          const i = gi * p + ci;
          if (i >= rendered) return null;
          return (
            <ThermalCell
              key={`${gi}-${ci}`}
              design={design}
              x={x - L.groupW / 2 + (ci + 0.5) * L.pitch}
              z={z}
              R={L.R}
              isPouch={L.isPouch}
              temp={temps[i] ?? ambient}
              ambient={ambient}
            />
          );
        })
      )}

      {/* busbars in neutral grey so they don't fight the thermal colours */}
      {centers.map(({ x, z, gi }) => (
        <mesh key={`bus-${gi}`} position={[x, WORLD_H / 2 + 0.02, z]} castShadow>
          <boxGeometry args={[Math.max(0.2, L.groupW - 0.08), 0.035, L.isPouch ? L.R * 1.4 : L.R * 1.1]} />
          <meshStandardMaterial color="#9aa3af" metalness={0.9} roughness={0.25} />
        </mesh>
      ))}

      {coolingOn && hConv > 0 && <Airflow totalX={L.totalX} totalZ={L.totalZ} hConv={hConv} />}
      <HeatShimmer positions={cellPositions} temps={temps} />

      {/* hottest / coldest markers — text-free colour rings, so nothing can overlap */}
      {temps.length > 1 && (
        <HotColdRings
          hotPos={cellPositions[hot]}
          coldPos={cellPositions[cold]}
          ringR={Math.max(0.3, L.R * 0.85 + 0.05)}
        />
      )}

      {/* steel enclosure (toggleable — it hides the cells otherwise) */}
      {showEnclosure && (
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[L.totalX + 0.75, WORLD_H + 0.5, L.totalZ + 0.75]} />
          <meshStandardMaterial color="#64748b" transparent opacity={0.07} roughness={0.3} metalness={0.4} depthWrite={false} side={THREE.DoubleSide} />
          <Edges color="#64748b" />
        </mesh>
      )}

      <ContactShadows position={[0, -WORLD_H / 2 - 0.07, 0]} opacity={0.34} scale={Math.max(L.totalX, L.totalZ) * 1.6} blur={2.4} far={3} />
      <OrbitControls
        autoRotate={spin}
        autoRotateSpeed={1.1}
        enablePan={false}
        minDistance={Math.max(3, Math.max(L.totalX, L.totalZ) * 0.8)}
        maxDistance={Math.max(10, Math.max(L.totalX, L.totalZ) * 2.6)}
        target={[0, 0.2, 0]}
      />
    </group>
  );
}

export default function PackThermal3D({
  design,
  series,
  parallel,
  tMean,
  ambientC,
  hConv,
  coolingOn,
}: {
  design: CellDesign;
  series: number;
  parallel: number;
  tMean: number;
  ambientC: number;
  hConv: number;
  coolingOn: boolean;
}) {
  const [spin, setSpin] = useState(true);
  const [showEnclosure, setShowEnclosure] = useState(false);
  const temps = useThermalField(tMean, ambientC, coolingOn ? hConv : 0, series, parallel);
  const tHi = temps.reduce((m, t, i) => (t > temps[m] ? i : m), 0);
  const tLo = temps.reduce((m, t, i) => (t < temps[m] ? i : m), 0);
  const spread = temps.length > 1 ? temps[tHi] - temps[tLo] : 0;
  const L = layoutOf(design, series, parallel);

  const legendStops = [25, 35, 45, 60, 85, 130].map((t) => tempColor(t, 25));
  const gradient = `linear-gradient(90deg, ${legendStops.join(", ")})`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
          {series}S{parallel}P — live thermal field
        </span>
        <span className="rounded border bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
          {coolingOn ? `cooling on · h = ${hConv} W/m²K` : "adiabatic — no cooling"}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant={showEnclosure ? "default" : "outline"} className="h-7 px-2.5 text-[11px]" onClick={() => setShowEnclosure((v) => !v)}>
            {showEnclosure ? "Enclosure: on" : "Enclosure: off"}
          </Button>
          <Button size="sm" variant={spin ? "default" : "outline"} className="h-7 px-2.5 text-[11px]" onClick={() => setSpin((v) => !v)}>
            {spin ? "Spin: on" : "Spin: off"}
          </Button>
        </div>
      </div>

      <div className="relative h-[400px] overflow-hidden rounded-lg border bg-gradient-to-b from-slate-900 to-slate-950">
        <Canvas dpr={[1, 2]} camera={{ position: [5, 3, 6], fov: 40 }} gl={{ antialias: true }}>
          <ambientLight intensity={0.65} />
          <directionalLight position={[5, 7, 4]} intensity={1.1} castShadow />
          <directionalLight position={[-5, 3, -4]} intensity={0.35} />
          <ThermalScene
            design={design}
            s={series}
            p={parallel}
            temps={temps}
            ambient={ambientC}
            hConv={hConv}
            coolingOn={coolingOn}
            showEnclosure={showEnclosure}
            spin={spin}
          />
        </Canvas>

        {/* live readout chips */}
        <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-1.5">
          <span className="rounded bg-card/90 border px-1.5 py-0.5 text-[10px] font-semibold text-foreground">mean {tMean.toFixed(1)} °C</span>
          {temps.length > 1 && (
            <>
              <span className="rounded bg-card/90 border px-1.5 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">hottest {temps[tHi].toFixed(1)} °C</span>
              <span className="rounded bg-card/90 border px-1.5 py-0.5 text-[10px] font-semibold text-cyan-700 dark:text-cyan-300">coldest {temps[tLo].toFixed(1)} °C</span>
              <span className="rounded bg-card/90 border px-1.5 py-0.5 text-[10px] font-semibold text-foreground">ΔT {spread.toFixed(1)} K</span>
            </>
          )}
        </div>

        {/* thermal scale */}
        <div className="pointer-events-none absolute bottom-2 right-2 rounded-md border bg-card/90 px-2 py-1">
          <div className="h-1.5 w-36 rounded-full" style={{ background: gradient }} />
          <div className="mt-0.5 flex justify-between text-[8px] font-semibold text-muted-foreground tabular-nums">
            <span>{ambientC}°</span><span>45°</span><span>60°</span><span>130°C</span>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-card/90 border px-1.5 py-0.5 text-[10px] text-muted-foreground">
          drag to orbit · scroll to zoom
        </div>
      </div>

      <p className={cn("text-[11px] text-muted-foreground")}>
        Every cell is coloured by the per-cell thermal field around the Bernardi lumped mean — with cooling on, cells downstream of the airflow and away from the walls run hotter, and heat shimmer rises above cells beyond 48 °C. The hottest cell is ringed red and the coldest cyan (matching the readout chips on the canvas), and the field updates live as the test replays.
      </p>
    </div>
  );
}
