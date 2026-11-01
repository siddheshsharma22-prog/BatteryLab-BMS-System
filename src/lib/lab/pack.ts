// ============================================================
// BatteryLab — Pack-level helper model
// Deterministic per-cell voltage / temperature distributions
// used by the 3D pack view, the pack thermal map and the
// live monitoring tab. Everything is derived from the single
// lumped result (mean cell temp, cell voltage, current, SOC)
// so the visuals stay consistent with the physics engine.
// ============================================================

// Deterministic pseudo-random in [0, 1) from an index — keeps the
// per-cell spread stable between renders (no flicker).
export function hash01(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export interface TempFieldOpts {
  /** convection coefficient W/m²K — 0 = adiabatic */
  hConv: number;
  /** number of parallel groups along the airflow direction */
  cols: number;
  /** number of series rows across the airflow */
  rows: number;
}

/**
 * Per-cell temperature distribution around the lumped mean.
 * Physics story: with no cooling every cell sits ~uniformly at the
 * mean (tiny conduction noise). With forced/natural convection the
 * pack develops a gradient along the airflow direction (downstream
 * cells run hotter) plus cooler perimeter cells, so the spread grows
 * with h. The array is mean-centred so the average always matches
 * the lumped node temperature from the engine.
 */
export function cellTemps(
  tMean: number,
  ambientC: number,
  count: number,
  opts: TempFieldOpts
): number[] {
  if (count <= 0) return [];
  if (count === 1) return [tMean];

  const lift = Math.max(0.4, Math.min(1.2, (tMean - ambientC) / 12 + 0.25));
  const spread = (opts.hConv > 0 ? 0.9 + Math.min(3.6, opts.hConv / 26) : 0.35) * lift;

  const raw: number[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % opts.cols;
    const row = Math.floor(i / opts.cols);
    const colN = opts.cols > 1 ? col / (opts.cols - 1) : 0;
    // airflow gradient: downstream (higher column index) hotter
    const flow = opts.hConv > 0 ? colN * spread : 0;
    // perimeter cells touch the walls → cooler
    const edgeX = opts.cols > 1 ? Math.min(col, opts.cols - 1 - col) : 0;
    const edgeY = opts.rows > 1 ? Math.min(row, opts.rows - 1 - row) : 0;
    const edge = edgeX === 0 || edgeY === 0 ? -0.3 * spread : 0;
    // cell-to-cell conduction / contact variance
    const noise = (hash01(i) - 0.5) * 0.5 * spread;
    raw.push(flow + edge + noise);
  }
  // mean-centre and re-anchor on the lumped mean
  const avg = raw.reduce((a, b) => a + b, 0) / count;
  return raw.map((d) => tMean + (d - avg));
}

/**
 * Per-cell voltage spread around the ECM terminal voltage.
 * Cell-to-cell capacity/resistance mismatch shows up strongest at
 * the SOC extremes (knee of the OCV curve) and scales a little with
 * current. Typical lithium spread: 1–8 mV mid-SOC, up to ~20 mV at
 * the cutoff knees.
 */
export function cellVoltages(
  vCell: number,
  count: number,
  soc: number,
  currentA: number,
  capacityAh: number
): number[] {
  if (count <= 0) return [];
  if (count === 1) return [vCell];
  const socE = Math.min(1, Math.max(0, soc));
  const knee = Math.max(0, 1 - Math.min(1, Math.min(socE, 1 - socE) / 0.12)); // 1 at the knees
  const cFactor = Math.min(1.6, Math.abs(currentA) / Math.max(0.2, capacityAh || 1)) / 1.6;
  const jitter = 0.0015 + 0.009 * knee + 0.002 * cFactor;
  return Array.from({ length: count }, (_, i) => {
    const n = (hash01(i * 3 + 17) - 0.5) * 2 * jitter;
    return vCell + n;
  });
}

/** Thermal scale cold→hot: teal → emerald → yellow → orange → red */
export function tempColor(t: number, ambientC = 25): string {
  const stops: { p: number; c: [number, number, number] }[] = [
    { p: ambientC, c: [14, 116, 144] }, // teal-700-ish cold
    { p: 35, c: [16, 185, 129] }, // emerald
    { p: 45, c: [250, 204, 21] }, // yellow
    { p: 60, c: [249, 115, 22] }, // orange
    { p: 85, c: [220, 38, 38] }, // red
    { p: 130, c: [127, 29, 29] }, // dark red runaway
  ];
  if (t <= stops[0].p) return rgb(stops[0].c);
  for (let k = 1; k < stops.length; k++) {
    if (t <= stops[k].p) {
      const a = stops[k - 1];
      const b = stops[k];
      const f = (t - a.p) / (b.p - a.p);
      return rgb([
        Math.round(a.c[0] + (b.c[0] - a.c[0]) * f),
        Math.round(a.c[1] + (b.c[1] - a.c[1]) * f),
        Math.round(a.c[2] + (b.c[2] - a.c[2]) * f),
      ]);
    }
  }
  return rgb(stops[stops.length - 1].c);
}

function rgb([r, g, b]: [number, number, number]): string {
  return `rgb(${r},${g},${b})`;
}

/** Total cells actually rendered when capping huge packs. */
export const MAX_RENDERED_CELLS = 120;
