import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { AutocompleteListbox } from "@/components/AutocompleteListbox";
import { WBTC_ROUTES, normalizeRoute } from "@/wbtc-routes";

const ROUTES = Array.from(new Map(WBTC_ROUTES.map((route) => [normalizeRoute(route.route), route.route])).entries()).map(([id, label]) => ({ id, label }));
export function RouteTagAutocomplete({ value, onChange }: { value: string; onChange: (route: string) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const [query, setQuery] = useState("");
  const options = useMemo(() => {
    const normalized = normalizeRoute(query);
    return ROUTES.filter((route) => !normalized || normalizeRoute(route.label).includes(normalized)).map((route) => ({ ...route, secondaryLabel: "WBTC route" }));
  }, [query]);
  const measure = () => {
    const input = root.current?.querySelector("input"); if (!input) return;
    const rect = input.getBoundingClientRect();
    setPosition({ left: rect.left, top: rect.bottom + 6, width: rect.width, maxHeight: Math.max(110, window.innerHeight - rect.bottom - 16) });
  };
  useEffect(() => {
    if (!open) return;
    measure();
    const update = () => measure();
    const outside = (event: PointerEvent) => { const target = event.target as Element; if (!root.current?.contains(target) && !target.closest?.(".autocomplete-portal")) setOpen(false); };
    window.addEventListener("resize", update); window.addEventListener("scroll", update, true); document.addEventListener("pointerdown", outside);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); document.removeEventListener("pointerdown", outside); };
  }, [open]);
  const select = (index: number) => { const selected = options[index]; if (selected) { onChange(selected.label); setQuery(""); setOpen(false); } };
  return <div className="chat-route-picker" ref={root}>
    <label htmlFor="chat-route-input">Tag a bus route (optional)</label>
    {value ? <div className="route-tag-selected"><span className="route-tag">{value}</span><button type="button" aria-label="Clear route tag" onClick={() => onChange("")}><X size={14} /> Clear</button></div> : <input id="chat-route-input" value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true); }} placeholder="Select a route if applicable..." role="combobox" aria-expanded={open} aria-autocomplete="list" aria-controls="chat-route-options" onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); else if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => Math.min(index + 1, options.length - 1)); } else if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)); } else if (event.key === "Enter" && options.length) { event.preventDefault(); select(active); } }} />}
    {open && !value && position && <AutocompleteListbox id="chat-route-options" label="WBTC route suggestions" options={options} active={active} style={position} onChoose={select} emptyMessage="No matching WBTC route found." />}
  </div>;
}
