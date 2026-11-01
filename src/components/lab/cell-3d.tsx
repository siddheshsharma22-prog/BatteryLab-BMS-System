"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Html } from "@react-three/drei";
import * as THREE from "three";
import type { CellDesign } from "@/lib/lab/engine";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Chemistry → wrapper colour (matches the app's chart palette feel)
export const CHEM_COLORS: Record<string, string> = {
  NMC: "#1e5a96",
  NCA: "#b45309",
  LFP: "#0e7490",
  LTO: "#64748b",
  LCO: "#7c3aed",
  LeadAcid: "#4b5563",
  NiMH: "#16a34a",
  NiCd: "#84cc16",
};

export type IonMode = "idle" | "discharge" | "charge";

export function dimsOf(d: CellDesign): { r: number; h: number } {
  const isPouch = /pouch|prismatic|blade/i.test(d.formFactor || "");
  const dia = d.diameterMm > 0 ? d.diameterMm : isPouch ? (d.thicknessMm > 0 ? 40 : 21) : 21;
  const len = d.lengthMm > 0 ? d.lengthMm : d.heightMm > 0 ? d.heightMm : isPouch ? 90 : 70;
  return { r: dia / 2, h: len };
}

// ------------------------------------------------------------------
// The cell — can, wrapper, jelly roll (cutaway), ion particles
// ------------------------------------------------------------------
function CellBody({
  design,
  cutaway,
  ionMode,
}: {
  design: CellDesign;
  cutaway: boolean;
  ionMode: IonMode;
}) {
  const { r, h } = dimsOf(design); // cheap scalar math — no memo needed
  const chem = CHEM_COLORS[design.chemistry] ?? "#1e5a96";
  const H = 3.3; // world height
  const R = (r / h) * H; // world radius
  const canH = H * 0.965;
  const wrapH = H * 0.92;

  return (
    <group position={[0, 0, 0]}>
      {/* steel can */}
      <mesh castShadow>
        <cylinderGeometry args={[R, R, canH, 48]} />
        <meshStandardMaterial color="#b9bec8" metalness={0.85} roughness={0.32} transparent={cutaway} opacity={cutaway ? 0.22 : 1} />
      </mesh>
      {/* can bottom (stays solid) */}
      <mesh position={[0, -canH / 2 + 0.02, 0]}>
        <cylinderGeometry args={[R, R, 0.04, 48]} />
        <meshStandardMaterial color="#9aa1ad" metalness={0.85} roughness={0.35} />
      </mesh>
      {/* heat-shrink wrapper (chemistry colour) */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[R + 0.012, R + 0.012, wrapH, 48, 1, true]} />
        <meshStandardMaterial
          color={chem}
          metalness={0.15}
          roughness={0.55}
          transparent
          opacity={cutaway ? 0.14 : 0.96}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* top rim */}
      <mesh position={[0, canH / 2, 0]}>
        <torusGeometry args={[R * 0.985, 0.012, 10, 48]} />
        <meshStandardMaterial color="#d4d8de" metalness={0.9} roughness={0.25} />
      </mesh>
      {/* + terminal button */}
      <mesh position={[0, canH / 2 + 0.05, 0]} castShadow>
        <cylinderGeometry args={[R * 0.24, R * 0.26, 0.1, 24]} />
        <meshStandardMaterial color="#c8ccd4" metalness={0.95} roughness={0.2} />
      </mesh>
      {/* vent grooves on cap */}
      <mesh position={[0, canH / 2 + 0.005, 0]}>
        <cylinderGeometry args={[R * 0.96, R * 0.96, 0.015, 24]} />
        <meshStandardMaterial color="#7d8492" metalness={0.8} roughness={0.4} />
      </mesh>

      {/* jelly roll internals — semi-transparent so the Li⁺ shuttle stays visible */}
      <group visible={cutaway}>
        <mesh>
          <cylinderGeometry args={[R * 0.84, R * 0.84, H * 0.86, 40]} />
          <meshStandardMaterial color="#9a6b3f" metalness={0.55} roughness={0.45} transparent opacity={0.72} depthWrite={false} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[R * 0.6, R * 0.6, H * 0.87, 40]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.9} transparent opacity={0.4} depthWrite={false} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[R * 0.38, R * 0.38, H * 0.88, 32]} />
          <meshStandardMaterial color="#2f3540" roughness={0.6} transparent opacity={0.85} depthWrite={false} />
        </mesh>
        {/* centre mandrel void */}
        <mesh>
          <cylinderGeometry args={[R * 0.1, R * 0.1, H * 0.89, 16]} />
          <meshStandardMaterial color="#0f172a" roughness={1} transparent opacity={0.9} depthWrite={false} />
        </mesh>
      </group>

      {/* Li-ion particles shuttling between the electrodes */}
      <Ions mode={ionMode} R={R} H={H} visible={cutaway || ionMode !== "idle"} />
    </group>
  );
}

function Ions({ mode, R, H, visible }: { mode: IonMode; R: number; H: number; visible: boolean }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const N = 18;
  const seeds = useMemo(
    () => Array.from({ length: N }, (_, i) => ({ phase: i / N, ang: (i * 2.399) % (Math.PI * 2), rr: R * (0.45 + (i % 3) * 0.14) })),
    [R]
  );
  useFrame(({ clock }) => {
    if (mode === "idle") return;
    const t = clock.getElapsedTime();
    const dir = mode === "discharge" ? 1 : -1;
    seeds.forEach((s, i) => {
      const m = refs.current[i];
      if (!m) return;
      const p = (s.phase + t * 0.22 * dir) % 1;
      const y = (p - 0.5) * H * 0.8;
      const a = s.ang + t * 0.5;
      m.position.set(Math.cos(a) * s.rr, y, Math.sin(a) * s.rr);
    });
  });
  if (!visible || mode === "idle") return null;
  return (
    <group>
      {seeds.map((s, i) => (
        <mesh key={i} ref={(el) => { refs.current[i] = el; }}>
          <sphereGeometry args={[R * 0.065, 10, 10]} />
          <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={2.2} />
        </mesh>
      ))}
      {/* direction hint */}
      <Html position={[R + 0.55, H * 0.34, 0]} center distanceFactor={9} zIndexRange={[20, 0]}>
        <div className="rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow whitespace-nowrap">
          Li⁺ {mode === "discharge" ? "anode → cathode" : "cathode → anode"}
        </div>
      </Html>
    </group>
  );
}

