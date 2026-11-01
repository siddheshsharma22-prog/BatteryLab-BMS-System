"use client";

import { useEffect, useRef, useState } from "react";
import type { SimPoint } from "./engine";

export interface Playback {
  tick: number;
  cur: SimPoint;
  playing: boolean;
  speed: number;
  syncCharts: boolean;
  length: number;
  setSpeed: (v: number) => void;
  setSyncCharts: (v: boolean) => void;
  toggle: () => void;
  restart: () => void;
  scrub: (v: number) => void;
  /** series sliced up to the playback position when sync is on */
  viewSeries: SimPoint[];
}

/**
 * Shared "live bench" playback engine: replays a recorded run like a
 * real-time test. RAF advances a float position (whole test ≈ 40 s at
 * 1×), but React only re-renders when the integer index changes.
 * Used by Simulation (test bench), Thermal (scopes + pack map) and
 * Monitor (BMS dashboard) so every graph follows the same live clock.
 */
export function usePlayback(series: SimPoint[], ambientC = 25): Playback {
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [syncCharts, setSyncCharts] = useState(true);
  const posRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef(1);
  const seriesRef = useRef<SimPoint[] | null>(null);

  // keep refs in sync outside of render (RAF loop reads them every frame)
  useEffect(() => {
    playingRef.current = playing;
    speedRef.current = speed;
  }, [playing, speed]);

  // RAF advance — re-render only when the integer index changes.
  // A new result (or a first mount with a result) is detected by identity
  // inside the loop, which rewinds + auto-plays without touching state
  // during render or directly inside the effect body.
  useEffect(() => {
    if (series.length < 2) return;
    let raf = 0;
    let last = performance.now();
    let lastTick = -1;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (seriesRef.current !== series) {
        seriesRef.current = series;
        posRef.current = 0;
        lastTick = -1;
        setTick(0);
        setPlaying(true);
      }
      if (playingRef.current) {
        posRef.current += dt * speedRef.current * (series.length / 40);
        if (posRef.current >= series.length - 1) {
          posRef.current = series.length - 1;
          setPlaying(false);
        }
        const t = Math.floor(posRef.current);
        if (t !== lastTick) {
          lastTick = t;
          setTick(t);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [series]);

  const cur: SimPoint =
    series[Math.min(tick, Math.max(0, series.length - 1))] ?? {
      t: 0, vCell: 0, vPack: 0, soc: 1, iCell: 0, tempC: ambientC, qGen: 0, ocv: 0, mode: "rest",
    };
  const viewSeries = syncCharts ? series.slice(0, tick + 1) : series;

  return {
    tick,
    cur,
    playing,
    speed,
    syncCharts,
    length: series.length,
    setSpeed,
    setSyncCharts,
    toggle: () => setPlaying((p) => !p),
    restart: () => {
      posRef.current = 0;
      setTick(0);
      setPlaying(true);
    },
    scrub: (v: number) => {
      posRef.current = v;
      setTick(v);
      setPlaying(false);
    },
    viewSeries,
  };
}
