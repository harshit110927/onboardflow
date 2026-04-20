"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Sheet({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) {
  return <>{React.Children.map(children, (child) => React.isValidElement(child) ? React.cloneElement(child as React.ReactElement<any>, { open, onOpenChange }) : child)}</>;
}

export function SheetTrigger({ asChild, children, onOpenChange }: any) {
  if (asChild && React.isValidElement(children)) return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
  onClick: () => onOpenChange?.(true),
});
  return <button onClick={() => onOpenChange?.(true)}>{children}</button>;
}

export function SheetContent({ open, onOpenChange, side = "right", className, children }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={() => onOpenChange?.(false)}>
      <div className={cn(`absolute top-0 h-full w-full max-w-md border-border bg-background p-6 ${side === "right" ? "right-0 border-l" : "left-0 border-r"}`, className)} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4", className)} {...props} />;
}
export function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-semibold", className)} {...props} />;
}
