"use client";

export function Checkbox({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return <input type="checkbox" checked={checked} onChange={(e) => onCheckedChange(e.target.checked)} />;
}
