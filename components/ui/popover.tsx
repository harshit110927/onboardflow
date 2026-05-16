"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

type PopoverContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
};

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

export function Popover({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const triggerRef = React.useRef<HTMLElement>(null);

  return (
    <PopoverContext.Provider value={{ open, onOpenChange, triggerRef }}>
      <span className="inline-block">{children}</span>
    </PopoverContext.Provider>
  );
}

export function PopoverTrigger({ asChild, children }: { asChild?: boolean; children: React.ReactNode }) {
  const context = React.useContext(PopoverContext);
  if (!context) return null;

  const togglePopover = () => context.onOpenChange(!context.open);

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<any>;

    return React.cloneElement(child, {
      ref: context.triggerRef,
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        child.props.onClick?.(event);
        togglePopover();
      },
    });
  }

  return (
    <button ref={context.triggerRef as React.RefObject<HTMLButtonElement>} type="button" onClick={togglePopover}>
      {children}
    </button>
  );
}

export function PopoverContent({ className, children }: { className?: string; children: React.ReactNode }) {
  const context = React.useContext(PopoverContext);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);
  const [position, setPosition] = React.useState({ top: 0, left: 0 });

  React.useEffect(() => setMounted(true), []);

  React.useLayoutEffect(() => {
    if (!context?.open || !context.triggerRef.current) return;

    const updatePosition = () => {
      const triggerRect = context.triggerRef.current?.getBoundingClientRect();
      if (!triggerRect) return;

      const contentRect = contentRef.current?.getBoundingClientRect();
      const contentWidth = contentRect?.width ?? 288;
      const contentHeight = contentRect?.height ?? 0;
      const viewportPadding = 12;
      const gap = 8;

      const maxLeft = window.innerWidth - contentWidth - viewportPadding;
      const nextLeft = Math.min(Math.max(triggerRect.left, viewportPadding), Math.max(maxLeft, viewportPadding));
      const spaceBelow = window.innerHeight - triggerRect.bottom - viewportPadding;
      const shouldOpenAbove = contentHeight > 0 && spaceBelow < contentHeight + gap && triggerRect.top > contentHeight + gap;
      const nextTop = shouldOpenAbove ? triggerRect.top - contentHeight - gap : triggerRect.bottom + gap;

      setPosition({ top: Math.max(nextTop, viewportPadding), left: nextLeft });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [context?.open, context?.triggerRef]);

  if (!context?.open || !mounted) return null;

  return createPortal(
    <div
      ref={contentRef}
      className={cn("fixed z-[9999] w-72 rounded-md border border-border bg-background p-3 shadow-lg", className)}
      style={{ top: position.top, left: position.left }}
    >
      {children}
    </div>,
    document.body,
  );
}
