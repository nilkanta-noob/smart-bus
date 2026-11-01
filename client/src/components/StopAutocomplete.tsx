import { useEffect, useId, useMemo, useRef, useState } from "react";
import { MapPin, Navigation } from "lucide-react";
import { AutocompleteListbox } from "@/components/AutocompleteListbox";
import { searchWbtcStops, type SelectedStop } from "@/lib/stop-search";

type Position = { left: number; top: number; width: number; maxHeight: number };
export function StopAutocomplete({ kind, value, onSelect, onClear }: { kind: "origin" | "destination"; value: string; onSelect: (stop: SelectedStop) => void; onClear: () => void }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<Position | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const options = useMemo(() => searchWbtcStops(value), [value]);
  const listId = `${id}-suggestions`;
  const measure = () => {
    const input = root.current?.querySelector("input");
    if (!input) return;
    const rect = input.getBoundingClientRect();
    setPosition({ left: rect.left, top: rect.bottom + 6, width: rect.width, maxHeight: Math.max(110, window.innerHeight - rect.bottom - 16) });
  };
  useEffect(() => {
    if (!open || !value.trim()) return;
    measure();
    const update = () => measure();
    window.addEventListener("resize", update); window.addEventListener("scroll", update, true);
    const outside = (event: PointerEvent) => {
      const target = event.target as Element;
      if (!root.current?.contains(target) && !target.closest?.(".autocomplete-portal")) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    const peer = (event: Event) => { if ((event as CustomEvent<string>).detail !== kind) setOpen(false); };
    document.addEventListener("smartbus:autocomplete-open", peer);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); document.removeEventListener("pointerdown", outside); document.removeEventListener("smartbus:autocomplete-open", peer); };
  }, [open, value, kind]);
  const choose = (index: number) => { const option = options[index]; if (option) { onSelect(option); setOpen(false); setActive(0); } };
  const openDropdown = () => { document.dispatchEvent(new CustomEvent("smartbus:autocomplete-open", { detail: kind })); setOpen(true); };
  const show = open && Boolean(value.trim());
  return <div className="trip-input autocomplete-input" ref={root}>
    {kind === "origin" ? <MapPin size={17} /> : <Navigation size={17} />}
    <input role="combobox" aria-label={kind === "origin" ? "Origin stop" : "Destination stop"} aria-autocomplete="list" aria-expanded={show} aria-controls={listId} aria-activedescendant={show && options[active] ? `${listId}-${active}` : undefined}
      value={value} onFocus={openDropdown} onChange={(event) => { onClear(); onSelect({ stopId: "", name: event.target.value }); openDropdown(); setActive(0); }}
      onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); return; } if (!open) return; if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => Math.min(index + 1, options.length - 1)); } else if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => Math.max(0, index - 1)); } else if (event.key === "Enter" && options.length) { event.preventDefault(); choose(active); } }}
      placeholder={kind === "origin" ? "Starting point · e.g. Garia, Howrah, Jadavpur..." : "Destination · e.g. Esplanade, Salt Lake, Airport..."} />
    {show && position && <AutocompleteListbox id={listId} label={`${kind} WBTC stops`} options={options.map((stop) => ({ id: stop.stopId, label: stop.name }))} active={active} style={{ left: position.left, top: position.top, width: position.width, maxHeight: position.maxHeight }} onChoose={choose} emptyMessage="No matching WBTC stoppage found." />}
  </div>;
}
