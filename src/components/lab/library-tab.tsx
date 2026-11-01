"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Search, Zap, ArrowRight } from "lucide-react";
import { useLabStore } from "@/lib/lab/store";
import { LIBRARY_CELLS, LIBRARY_CATEGORIES, type LibraryCell } from "@/lib/lab/library";
import { SectionTitle } from "./shared";
import { cn } from "@/lib/utils";

export function LibraryTab() {
  const { loadLibraryCell, setActiveTab } = useLabStore();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [detail, setDetail] = useState<LibraryCell | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LIBRARY_CELLS.filter((c) => {
      if (category !== "All" && c.category !== category) return false;
      if (!q) return true;
      return [c.brand, c.model, c.chemistry, c.formFactor, c.application]
        .join(" ").toLowerCase().includes(q);
    });
  }, [query, category]);

  const use = (cell: LibraryCell) => {
    loadLibraryCell(cell);
    setActiveTab("design");
    toast({
      title: "Loaded into Design",
      description: `${cell.brand} ${cell.model} — every value is now editable in the Design tab.`,
    });
  };

  return (
    <div className="space-y-5">
      <SectionTitle
        icon={<BookOpen className="h-5 w-5" />}
        title="Cell Library"
        desc="24 real datasheet cells — open one and load it into the Design tab as an editable starting point."
      />

      {/* Search + categories */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search brand, model, chemistry…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search the cell library"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["All", ...LIBRARY_CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                category === cat
                  ? "border-primary bg-primary text-white"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {cat}
              {cat !== "All" && (
                <span className="ml-1 opacity-60">{LIBRARY_CELLS.filter((c) => c.category === cat).length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No cells match “{query}”.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {filtered.map((c) => (
            <CellCard key={c.id} cell={c} onOpen={() => setDetail(c)} onUse={() => use(c)} />
          ))}
        </div>
      )}

      {/* Details dialog */}
      <Dialog open={detail !== null} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">{detail.brand} {detail.model}</DialogTitle>
                <DialogDescription>
                  {detail.chemistry} · {detail.formFactor} · {detail.application}
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-2.5 text-sm">
                <Spec label="Capacity" value={`${detail.capacityAh} Ah`} />
                <Spec label="Nominal voltage" value={`${detail.nominalV} V`} />
                <Spec label="Voltage window" value={`${detail.vmin}–${detail.vmax} V`} />
                <Spec label="R₀ (1 kHz, est.)" value={`${(detail.r0 * 1000).toFixed(1)} mΩ`} />
                <Spec label="Max discharge" value={`${detail.maxDischargeC}C${detail.maxPulseDischargeC > 0 ? ` · ${detail.maxPulseDischargeC}C pulse` : ""}`} />
                <Spec label="Charge" value={`std ${detail.stdChargeC}C · max ${detail.maxChargeC}C`} />
                <Spec label="Mass" value={`${(detail.massKg * 1000).toFixed(detail.massKg < 0.1 ? 1 : 0)} g`} />
                <Spec label="Cycle life" value={`${detail.cycleLifeCycles.toLocaleString()} cycles`} />
                <Spec label="Charge temp" value={`${detail.chargeTempMinC}…${detail.chargeTempMaxC} °C`} />
                <Spec label="Discharge temp" value={`${detail.dischargeTempMinC}…${detail.dischargeTempMaxC} °C`} />
                <Spec label="Cathode" value={detail.cathode} />
                <Spec label="Anode" value={detail.anode} />
                <Spec label="Separator" value={detail.separator} />
                <Spec label="Electrolyte" value={detail.electrolyte} />
                <div className="col-span-2">
                  <Spec label="Source" value={detail.sourceRef} />
                </div>
                {detail.cycleLifeNote && (
                  <div className="col-span-2">
                    <Spec label="Cycle-life condition" value={detail.cycleLifeNote} />
                  </div>
                )}
              </div>
              <Button className="w-full bg-primary hover:bg-primary/90" onClick={() => { use(detail); setDetail(null); }}>
                <Zap className="h-4 w-4 mr-1.5" /> Use in Design <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/60 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-[13px] font-medium leading-snug">{value}</div>
    </div>
  );
}

function CellCard({ cell, onOpen, onUse }: { cell: LibraryCell; onOpen: () => void; onUse: () => void }) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <button className="text-left w-full" onClick={onOpen} aria-label={`Open ${cell.brand} ${cell.model} details`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] text-muted-foreground truncate">{cell.brand}</div>
              <div className="font-semibold text-sm truncate">{cell.model}</div>
            </div>
            <Badge variant="secondary" className="text-[10px] shrink-0">{cell.chemistry}</Badge>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
            <span><b className="text-foreground">{cell.capacityAh}</b> Ah</span>
            <span><b className="text-foreground">{cell.nominalV}</b> V</span>
            <span><b className="text-foreground">{cell.maxDischargeC}</b>C max</span>
          </div>
          <div className="mt-1.5 text-[11px] text-muted-foreground truncate">{cell.formFactor}</div>
        </button>
        <Button size="sm" variant="outline" className="w-full mt-3 h-8" onClick={onUse}>
          <Zap className="h-3.5 w-3.5 mr-1 text-primary" /> Use in Design
        </Button>
      </CardContent>
    </Card>
  );
}
