"use client";

import { useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Html, Edges } from "@react-three/drei";
import * as THREE from "three";
import type { CellDesign } from "@/lib/lab/engine";
import { MAX_RENDERED_CELLS } from "@/lib/lab/pack";
import { Button } from "@/components/ui/button";
import { CHEM_COLORS, dimsOf } from "./cell-3d";
import { cn } from "@/lib/utils";

// ============================================================
// PackViewer3D — how the finished design looks as a full pack:
// S series groups × P parallel cells, nickel parallel busbars on
// every group, series jumpers between groups, BMS board, steel
// enclosure and the main +/− terminals. Geometry scales with the
// designed cell (diameter/length) and the Connection S×P config.
// ============================================================

export const WORLD_H = 1.5;

interface Layout {
  R: number; // cell world radius
  pitch: number; // cell-to-cell spacing inside a group
  groupW: number; // X size of one parallel group
  groupPitch: number; // Z spacing between groups
  perRow: number; // groups per row
  rows: number;
  totalX: number;
  totalZ: number;
  isPouch: boolean;
}

// Shared with the 3D thermal view so both draw the identical pack geometry
export function layoutOf(design: CellDesign, s: number, p: number): Layout {
  const isPouch = /pouch|prismatic|blade/i.test(design.formFactor || "");
  const { r, h } = dimsOf(design);
  const R = isPouch ? 0.42 : Math.min(0.62, Math.max(0.26, (r / h) * WORLD_H * 2.2));
  const pitch = R * 2 + 0.06;
  const groupW = p * pitch;
  const groupPitch = R * 2 + 0.24;
  const rows = Math.max(1, Math.ceil(s / 10));
  const perRow = Math.ceil(s / rows);
  const totalX = rows * groupW + (rows - 1) * 0.8;
  const totalZ = perRow * groupPitch;
  return { R, pitch, groupW, groupPitch, perRow, rows, totalX, totalZ, isPouch };
}

function PackCell({
  design,
  x,
  z,
  R,
  isPouch,
}: {
  design: CellDesign;
  x: number;
  z: number;
  R: number;
  isPouch: boolean;
}) {
  const chem = CHEM_COLORS[design.chemistry] ?? "#1e5a96";
  if (isPouch) {
    return (
      <group position={[x, 0, z]}>
        <mesh castShadow>
          <boxGeometry args={[0.16, WORLD_H * 0.94, R * 1.9]} />
          <meshStandardMaterial color={chem} roughness={0.5} metalness={0.15} />
        </mesh>
        {/* + (red) and − (dark) terminal tabs on the pouch top */}
        <mesh position={[0.05, WORLD_H / 2 + 0.05, 0]} castShadow>
          <boxGeometry args={[0.05, 0.1, 0.26]} />
          <meshStandardMaterial color="#dc2626" metalness={0.4} roughness={0.35} />
        </mesh>
        <mesh position={[-0.05, WORLD_H / 2 + 0.05, 0]} castShadow>
          <boxGeometry args={[0.05, 0.1, 0.26]} />
          <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.4} />
        </mesh>
      </group>
    );
  }
  return (
    <group position={[x, 0, z]}>
      {/* steel can */}
      <mesh castShadow>
        <cylinderGeometry args={[R, R, WORLD_H * 0.965, 32]} />
        <meshStandardMaterial color="#b9bec8" metalness={0.85} roughness={0.32} />
      </mesh>
      {/* chemistry wrapper */}
      <mesh>
        <cylinderGeometry args={[R + 0.012, R + 0.012, WORLD_H * 0.9, 32, 1, true]} />
        <meshStandardMaterial color={chem} metalness={0.15} roughness={0.55} side={THREE.DoubleSide} />
      </mesh>
      {/* + terminal nub — bright RED and tall enough to poke through the busbar,
          so every cell's polarity reads instantly from any angle */}
      <mesh position={[0, WORLD_H / 2 + 0.06, 0]} castShadow>
        <cylinderGeometry args={[R * 0.28, R * 0.3, 0.2, 20]} />
        <meshStandardMaterial color="#dc2626" metalness={0.35} roughness={0.35} />
      </mesh>
      {/* − terminal — dark ring around the can base (the steel can body is negative) */}
      <mesh position={[0, -WORLD_H * 0.4825 + 0.012, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[R * 0.96, 0.022, 8, 32]} />
        <meshStandardMaterial color="#334155" metalness={0.55} roughness={0.4} />
      </mesh>
    </group>
  );
}

