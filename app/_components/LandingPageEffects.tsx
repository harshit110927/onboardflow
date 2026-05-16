"use client";

import { useEffect } from "react";

type LandingPageEffectsProps = {
  rootId: string;
};

// This component keeps all browser-only behavior out of app/page.tsx. The landing markup is
// rendered from the static v2 HTML prototype, then this effect progressively enhances it with
// scroll reveal animations, the sticky nav shadow, animated funnel bars, stat counters, and
// code-line reveal. Theme switching was intentionally removed so the page always uses indigo.
export function LandingPageEffects({ rootId }: LandingPageEffectsProps) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;

    // Force the only supported palette on the landing shell. This prevents stale localStorage
    // values from earlier prototypes from changing the visual theme.
    root.setAttribute("data-theme", "indigo");

    const nav = root.querySelector<HTMLElement>("#nav");
    const handleScroll = () => nav?.classList.toggle("scrolled", window.scrollY > 20);

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    const waitlistForm = root.querySelector<HTMLFormElement>("#waitlistForm");
    const waitlistEmail = root.querySelector<HTMLInputElement>("#waitlistEmail");
    const waitlistMessage = root.querySelector<HTMLElement>("#waitlistMessage");
    const waitlistButton = waitlistForm?.querySelector<HTMLButtonElement>('button[type="submit"]');

    const setWaitlistMessage = (message: string, state: "ok" | "error" | "idle" = "idle") => {
      if (!waitlistMessage) return;
      waitlistMessage.textContent = message;
      waitlistMessage.classList.toggle("ok", state === "ok");
      waitlistMessage.classList.toggle("error", state === "error");
    };

    const handleWaitlistSubmit = async (event: SubmitEvent) => {
      event.preventDefault();

      const email = waitlistEmail?.value.trim() ?? "";
      if (!email) {
        setWaitlistMessage("Enter your email to join the waitlist.", "error");
        return;
      }

      if (waitlistButton) waitlistButton.disabled = true;
      setWaitlistMessage("Joining…");

      try {
        const response = await fetch("/api/waitlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const payload = (await response.json().catch(() => ({}))) as { message?: string; error?: string };

        if (!response.ok) {
          setWaitlistMessage(payload.error ?? "Unable to join right now. Please try again.", "error");
          return;
        }

        setWaitlistMessage(payload.message ?? "You are on the waitlist.", "ok");
        waitlistForm?.reset();
      } catch {
        setWaitlistMessage("Unable to join right now. Please try again.", "error");
      } finally {
        if (waitlistButton) waitlistButton.disabled = false;
      }
    };

    waitlistForm?.addEventListener("submit", handleWaitlistSubmit);

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
      waitlistForm?.removeEventListener("submit", handleWaitlistSubmit);
      window.removeEventListener("scroll", handleScroll);
      revealObserver.disconnect();
      funnelObserver.disconnect();
      statObserver.disconnect();
      codeObserver.disconnect();
    };
  }, [rootId]);

  return null;
}
