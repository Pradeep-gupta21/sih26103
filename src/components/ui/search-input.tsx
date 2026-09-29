"use client";

import { Search, X } from "lucide-react";
import type { InputHTMLAttributes } from "react";

/** Compact search field with an inset icon and a clear control; ~320px, never full width. */
export function SearchInput({ value, onChange, onClear, className = "", ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & { value: string; onChange: (value: string) => void; onClear?: () => void }) {
  return (
    <div className={`search-input ${className}`.trim()}>
      <Search size={14} aria-hidden="true" />
      <input {...rest} type="search" value={value} onChange={(event) => onChange(event.target.value)} />
      {value && onClear && <button type="button" onClick={onClear} aria-label="Clear search"><X size={14} /></button>}
    </div>
  );
}
