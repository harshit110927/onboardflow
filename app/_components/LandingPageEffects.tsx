"use client";

import { useEffect } from "react";

type LandingPageEffectsProps = {
  rootId: string;
};

const THEMES: Record<string, { name: string }> = {
  indigo: { name: "Indigo" },
  midnight: { name: "Midnight" },
  ember: { name: "Ember" },
  nord: { name: "Nord" },
};

// This component keeps all browser-only behavior out of app/page.tsx. The landing markup is
// rendered from the static v2 HTML prototype, then this effect progressively enhances it with
// the same behavior that existed in the prototype script: theme selection, reveal animations,
// animated funnel bars, and stat counters.
export function LandingPageEffects({ rootId }: LandingPageEffectsProps) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;

    // Query inside the landing root only so these enhancements never attach to dashboard/login
    // elements that might happen to reuse the same IDs or class names in the future.
    const themeBtn = root.querySelector<HTMLButtonElement>("#themeBtn");
    const themePanel = root.querySelector<HTMLElement>("#themePanel");
    const themeName = root.querySelector<HTMLElement>("#themeName");
    const themeOptions = Array.from(root.querySelectorAll<HTMLButtonElement>(".theme-opt"));

    const applyTheme = (theme: string) => {
      if (!THEMES[theme] || !themeName) return;

      root.setAttribute("data-theme", theme);
      themeName.textContent = THEMES[theme].name;
      window.localStorage.setItem("of-theme", theme);

      themeOptions.forEach((option) => {
        const active = option.dataset.theme === theme;
        option.classList.toggle("active", active);
        option.setAttribute("aria-selected", String(active));
      });
    };

    // Match the supplied prototype exactly on first render: data-theme="indigo".
    // Users can still preview other palettes during the session via the theme picker.
    applyTheme("indigo");

    const closeThemePanel = () => {
      themePanel?.classList.remove("open");
      themeBtn?.setAttribute("aria-expanded", "false");
    };

    const handleThemeButtonClick = (event: MouseEvent) => {
      event.stopPropagation();
      const open = Boolean(themePanel?.classList.toggle("open"));
      themeBtn?.setAttribute("aria-expanded", String(open));
    };

    const themeOptionCleanups = themeOptions.map((option) => {
      const handler = () => {
        applyTheme(option.dataset.theme || "indigo");
        closeThemePanel();
      };
      option.addEventListener("click", handler);
      return () => option.removeEventListener("click", handler);
    });

    themeBtn?.addEventListener("click", handleThemeButtonClick);

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!themeBtn?.contains(target) && !themePanel?.contains(target)) closeThemePanel();
    };

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeThemePanel();
    };

    const nav = root.querySelector<HTMLElement>("#nav");
    const handleScroll = () => nav?.classList.toggle("scrolled", window.scrollY > 20);

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleKeydown);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    const revealEls = Array.from(root.querySelectorAll<HTMLElement>(".reveal, .reveal-l, .reveal-r"));
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    revealEls.forEach((element) => revealObserver.observe(element));

    const funnelEl = root.querySelector<HTMLElement>("#funnelSteps");
    let funnelDone = false;
    const funnelObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !funnelDone) {
          funnelDone = true;
          root.querySelectorAll<HTMLElement>(".f-bar").forEach((bar, index) => {
            window.setTimeout(() => bar.classList.add("animated"), index * 120);
          });
          funnelObserver.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    if (funnelEl) funnelObserver.observe(funnelEl);

    const animateCount = (element: HTMLElement, to: number, suffix = "") => {
      const duration = 1400;
      const start = performance.now();

      const tick = (now: number) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - (1 - progress) ** 4;
        element.textContent = `${Math.round(eased * to)}${suffix}`;
        if (progress < 1) requestAnimationFrame(tick);
        else element.textContent = `${to}${suffix}`;
      };

      requestAnimationFrame(tick);
    };

    const statEls = Array.from(root.querySelectorAll<HTMLElement>(".stat-num[data-count]"));
    const statObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement;
            animateCount(element, Number.parseInt(element.dataset.count || "0", 10), element.dataset.suffix || "");
            statObserver.unobserve(element);
          }
        });
      },
      { threshold: 0.5 },
    );
    statEls.forEach((element) => statObserver.observe(element));

    const codeBlock = root.querySelector<HTMLElement>("#codeBlock");
    let codeDone = false;
    const codeObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !codeDone && codeBlock) {
          codeDone = true;
          codeBlock.querySelectorAll<HTMLElement>(".cl").forEach((line, index) => {
            window.setTimeout(() => {
              line.style.animationDelay = "0ms";
              line.classList.add("in-view");
            }, index * 55);
          });
          codeObserver.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    if (codeBlock) codeObserver.observe(codeBlock);

    return () => {
      themeBtn?.removeEventListener("click", handleThemeButtonClick);
      themeOptionCleanups.forEach((cleanup) => cleanup());
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("scroll", handleScroll);
      revealObserver.disconnect();
      funnelObserver.disconnect();
      statObserver.disconnect();
      codeObserver.disconnect();
    };
  }, [rootId]);

  return null;
}
