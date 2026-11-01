"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "./shared";
import { Cable, Cpu, Radio, Play, Square, Usb, ShieldCheck, TriangleAlert, ArrowUpDown } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { CHART_COLORS } from "./shared";
import type { CellDesign, PackConfig } from "@/lib/lab/engine";
import { cn } from "@/lib/utils";

// ============================================================
// HardwareMonitor — live telemetry straight from a real BMS.
// Two ways in: a physical COM port over the Web Serial API
// (Chrome/Edge) speaking CAN / RS485 / UART framing, or a demo
// frame stream when no hardware is at hand. Values, streaming
// chart and the raw frame log update from every received frame.
// ============================================================

// ---- minimal Web Serial typings (no @types/webserial dependency) ----
interface SerialPortInfoLike { usbVendorId?: number; usbProductId?: number }
interface SerialReaderLike {
  read(): Promise<{ value: Uint8Array | undefined; done: boolean }>;
  cancel(): Promise<void>;
  releaseLock(): void;
}
interface SerialPortLike {
  open(opts: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  getInfo(): SerialPortInfoLike;
  readable: ReadableStream<Uint8Array> | null;
}
interface SerialLike {
  requestPort(opts?: { filters?: unknown[] }): Promise<SerialPortLike>;
  addEventListener(type: "disconnect", cb: (e: Event) => void): void;
  removeEventListener(type: "disconnect", cb: (e: Event) => void): void;
}
type NavWithSerial = Navigator & { serial?: SerialLike };

type Proto = "can" | "rs485" | "uart";
type Status = "idle" | "connecting" | "connected" | "unsupported";

interface HwFrame {
  t: number;
  vPack?: number;
  vCell?: number;
  i?: number;
  soc?: number;
  tMax?: number;
  tMin?: number;
}

const PROTOS: { id: Proto; label: string; icon: React.ReactNode; phy: string; note: string }[] = [
  {
    id: "can",
    label: "CAN bus",
    icon: <Cable className="h-4 w-4" />,
    phy: "ISO 11898 · 250 / 500 kbit/s",
    note: "J1939-style broadcast frames via a USB-CAN adapter (SLCAN/candleLight) that exposes a COM port.",
  },
  {
    id: "rs485",
    label: "RS485 · Modbus RTU",
    icon: <ArrowUpDown className="h-4 w-4" />,
    phy: "half-duplex A/B · 8N1",
    note: "Register polling over a USB-RS485 dongle — the master reads pack V/I/SOC/temperature registers.",
  },
  {
    id: "uart",
    label: "UART (TTL)",
    icon: <Radio className="h-4 w-4" />,
    phy: "3.3 / 5 V TTL · ASCII frames",
    note: "Direct link through a USB-UART bridge — the BMS prints one telemetry line per second.",
  },
];

const BAUDS = [9600, 19200, 38400, 57600, 115200];

/** Best-effort ASCII frame parser: $BMS,vPack,vCell,I,SOC,tMax,tMin[,vMax,vMin,cycles] */
function parseLine(line: string): HwFrame | null {
  const clean = line.replace(/^\$?BMS[:=]?/i, "").replace(/^[^0-9\-]*/, "");
  const nums = clean
    .split(/[,;|\s]+/)
    .map((s) => parseFloat(s))
    .filter((n) => Number.isFinite(n));
  if (nums.length < 3) return null;
  return {
    t: Date.now(),
    vPack: nums[0],
    vCell: nums[1],
    i: nums[2],
    soc: nums[3],
    tMax: nums[4],
    tMin: nums[5],
  };
}

export function HardwareMonitor({ design, pack }: { design: CellDesign; pack: PackConfig }) {
  const [proto, setProto] = useState<Proto>("uart");
  const [baud, setBaud] = useState(115200);
  const [status, setStatus] = useState<Status>("idle");
  const [portInfo, setPortInfo] = useState<SerialPortInfoLike | null>(null);
  const [stats, setStats] = useState({ bytes: 0, frames: 0 });
  const [log, setLog] = useState<string[]>([]);
  const [logPaused, setLogPaused] = useState(false);
  const [parsed, setParsed] = useState<HwFrame | null>(null);
  const [history, setHistory] = useState<HwFrame[]>([]);
  const [demoOn, setDemoOn] = useState(false);

  const portRef = useRef<SerialPortLike | null>(null);
  const readerRef = useRef<SerialReaderLike | null>(null);
  const keepReading = useRef(false);
  const bytesRx = useRef(0);
  const framesRx = useRef(0);
  const logPausedRef = useRef(false);
  logPausedRef.current = logPaused;

  const pushLog = (line: string) => {
    if (logPausedRef.current) return;
    setLog((l) => [line, ...l].slice(0, 60));
  };

  // ---- receive loop ----
  const readLoop = async (port: SerialPortLike) => {
    if (!port.readable) return;
    const reader = port.readable.getReader();
    readerRef.current = reader;
    const dec = new TextDecoder();
    let buf = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          bytesRx.current += value.byteLength;
          const hex = Array.from(value.slice(0, 24))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(" ");
          pushLog(`${new Date().toLocaleTimeString()}  RX ${hex}${value.length > 24 ? " …" : ""}`);
          buf += dec.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.search(/[\r\n]/)) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            const f = parseLine(line);
            if (f) {
              framesRx.current += 1;
              setParsed(f);
              setHistory((h) => [...h.slice(-239), f]);
            }
          }
          setStats({ bytes: bytesRx.current, frames: framesRx.current });
        }
      }
    } catch {
      pushLog("! read error — device unplugged?");
    } finally {
      reader.releaseLock();
      readerRef.current = null;
    }
  };

  const connect = async () => {
    const nav = navigator as NavWithSerial;
    if (!nav.serial) {
      setStatus("unsupported");
      return;
    }
    setStatus("connecting");
    try {
      const port = await nav.serial.requestPort();
      await port.open({ baudRate: baud });
      portRef.current = port;
      keepReading.current = true;
      bytesRx.current = 0;
      framesRx.current = 0;
      setStats({ bytes: 0, frames: 0 });
      setPortInfo(port.getInfo());
      setStatus("connected");
      pushLog(`— opened COM port @ ${baud} 8N1 — waiting for BMS frames…`);
      void readLoop(port);
    } catch (e) {
      setStatus("idle");
      pushLog(`! could not open port: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const disconnect = async () => {
    keepReading.current = false;
    try {
      await readerRef.current?.cancel();
    } catch {
      /* already gone */
    }
    try {
      await portRef.current?.close();
    } catch {
      /* already closed */
    }
    portRef.current = null;
    setPortInfo(null);
    setStatus("idle");
    pushLog("— port closed");
  };

  // unplugged detection
  useEffect(() => {
    const nav = navigator as NavWithSerial;
    const onDisconnect = (e: Event) => {
      if ((e.target as unknown as SerialPortLike) === portRef.current) {
        keepReading.current = false;
        portRef.current = null;
        setPortInfo(null);
        setStatus("idle");
        pushLog("! BMS disconnected (cable removed)");
      }
    };
    nav.serial?.addEventListener("disconnect", onDisconnect);
    return () => nav.serial?.removeEventListener("disconnect", onDisconnect);
  }, []);

  // ---- demo stream (no hardware needed) ----
  useEffect(() => {
    if (!demoOn || status === "connected") return;
    const cap = design.capacityAh || 4;
    const soc0 = 0.8;
    let k = 0;
    const iv = setInterval(() => {
      const soc = Math.max(0.05, soc0 - (k++ * 0.5) / 3600); // ~1C hour scaled
      const vCell = design.vmin + (design.vmax - design.vmin) * (0.15 + 0.85 * soc);
      const f: HwFrame = {
        t: Date.now(),
        vPack: vCell * pack.series,
        vCell,
        i: cap * 1 + Math.sin(k / 6) * cap * 0.05,
        soc: soc * 100,
        tMax: 25 + 11 * (1 - Math.exp(-k / 40)) + Math.sin(k / 9) * 0.3,
        tMin: 25 + 8 * (1 - Math.exp(-k / 40)) + Math.sin(k / 7) * 0.3,
      };
      framesRx.current += 1;
      setParsed(f);
      setHistory((h) => [...h.slice(-239), f]);
      pushLog(`${new Date().toLocaleTimeString()}  RX $BMS,${f.vPack?.toFixed(1)},${f.vCell?.toFixed(3)},${f.i?.toFixed(2)},${f.soc?.toFixed(1)},${f.tMax?.toFixed(1)},${f.tMin?.toFixed(1)}*7A  (demo)`);
      setStats({ bytes: bytesRx.current + k * 64, frames: framesRx.current });
    }, 500);
    return () => clearInterval(iv);
  }, [demoOn, status, design.capacityAh, design.vmin, design.vmax, pack.series]);

  // ---- derived display values ----
  const h0 = history.length ? history[0].t : 0;
  const chartData = history.map((f) => ({
    t: Math.round((f.t - h0) / 1000),
    vPack: f.vPack,
    tMax: f.tMax,
  }));
  const power = parsed && parsed.vPack != null && parsed.i != null ? parsed.vPack * parsed.i : null;
  const dt = parsed && parsed.tMax != null && parsed.tMin != null ? parsed.tMax - parsed.tMin : null;
  const vid = portInfo?.usbVendorId != null ? `VID ${portInfo.usbVendorId.toString(16).padStart(4, "0")}` : null;
  const pid = portInfo?.usbProductId != null ? `PID ${portInfo.usbProductId.toString(16).padStart(4, "0")}` : null;

  const statusChip =
    status === "connected" ? (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40">
        <ShieldCheck className="h-3 w-3 mr-1" /> CONNECTED {vid ? `· ${vid}${pid ? ` ${pid}` : ""}` : ""}
      </Badge>
    ) : status === "connecting" ? (
      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 animate-pulse">OPENING PORT…</Badge>
    ) : status === "unsupported" ? (
      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
        <TriangleAlert className="h-3 w-3 mr-1" /> WEB SERIAL UNAVAILABLE
      </Badge>
    ) : (
      <Badge variant="outline" className="text-muted-foreground">NOT CONNECTED</Badge>
    );

  return (
    <div className="space-y-4">
      {/* protocol picker */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {PROTOS.map((p) => (
          <button
            key={p.id}
            onClick={() => setProto(p.id)}
            className={cn(
              "text-left rounded-lg border p-3 transition-all hover:shadow-sm",
              proto === p.id ? "border-primary bg-primary/[0.05] ring-1 ring-primary" : "bg-card"
            )}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="text-primary">{p.icon}</span> {p.label}
            </div>
            <div className="text-[11px] font-medium text-foreground/80 mt-1">{p.phy}</div>
            <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{p.note}</div>
          </button>
        ))}
      </div>

      {/* connection row */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap items-center gap-2.5">
          <Usb className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-semibold">COM port</span>
          <Select value={String(baud)} onValueChange={(v) => setBaud(Number(v))}>
            <SelectTrigger className="h-8 w-[130px]" aria-label="Baud rate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BAUDS.map((b) => (
                <SelectItem key={b} value={String(b)}>{b} baud</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {status === "connected" ? (
            <Button size="sm" variant="destructive" onClick={disconnect}>
              <Square className="h-3.5 w-3.5 mr-1" /> Disconnect
            </Button>
          ) : (
            <Button size="sm" onClick={connect} disabled={status === "connecting"} className="bg-primary hover:bg-primary/90">
              <Usb className="h-3.5 w-3.5 mr-1" /> Select COM port &amp; connect
            </Button>
          )}
          {statusChip}
          {!demoOn && status !== "connected" && (
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => setDemoOn(true)}>
              <Play className="h-3.5 w-3.5 mr-1" /> No BMS at hand? Stream demo frames
            </Button>
          )}
          {demoOn && (
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => setDemoOn(false)}>
              <Square className="h-3.5 w-3.5 mr-1" /> Stop demo stream
            </Button>
          )}
          {status === "unsupported" && (
            <p className="w-full text-[11px] text-amber-700 dark:text-amber-300">
              The Web Serial API needs Chrome, Edge or Opera (HTTPS or localhost). Open BatteryLab there to talk to real hardware — meanwhile the demo stream exercises the full pipeline.
            </p>
          )}
        </CardContent>
      </Card>

      {/* live values from frames */}
      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <Cpu className="h-4 w-4 text-primary" /> Live BMS telemetry
          <span className="text-[11px] font-normal text-muted-foreground">— {design.name || design.chemistry} · {pack.series}S{pack.parallel}P</span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatCard label="Pack voltage" value={parsed?.vPack != null ? parsed.vPack.toFixed(1) : "—"} unit={parsed?.vPack != null ? "V" : undefined} />
          <StatCard label="Cell voltage" value={parsed?.vCell != null ? parsed.vCell.toFixed(3) : "—"} unit={parsed?.vCell != null ? "V" : undefined} />
          <StatCard label="Current" value={parsed?.i != null ? Math.abs(parsed.i).toFixed(2) : "—"} unit={parsed?.i != null ? "A" : undefined} hint={parsed?.i != null ? (parsed.i >= 0 ? "discharge" : "charge") : undefined} />
          <StatCard label="SOC" value={parsed?.soc != null ? parsed.soc.toFixed(1) : "—"} unit={parsed?.soc != null ? "%" : undefined} />
          <StatCard label="Power" value={power != null ? Math.abs(power).toFixed(0) : "—"} unit={power != null ? "W" : undefined} />
          <StatCard label="T max" value={parsed?.tMax != null ? parsed.tMax.toFixed(1) : "—"} unit={parsed?.tMax != null ? "°C" : undefined} tone={parsed?.tMax != null && parsed.tMax > 60 ? "fail" : parsed?.tMax != null && parsed.tMax > 45 ? "warn" : "default"} />
          <StatCard label="T min" value={parsed?.tMin != null ? parsed.tMin.toFixed(1) : "—"} unit={parsed?.tMin != null ? "°C" : undefined} />
          <StatCard label="ΔT spread" value={dt != null ? dt.toFixed(1) : "—"} unit={dt != null ? "K" : undefined} tone={dt != null && dt > 5 ? "warn" : "default"} />
        </div>
      </div>

      {/* streaming chart + raw log */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[13px] font-semibold">Stream — pack V &amp; T max (from frames)</h3>
            <span className="text-[11px] text-muted-foreground tabular-nums">{stats.frames} frames · {(stats.bytes / 1024).toFixed(1)} kB RX</span>
          </div>
          <div className="h-56">
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="t" tick={{ fontSize: 11 }} unit=" s" />
                  <YAxis yAxisId="v" tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                  <YAxis yAxisId="t" orientation="right" tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                  <Tooltip labelFormatter={(l) => `t = ${l} s`} />
                  <Legend />
                  <Line yAxisId="v" type="monotone" dataKey="vPack" name="Pack V" stroke={CHART_COLORS.blue} dot={false} strokeWidth={2} />
                  <Line yAxisId="t" type="monotone" dataKey="tMax" name="T max °C" stroke={CHART_COLORS.red} dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">
                Waiting for frames — connect a BMS or start the demo stream.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[13px] font-semibold">Raw frame log (RX)</h3>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant={logPaused ? "default" : "outline"} className="h-7 px-2 text-[10px]" onClick={() => setLogPaused((v) => !v)}>
                {logPaused ? "paused" : "pause"}
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => { setLog([]); setHistory([]); setParsed(null); }}>
                clear
              </Button>
            </div>
          </div>
          <div className="h-56 overflow-y-auto rounded-md bg-slate-950 p-2.5 font-mono text-[10.5px] leading-relaxed text-emerald-300/90">
            {log.length === 0 ? (
              <span className="text-slate-500">— no frames yet —</span>
            ) : (
              log.map((l, i) => (
                <div key={i} className={cn("whitespace-pre-wrap break-all", l.startsWith("!") && "text-red-400", l.startsWith("—") && "text-slate-400")}>
                  {l}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* what the monitor reads — register map reference */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> What BatteryLab monitors over the BMS link</CardTitle>
          <CardDescription>
            Every parameter a pack BMS must expose — mapped per protocol so you can wire your BMS firmware to it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {[
              "Pack voltage", "Cell V min / avg / max", "Pack current", "Power", "SOC", "SOH", "Remaining capacity (Ah)",
              "T min / avg / max", "ΔT spread", "Cycle count", "Contactor / MOS state", "Balancing status",
              "Protection flags: OVP · UVP · OCP · OTP · SCP", "Timestamp",
            ].map((c) => (
              <span key={c} className="rounded-full border bg-muted/50 px-2.5 py-1 text-[11px] text-foreground/90">{c}</span>
            ))}
          </div>
          <div className="grid md:grid-cols-3 gap-3 text-[11px] leading-relaxed">
            <div className="rounded-lg bg-muted/60 p-3">
              <div className="font-semibold text-foreground mb-1">UART frame</div>
              <code className="block font-mono text-[10px] text-emerald-700 dark:text-emerald-300 break-all">$BMS,58.4,3.653,12.0,80.0,31.2,29.8*7A</code>
              <span className="text-muted-foreground">vPack · vCell · I · SOC · tMax · tMin — parsed live above.</span>
            </div>
            <div className="rounded-lg bg-muted/60 p-3">
              <div className="font-semibold text-foreground mb-1">CAN (J1939-style)</div>
              <code className="block font-mono text-[10px] text-emerald-700 dark:text-emerald-300">0x100 V/I · 0x101 SOC/limits · 0x102 temps</code>
              <span className="text-muted-foreground">Broadcast PGNs; binary frames appear in the RX log (hex).</span>
            </div>
            <div className="rounded-lg bg-muted/60 p-3">
              <div className="font-semibold text-foreground mb-1">RS485 · Modbus RTU</div>
              <code className="block font-mono text-[10px] text-emerald-700 dark:text-emerald-300">01 04 00 00 00 08 B0 0C</code>
              <span className="text-muted-foreground">Input registers 0x0000+ (V, I, SOC, T…) — responses in the RX log.</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