function PackScene({
  design,
  s,
  p,
  showBus,
  spin,
}: {
  design: CellDesign;
  s: number;
  p: number;
  showBus: boolean;
  spin: boolean;
}) {
  const L = layoutOf(design, s, p);
  const rendered = Math.min(s * p, MAX_RENDERED_CELLS);
  const groups = Math.ceil(rendered / p); // fully rendered groups

  // group centre positions (groups fill row by row along Z)
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

  const busY = WORLD_H / 2 + 0.02;

  return (
    <group>
      {/* base tray */}
      <mesh position={[0, -WORLD_H / 2 - 0.03, 0]} receiveShadow>
        <boxGeometry args={[L.totalX + 0.55, 0.06, L.totalZ + 0.55]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.4} roughness={0.6} />
      </mesh>

      {/* cells */}
      {centers.map(({ x, z, gi }) => (
        <group key={gi}>
          {Array.from({ length: p }, (_, ci) => (
            <PackCell
              key={ci}
              design={design}
              x={x - L.groupW / 2 + (ci + 0.5) * L.pitch}
              z={z}
              R={L.R}
              isPouch={L.isPouch}
            />
          ))}
        </group>
      ))}

      {/* parallel busbars — one nickel strip across each group */}
      {showBus &&
        centers.map(({ x, z, gi }) => (
          <mesh key={`bus-${gi}`} position={[x, busY, z]} castShadow>
            <boxGeometry args={[Math.max(0.2, L.groupW - 0.08), 0.035, L.isPouch ? L.R * 1.4 : L.R * 1.1]} />
            <meshStandardMaterial color="#d4d8de" metalness={0.95} roughness={0.18} />
          </mesh>
        ))}

      {/* series jumpers between adjacent groups (alternating ends, serpentine) */}
      {showBus &&
        centers.map(({ x, z, gi }) => {
          const sameRowNext = centers.find((c) => c.gi === gi + 1);
          if (!sameRowNext || sameRowNext.z - z !== L.groupPitch) return null;
          const side = gi % 2 === 0 ? 1 : -1;
          const jx = x + side * (L.groupW / 2 - 0.09);
          return (
            <mesh key={`jmp-${gi}`} position={[jx, busY, z + L.groupPitch / 2]} castShadow>
              <boxGeometry args={[0.16, 0.035, L.groupPitch + 0.16]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.2} />
            </mesh>
          );
        })}
      {/* row-to-row link */}
      {showBus && L.rows > 1 && (() => {
        const lastInRow = L.perRow - 1;
        const a = centers.find((c) => c.gi === lastInRow);
        const b = centers.find((c) => c.gi === L.perRow);
        if (!a || !b) return null;
        return (
          <mesh position={[(a.x + b.x) / 2, busY, a.z]} castShadow>
            <boxGeometry args={[Math.abs(b.x - a.x) + 0.2, 0.035, 0.16]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.2} />
          </mesh>
        );
      })()}

      {/* main pack terminals — big colour-coded posts with washer rings:
          red = +, dark slate = −. Identification is via colour + the
          screen-space legend card (floating Html labels used to overlap). */}
      {centers.length > 0 && (() => {
        const first = centers[0];
        const last = centers[centers.length - 1];
        const px = first.x - L.groupW / 2 + 0.14;
        const nx = last.x + L.groupW / 2 - 0.14;
        return (
          <group>
            <mesh position={[px, busY + 0.11, first.z]} castShadow>
              <cylinderGeometry args={[0.12, 0.14, 0.24, 20]} />
              <meshStandardMaterial color="#dc2626" metalness={0.35} roughness={0.4} />
            </mesh>
            <mesh position={[px, busY + 0.005, first.z]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.19, 0.032, 8, 28]} />
              <meshStandardMaterial color="#dc2626" metalness={0.35} roughness={0.4} />
            </mesh>
            <mesh position={[nx, busY + 0.11, last.z]} castShadow>
              <cylinderGeometry args={[0.12, 0.14, 0.24, 20]} />
              <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.4} />
            </mesh>
            <mesh position={[nx, busY + 0.005, last.z]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.19, 0.032, 8, 28]} />
              <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.4} />
            </mesh>
          </group>
        );
      })()}

      {/* BMS board at the front edge */}
      <group position={[0, -WORLD_H / 2 + 0.02, -L.totalZ / 2 - 0.18]}>
        <mesh castShadow>
          <boxGeometry args={[Math.min(1.4, L.totalX), 0.05, 0.34]} />
          <meshStandardMaterial color="#166534" roughness={0.55} metalness={0.1} />
        </mesh>
        {[-0.28, 0, 0.28].map((dx) => (
          <mesh key={dx} position={[dx, 0.05, 0]}>
            <boxGeometry args={[0.14, 0.04, 0.12]} />
            <meshStandardMaterial color="#0f172a" roughness={0.4} />
          </mesh>
        ))}
        <Html position={[Math.min(0.7, L.totalX / 2), 0.2, 0]} center distanceFactor={8} zIndexRange={[20, 0]}>
          <div className="rounded border bg-card/95 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 shadow-sm whitespace-nowrap">BMS · CMU</div>
        </Html>
      </group>

      {/* steel enclosure */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[L.totalX + 0.75, WORLD_H + 0.5, L.totalZ + 0.75]} />
        <meshStandardMaterial color="#64748b" transparent opacity={0.09} roughness={0.3} metalness={0.4} depthWrite={false} side={THREE.DoubleSide} />
        <Edges color="#94a3b8" />
      </mesh>

      <ContactShadows position={[0, -WORLD_H / 2 - 0.07, 0]} opacity={0.32} scale={Math.max(L.totalX, L.totalZ) * 1.6} blur={2.4} far={3} />
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

