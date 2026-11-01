import { createPortal } from "react-dom";
import type { CSSProperties, ReactNode } from "react";

export type AutocompleteOption = { id: string; label: string; secondaryLabel?: string };

export function AutocompleteListbox({ id, label, options, active, style, onChoose, emptyMessage, renderOption }: {
  id: string; label: string; options: AutocompleteOption[]; active: number; style: CSSProperties;
  onChoose: (index: number) => void; emptyMessage: string; renderOption?: (option: AutocompleteOption, selected: boolean) => ReactNode;
}) {
  return createPortal(<div className="stop-suggestions autocomplete-portal" id={id} role="listbox" aria-label={label} style={style}>
    {options.length ? options.map((option, index) => <button type="button" role="option" aria-selected={active === index} id={`${id}-${index}`} key={option.id} onMouseDown={(event) => event.preventDefault()} onClick={() => onChoose(index)}>
      {renderOption ? renderOption(option, active === index) : <>{option.label}{option.secondaryLabel && <small>{option.secondaryLabel}</small>}</>}
    </button>) : <div className="stop-suggestions-empty">{emptyMessage}</div>}
  </div>, document.body);
}
