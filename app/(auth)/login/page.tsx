import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { login, signInWithGoogle } from "@/app/actions";
import { TierChips } from "@/app/_components/TierChips";

// This page now owns the auth experience that used to live on the root landing route.
// Keep the visual split-panel layout here so /login remains focused on conversion, while
// app/page.tsx can be a full marketing landing page. Future auth copy, tier chips, and
// provider buttons should be changed in this file rather than the public landing page.

export default async function LoginPage() {
  // Auth pages should not be shown to existing users. Send signed-in users straight
  // to their dashboard before rendering the magic-link / OAuth forms below.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f0effe",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 24px",
      fontFamily: "'DM Sans', sans-serif",
    }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: #f0effe; }
        .field-input { width:100%; height:42px; border:1px solid #e2e0f5; border-radius:8px; padding:0 14px; font-size:14px; font-family:'DM Sans',sans-serif; color:#1e1b4b; background:#fafafa; outline:none; transition:border-color 0.15s; }
        .field-input::placeholder { color:#b0aac8; }
        .field-input:focus { border-color:#818cf8; background:#fff; }
        .btn-main { width:100%; height:42px; background:#6366f1; border:none; border-radius:8px; color:#fff; font-size:14px; font-weight:500; font-family:'DM Sans',sans-serif; cursor:pointer; transition:background 0.15s; margin-top:2px; }
        .btn-main:hover { background:#4338ca; }
        .btn-google { width:100%; height:42px; border:1px solid #e2e0f5; border-radius:8px; background:#fff; color:#1e1b4b; font-size:13.5px; font-family:'DM Sans',sans-serif; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:9px; transition:border-color 0.15s,background 0.15s; }
        .btn-google:hover { border-color:#c4bfef; background:#fafafa; }
        .login-grid { display:grid; grid-template-columns:1.1fr 0.9fr; gap:0; width:100%; max-width:980px; border-radius:16px; overflow:hidden; box-shadow:0 4px 40px rgba(30,27,75,0.13); }
        @media (max-width:860px) { .login-grid { grid-template-columns:1fr; } .left-panel { display:none !important; } }
      `}</style>

      <div className="login-grid">

        {/* ── LEFT PANEL ── */}
        <div className="left-panel" style={{
          background: "#1e1b4b",
          padding: "48px 44px",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
          minHeight: 620,
        }}>

          {/* dot grid */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: "radial-gradient(circle, rgba(129,140,248,0.12) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            pointerEvents: "none",
          }} />

          {/* glow */}
          <div style={{
            position: "absolute", top: -100, right: -100,
            width: 360, height: 360,
            background: "radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />

          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>

            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "auto" }}>
              <div style={{ width: 30, height: 30, background: "#818cf8", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 17 17" fill="none">
                  <path d="M3 8.5h11M8.5 3v11" stroke="#1e1b4b" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </div>
              <span style={{ fontSize: 16, fontWeight: 500, color: "#e0e7ff", letterSpacing: -0.3 }}>OnboardFlow</span>
            </div>

            {/* Hero */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "40px 0 32px" }}>

              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(129,140,248,0.12)", border: "0.5px solid rgba(129,140,248,0.25)", borderRadius: 20, padding: "4px 12px", width: "fit-content", marginBottom: 22 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#818cf8" }} />
                <span style={{ fontSize: 11.5, color: "#a5b4fc" }}>Authentication &amp; onboarding platform</span>
              </div>

              <h1 style={{ fontSize: 30, fontWeight: 300, color: "#e0e7ff", lineHeight: 1.25, letterSpacing: -0.5, marginBottom: 14 }}>
                Onboard and Outreach<br />
                <span style={{ fontWeight: 500, color: "#fff" }}>
                  <em style={{ fontStyle: "normal", color: "#818cf8" }}>one platform</em> for both
                </span>
              </h1>

              <p style={{ fontSize: 13.5, color: "#94a3b8", lineHeight: 1.75, marginBottom: 28 }}>
                Sign-in to drip campaigns and nudges — everything your product needs to activate and retain users, without building it from scratch.
              </p>

              {/* Code block */}
              <div style={{ background: "rgba(0,0,0,0.35)", border: "0.5px solid rgba(129,140,248,0.18)", borderRadius: 10, padding: "14px 16px", marginBottom: 24, fontFamily: "'DM Mono', monospace", fontSize: 12, lineHeight: 1.9 }}>
                <div><span style={{ color: "#6b7fa3" }}>&#47;&#47; 3 lines to protect any route</span></div>
                <div>
                  <span style={{ color: "#818cf8" }}>import</span>
                  {" "}<span style={{ color: "#e0e7ff" }}>{"{onboardMiddleware}"}</span>{" "}
                  <span style={{ color: "#818cf8" }}>from</span>{" "}
                  <span style={{ color: "#34d399" }}>&apos;@onboardflow/sdk&apos;</span>
                </div>
                <div>&nbsp;</div>
                <div>
                  <span style={{ color: "#818cf8" }}>export default</span>{" "}
                  <span style={{ color: "#a5b4fc" }}>onboardMiddleware</span>
                  <span style={{ color: "#e0e7ff" }}>{"({"}</span>
                </div>
                <div>
                  &nbsp;&nbsp;<span style={{ color: "#a5b4fc" }}>redirectTo</span>
                  <span style={{ color: "#e0e7ff" }}>:</span>{" "}
                  <span style={{ color: "#34d399" }}>&apos;/login&apos;</span>
                </div>
                <div><span style={{ color: "#e0e7ff" }}>{"  })"}</span></div>
              </div>

              {/* Feature grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                {[
                  { icon: <path d="M2 3h10M2 7h6M2 11h4" stroke="#818cf8" strokeWidth="1.3" strokeLinecap="round"/>, title: "Automated emails", desc: "Drip sequences on user behaviour" },
                  { icon: <path d="M2 11 L4 7 L7 9 L10 4 L12 6" stroke="#818cf8" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>, title: "Live analytics", desc: "Track signups and activation" },
                  { icon: <><path d="M7 1v2M7 11v2M1 7h2M11 7h2" stroke="#818cf8" strokeWidth="1.3" strokeLinecap="round"/><circle cx="7" cy="7" r="3" stroke="#818cf8" strokeWidth="1.3"/></>, title: "Smart nudges", desc: "Re-engage inactive users" },
                  { icon: <><rect x="1.5" y="3" width="11" height="8" rx="1.5" stroke="#818cf8" strokeWidth="1.3"/><path d="M1.5 5.5h11" stroke="#818cf8" strokeWidth="1.3"/></>, title: "Magic link auth", desc: "Passwordless, zero friction" },
                ].map((f, i) => (
                  <div key={i} style={{ background: "rgba(129,140,248,0.06)", border: "0.5px solid rgba(129,140,248,0.14)", borderRadius: 9, padding: "12px 13px" }}>
                    <div style={{ width: 26, height: 26, background: "rgba(129,140,248,0.14)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">{f.icon}</svg>
                    </div>
                    <p style={{ fontSize: 12, fontWeight: 500, color: "#c7d2fe", marginBottom: 2 }}>{f.title}</p>
                    <span style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{f.desc}</span>
                  </div>
                ))}
              </div>

              {/* Tier cards */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ background: "rgba(129,140,248,0.06)", border: "0.5px solid rgba(129,140,248,0.14)", borderRadius: 9, padding: "12px 13px" }}>
                  <span style={{ display: "inline-block", fontSize: 9.5, fontWeight: 500, letterSpacing: 0.5, textTransform: "uppercase", padding: "2px 7px", borderRadius: 20, marginBottom: 6, background: "rgba(129,140,248,0.18)", color: "#a5b4fc" }}>Enterprise</span>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "#c7d2fe", marginBottom: 3 }}>For developers &amp; teams</p>
                  <span style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>Full SDK, API access, webhooks, and a developer dashboard.</span>
                </div>
                <div style={{ background: "rgba(129,140,248,0.06)", border: "0.5px solid rgba(129,140,248,0.14)", borderRadius: 9, padding: "12px 13px" }}>
                  <span style={{ display: "inline-block", fontSize: 9.5, fontWeight: 500, letterSpacing: 0.5, textTransform: "uppercase", padding: "2px 7px", borderRadius: 20, marginBottom: 6, background: "rgba(52,211,153,0.13)", color: "#34d399" }}>Individual</span>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "#c7d2fe", marginBottom: 3 }}>For small businesses</p>
                  <span style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>No code needed. Build lists, run campaigns, grow your audience.</span>
                </div>
              </div>

            </div>

            {/* Social proof */}
            <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.07)", paddingTop: 20, display: "flex", alignItems: "center", gap: 12 }}>
              <p style={{ fontSize: 12, color: "#94a3b8" }}>
                Used by <span style={{ color: "#818cf8", fontWeight: 500 }}>50+ developers</span> worldwide
              </p>
            </div>

          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ background: "#fff", padding: "48px 44px", display: "flex", flexDirection: "column", justifyContent: "center" }}>

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 44 }}>
            <div style={{ width: 26, height: 26, background: "#6366f1", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7h10M7 2v10" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={{ fontSize: 15, fontWeight: 500, color: "#1e1b4b" }}>OnboardFlow</span>
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 500, color: "#1e1b4b", letterSpacing: -0.4, marginBottom: 5 }}>Welcome back</h2>
          <p style={{ fontSize: 13.5, color: "#64748b", marginBottom: 26 }}>Sign in to your OnboardFlow account</p>

          <TierChips />

          <form action={login} style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor="email" style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@company.com"
                required
                autoComplete="email"
                className="field-input"
              />
            </div>
            <button type="submit" className="btn-main">Continue with email →</button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0" }}>
            <div style={{ flex: 1, height: 1, background: "#ece9ff" }} />
            <span style={{ fontSize: 12, color: "#b0aac8" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "#ece9ff" }} />
          </div>

          <form action={signInWithGoogle}>
            <button type="submit" className="btn-google">
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </form>

          <p style={{ marginTop: 26, fontSize: 12, color: "#b0aac8", textAlign: "center", lineHeight: 1.7 }}>
            By continuing you agree to our{" "}
            <a href="/terms" style={{ color: "#6366f1", textDecoration: "none" }}>Terms</a>
            {" "}&amp;{" "}
            <a href="/privacy" style={{ color: "#6366f1", textDecoration: "none" }}>Privacy Policy</a>
          </p>

        </div>
      </div>
    </div>
  );
}