// Spec moved to a SCREEN-SPACE bottom-left card (in PackViewer3D below):
// a 3D-anchored label floating above the pack used to hide the top view
// at every camera angle. Screen-space overlay never covers the model.

// FitCamera — move the camera out when the pack grows
function FitCamera({ sizeX, sizeZ }: { sizeX: number; sizeZ: number }) {
  const three = useThree();
  const dist = Math.max(4.2, Math.max(sizeX, sizeZ, 1.6) * 1.05);
  useEffect(() => {
    three.camera.position.set(dist * 0.95, dist * 0.5 + 1.2, dist * 1.15);
    three.camera.lookAt(0, 0.2, 0);
    const c = three.controls as unknown as { target: THREE.Vector3; update: () => void } | null;
    if (c && "target" in c) {
      c.target.set(0, 0.2, 0);
      c.update();
    }
  }, [three, dist]);
  return null;
}

export default function PackViewer3D({
  design,
  series,
  parallel,
  wrapperId,
}: {
  design: CellDesign;
  series: number;
  parallel: number;
  wrapperId?: string;
}) {
  const [spin, setSpin] = useState(true);
  const [showBus, setShowBus] = useState(true);
  const chem = CHEM_COLORS[design.chemistry] ?? "#1e5a96";
  const L = useMemo(() => layoutOf(design, series, parallel), [design, series, parallel]);
  const total = series * parallel;
  const rendered = Math.min(total, MAX_RENDERED_CELLS);
  const packV = design.nominalV * series;
  const packAh = design.capacityAh * parallel;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
          {series}S{parallel}P — {series * parallel} cell{series * parallel === 1 ? "" : "s"}
        </span>
        <span className="rounded border bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
          {design.name || design.chemistry}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant={showBus ? "default" : "outline"} className="h-7 px-2.5 text-[11px]" onClick={() => setShowBus((v) => !v)}>
            {showBus ? "Busbars: on" : "Busbars: off"}
          </Button>
          <Button size="sm" variant={spin ? "default" : "outline"} className="h-7 px-2.5 text-[11px]" onClick={() => setSpin((v) => !v)}>
            {spin ? "Spin: on" : "Spin: off"}
          </Button>
        </div>
      </div>

      <div id={wrapperId} className="relative h-[360px] overflow-hidden rounded-lg border bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
        <Canvas dpr={[1, 2]} camera={{ position: [5, 3, 6], fov: 40 }} gl={{ antialias: true, preserveDrawingBuffer: true }}>
          <ambientLight intensity={0.75} />
          <directionalLight position={[5, 7, 4]} intensity={1.25} castShadow />
          <directionalLight position={[-5, 3, -4]} intensity={0.4} />
          <PackScene design={design} s={series} p={parallel} showBus={showBus} spin={spin} />
          <FitCamera sizeX={L.totalX} sizeZ={L.totalZ} />
        </Canvas>
        {/* battery specification — fixed to the BOTTOM-LEFT of the viewport,
            never overlapping the pack's top view */}
        <div className="pointer-events-none absolute bottom-2 left-2 max-w-[calc(100%-1rem)]">
          <div className="space-y-0.5 rounded-lg border bg-card/95 px-2.5 py-1.5 shadow-sm backdrop-blur-sm">
            <div className="whitespace-nowrap text-[11px] font-bold text-foreground">
              {series}S{parallel}P · {total} cell{total === 1 ? "" : "s"}
            </div>
            <div className="whitespace-nowrap text-[10px] text-muted-foreground">
              {packV.toFixed(1)} V · {packAh.toFixed(1)} Ah · {(packV * packAh).toFixed(0)} Wh
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded border px-1 py-px text-[9px] font-bold" style={{ color: chem }}>
                {design.chemistry}
              </span>
              {design.massKg > 0 && (
                <span className="whitespace-nowrap text-[9px] text-muted-foreground">
                  ≈ {(design.massKg * total).toFixed(1)} kg cells
                </span>
              )}
              <span className="whitespace-nowrap text-[9px] text-muted-foreground">{design.name}</span>
            </div>
            {rendered < total && (
              <div className="whitespace-nowrap text-[9px] font-semibold text-amber-600 dark:text-amber-400">
                showing {rendered} of {total} cells (render cap)
              </div>
            )}
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 border-t border-border/60 pt-1">
              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-600 dark:text-red-400">
                <i className="h-2 w-2 rounded-full bg-red-600" /> + positive — red caps &amp; red post
              </span>
              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-foreground">
                <i className="h-2 w-2 rounded-full bg-slate-500" /> − negative — dark base rings &amp; dark post
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: chem }} /> cell wrapper / chemistry</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-slate-300" /> nickel busbars (P + series jumpers)</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-700" /> BMS / CMU board</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-red-600" /> + positive (red post · red cell caps)</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-slate-500" /> − negative (dark post · dark base rings)</span>
        <span className="ml-auto">drag to orbit · scroll to zoom</span>
      </div>
      <p className={cn("text-[11px] text-muted-foreground")}>
        Layout follows your Connection settings — change S×P there (or the cell dimensions in Design) and this rebuilds to match: {parallel} cells per group in parallel, {series} groups in series, one nickel strip per group and serpentine series jumpers. Polarity is colour-coded: every cell has a red + cap on top and a dark − ring at its base, and the pack's main output posts sit at the outer ends — red for +, dark for −.
      </p>
    </div>
  );
}
