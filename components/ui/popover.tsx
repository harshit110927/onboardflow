"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Popover({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) {
  return <div className="relative inline-block">{React.Children.map(children, (child) => React.isValidElement(child) ? React.cloneElement(child as React.ReactElement<any>, { open, onOpenChange }) : child)}</div>;
}

export function PopoverTrigger({ asChild, children, open, onOpenChange }: any) {
  if (asChild && React.isValidElement(children)) return React.cloneElement(children, { onClick: () => onOpenChange?.(!open) });
  return <button onClick={() => onOpenChange?.(!open)}>{children}</button>;
}

export function PopoverContent({ open, className, children }: any) {
  if (!open) return null;
  return <div className={cn("absolute z-40 mt-2 w-72 rounded-md border border-border bg-background p-3 shadow-lg", className)}>{children}</div>;
}