// ------------------------------------------------------------------
// Public component — card body (canvas + controls live in the tab card)
// ------------------------------------------------------------------
export function CellViewer3D({ design }: { design: CellDesign }) {
  const [cutaway, setCutaway] = useState(true);
  const [rotate, setRotate] = useState(true);
  const [ionMode, setIonMode] = useState<IonMode>("discharge");

  const chem = CHEM_COLORS[design.chemistry] ?? "#1e5a96";
  const { r, h } = dimsOf(design);

  return (
    <div className="space-y-3">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-md border bg-muted/40 p-0.5" role="group" aria-label="Ion flow">
          {(["idle", "discharge", "charge"] as IonMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setIonMode(m)}
              className={cn(
                "rounded px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                ionMode === m ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground">Li⁺ shuttle</span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant={cutaway ? "default" : "outline"} className="h-7 px-2.5 text-[11px]" onClick={() => setCutaway((v) => !v)}>
            {cutaway ? "Cutaway: on" : "Cutaway: off"}
          </Button>
          <Button size="sm" variant={rotate ? "default" : "outline"} className="h-7 px-2.5 text-[11px]" onClick={() => setRotate((v) => !v)}>
            {rotate ? "Spin: on" : "Spin: off"}
          </Button>
        </div>
      </div>

      {/* canvas */}
      <div className="relative h-[340px] overflow-hidden rounded-lg border bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
        <Canvas dpr={[1, 2]} camera={{ position: [4.5, 1.7, 4.8], fov: 40 }} gl={{ antialias: true }}>
          <ambientLight intensity={0.75} />
          <directionalLight position={[4, 6, 3]} intensity={1.3} castShadow />
          <directionalLight position={[-4, 2, -3]} intensity={0.4} />
          <CellBody design={design} cutaway={cutaway} ionMode={ionMode} />
          {/* part labels */}
          <Html position={[0, 2.05, 0]} center distanceFactor={7} zIndexRange={[20, 0]}>
            <div className="rounded border bg-card/95 px-1.5 py-0.5 text-[9px] font-semibold text-slate-700 shadow-sm whitespace-nowrap">
              + terminal · vent (CID)
            </div>
          </Html>
          {cutaway && (
            <>
              <Html position={[-1.9, 1.0, 0.4]} center distanceFactor={7} zIndexRange={[20, 0]}>
                <div className="rounded border bg-card/95 px-1.5 py-0.5 text-[9px] font-semibold shadow-sm whitespace-nowrap" style={{ color: "#9a6b3f" }}>
                  Cathode (Al + {design.chemistry})
                </div>
              </Html>
              <Html position={[1.5, 0, 0.6]} center distanceFactor={7} zIndexRange={[20, 0]}>
                <div className="rounded border bg-card/95 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 shadow-sm whitespace-nowrap">
                  Separator (PE/PP)
                </div>
              </Html>
              <Html position={[-1.4, -1.0, 0.4]} center distanceFactor={7} zIndexRange={[20, 0]}>
                <div className="rounded border bg-card/95 px-1.5 py-0.5 text-[9px] font-semibold text-slate-700 shadow-sm whitespace-nowrap">
                  Anode (Cu + graphite)
                </div>
              </Html>
            </>
          )}
          <Html position={[-2.1, -1.55, 0]} center distanceFactor={7} zIndexRange={[20, 0]}>
            <div className="rounded border bg-card/95 px-1.5 py-0.5 text-[9px] font-semibold text-slate-700 shadow-sm whitespace-nowrap">
              Steel can (−)
            </div>
          </Html>
          <ContactShadows position={[0, -1.85, 0]} opacity={0.35} scale={8} blur={2.6} far={3} />
          <OrbitControls
            autoRotate={rotate}
            autoRotateSpeed={1.6}
            enablePan={false}
            minDistance={3.2}
            maxDistance={9}
            target={[0, 0, 0]}
          />
        </Canvas>
        {/* watermark stats */}
        <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-1.5">
          <span className="rounded bg-card/90 border px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: chem }}>
            {design.chemistry}
          </span>
          <span className="rounded bg-card/90 border px-1.5 py-0.5 text-[10px] text-slate-600">
            ⌀{(r * 2).toFixed(0)} × {h.toFixed(0)} mm
          </span>
          {design.massKg > 0 && (
            <span className="rounded bg-card/90 border px-1.5 py-0.5 text-[10px] text-slate-600">
              {(design.massKg * 1000).toFixed(0)} g
            </span>
          )}
        </div>
      </div>

      {/* legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: chem }} /> wrapper / chemistry</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-[#b9bec8]" /> steel can</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-[#9a6b3f]" /> cathode foil</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-slate-100 dark:bg-slate-800 border" /> separator</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-[#2f3540]" /> anode foil</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Li⁺ ions</span>
        <span className="ml-auto">drag to orbit · scroll to zoom</span>
      </div>
    </div>
  );
}
