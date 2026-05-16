import type { Metadata } from "next";
import { LandingPageEffects } from "./_components/LandingPageEffects";

export const metadata: Metadata = {
  title: "Automate SaaS Onboarding Emails & Track Drop-Off | Dripmetric",
  description:
    "Dripmetric tracks where SaaS users get stuck during onboarding and automatically sends drip emails to bring them back. Only 3 lines of code. Free to start.",
  alternates: {
    canonical: "https://dripmetric.com",
  },
  openGraph: {
    type: "website",
    url: "https://dripmetric.com",
    title: "Automate SaaS Onboarding Emails & Track Drop-Off | Dripmetric",
    description:
      "Dripmetric tracks where SaaS users get stuck during onboarding and automatically sends drip emails to bring them back. Only 3 lines of code. Free to start.",
  },
  twitter: {
    card: "summary_large_image",
  },
};

// Keep the copied v2 landing CSS in one named constant so future visual edits are isolated
// from the JSX shell below. Only the indigo palette is intentionally shipped here; do
// not re-add the prototype theme switcher unless the product explicitly supports themes.
const landingStyles = String.raw`
/* ═══════════════════════════════════════════
   INDIGO THEME VARIABLES
   Only the indigo palette is shipped on the landing page.
═══════════════════════════════════════════ */
[data-theme="indigo"] {
  --bg:            #f0effe;
  --bg-alt:        #f5f4fe;
  --surface:       #ffffff;
  --surface-2:     #fafafa;
  --deep:          #1e1b4b;
  --deep-2:        #2a2660;
  --border:        #e2e0f5;
  --divider:       #ece9ff;
  --primary:       #6366f1;
  --primary-h:     #4338ca;
  --primary-rgb:   99,102,241;
  --accent:        #818cf8;
  --accent-soft:   #a5b4fc;
  --accent-pale:   #c7d2fe;
  --accent-palest: #e0e7ff;
  --text:          #1e1b4b;
  --text-muted:    #64748b;
  --text-subtle:   #94a3b8;
  --placeholder:   #b0aac8;
  --on-deep:       #e0e7ff;
  --on-deep-sub:   #a5b4fc;
  --on-deep-muted: #818cf8;
  --emerald:       #34d399;
  --red:           #f87171;
  --nav-bg:        rgba(240,239,254,0.88);
  --shadow:        0 4px 40px rgba(30,27,75,0.13);
  --shadow-sm:     0 2px 14px rgba(30,27,75,0.07);
  --shadow-hov:    0 12px 40px rgba(99,102,241,0.18);
  --code-bg:       rgba(0,0,0,0.28);
  --code-border:   rgba(129,140,248,0.18);
  --glow:          rgba(99,102,241,0.22);
}


/* ═══════════════════════════════════════════
   BASE
═══════════════════════════════════════════ */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;}
.landing-shell{
  font-family:'DM Sans',sans-serif;
  background:var(--bg);
  color:var(--text);
  line-height:1.6;
  font-size:16px;
  overflow-x:hidden;
  transition:background .5s,color .5s;
  -webkit-font-smoothing:antialiased;
  -moz-osx-font-smoothing:grayscale;
  text-rendering:optimizeLegibility;
}
.landing-shell a,
.landing-shell button,
.landing-shell input{
  font-synthesis:none;
}

/* ═══════════════════════════════════════════
   KEYFRAMES
═══════════════════════════════════════════ */
@keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideRight{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:none}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
@keyframes floatB{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-7px) rotate(2deg)}}
@keyframes pulseDot{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:1;transform:scale(1.2)}}
@keyframes glowPulse{0%,100%{box-shadow:0 0 0 0 var(--glow)}50%{box-shadow:0 0 0 10px transparent}}
@keyframes barGrow{from{width:0}to{width:var(--bar-w)}}
@keyframes meshShift{
  0%{background-position:0% 50%}
  50%{background-position:100% 50%}
  100%{background-position:0% 50%}
}
@keyframes codeReveal{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}

/* ═══════════════════════════════════════════
   SCROLL REVEAL
═══════════════════════════════════════════ */
.reveal{
  opacity:0;
  transform:translateY(28px);
  transition:opacity .65s cubic-bezier(.23,1,.32,1),transform .65s cubic-bezier(.23,1,.32,1);
}
.reveal.in-view{opacity:1;transform:none;}
.reveal-l{opacity:0;transform:translateX(-28px);transition:opacity .65s cubic-bezier(.23,1,.32,1),transform .65s cubic-bezier(.23,1,.32,1);}
.reveal-l.in-view{opacity:1;transform:none;}
.reveal-r{opacity:0;transform:translateX(28px);transition:opacity .65s cubic-bezier(.23,1,.32,1),transform .65s cubic-bezier(.23,1,.32,1);}
.reveal-r.in-view{opacity:1;transform:none;}
.d1{transition-delay:.08s}.d2{transition-delay:.16s}.d3{transition-delay:.24s}.d4{transition-delay:.32s}.d5{transition-delay:.40s}.d6{transition-delay:.48s}

/* ═══════════════════════════════════════════
   LAYOUT
═══════════════════════════════════════════ */
.container{max-width:1120px;margin:0 auto;padding:0 24px;}

/* ═══════════════════════════════════════════
   NAV
═══════════════════════════════════════════ */
nav{
  position:sticky;top:0;z-index:200;
  background:var(--nav-bg);
  backdrop-filter:blur(14px);
  border-bottom:1px solid var(--border);
  transition:background .5s,border-color .5s,box-shadow .3s;
}
nav.scrolled{box-shadow:var(--shadow-sm);}
.nav-inner{display:flex;align-items:center;justify-content:space-between;height:62px;gap:20px;}
.nav-logo{display:flex;align-items:center;gap:10px;text-decoration:none;font-weight:600;font-size:1.05rem;color:var(--text);letter-spacing:-.01em;transition:opacity .2s;}
.nav-logo:hover{opacity:.8;}
.nav-logo-icon{
  width:32px;height:32px;
  background:var(--primary);
  border-radius:8px;
  display:grid;place-items:center;
  color:#fff;font-size:.82rem;font-weight:700;flex-shrink:0;
  transition:background .5s;
}
.nav-links{display:flex;align-items:center;gap:26px;list-style:none;}
.nav-links a{text-decoration:none;color:var(--text-muted);font-size:.875rem;font-weight:500;transition:color .2s;}
.nav-links a:hover{color:var(--primary);}
.nav-right{display:flex;align-items:center;gap:10px;}


.btn-ghost{font-family:'DM Sans',sans-serif;font-size:.875rem;font-weight:500;color:var(--text-muted);background:none;border:none;cursor:pointer;text-decoration:none;transition:color .2s;padding:6px 4px;}
.btn-ghost:hover{color:var(--primary);}
.btn-primary{
  font-family:'DM Sans',sans-serif;font-size:.875rem;font-weight:600;
  color:#fff;background:var(--primary);border:none;border-radius:8px;
  padding:10px 20px;cursor:pointer;text-decoration:none;
  transition:background .25s,transform .15s,box-shadow .25s;
  display:inline-flex;align-items:center;gap:6px;line-height:1;
  animation:glowPulse 3s ease-in-out infinite;
}
.btn-primary:hover{background:var(--primary-h);transform:translateY(-2px);box-shadow:0 8px 24px var(--glow);}
.btn-primary-lg{font-size:1rem;padding:14px 32px;border-radius:9px;}
.btn-outline{
  font-family:'DM Sans',sans-serif;font-size:1rem;font-weight:500;
  color:var(--primary);background:transparent;
  border:1.5px solid var(--border);border-radius:9px;
  padding:13px 28px;cursor:pointer;text-decoration:none;
  transition:border-color .2s,background .2s,color .2s;
  display:inline-flex;align-items:center;gap:6px;
}
.btn-outline:hover{border-color:var(--primary);background:var(--divider);}

/* ═══════════════════════════════════════════
   HERO
═══════════════════════════════════════════ */
.hero{padding:96px 0 80px;position:relative;overflow:hidden;}
.hero::before{
  content:'';position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(ellipse 70% 60% at 30% 0%,var(--glow),transparent 60%),
             radial-gradient(ellipse 40% 50% at 80% 80%,var(--glow),transparent 60%);
  animation:meshShift 12s ease infinite;
}
.hero-inner{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center;position:relative;}

.product-hunt-badge{display:inline-flex;margin-bottom:18px;animation:fadeUp .5s ease-out both;}
.product-hunt-badge img{display:block;width:250px;height:54px;}
.hero-badge{
  display:inline-flex;align-items:center;gap:7px;
  background:var(--divider);border:1px solid var(--border);
  border-radius:100px;padding:5px 14px;
  font-size:.77rem;font-weight:600;color:var(--primary);
  letter-spacing:.02em;margin-bottom:20px;
  animation:fadeUp .5s ease-out both;
  transition:background .5s,border-color .5s,color .5s;
}
.badge-dot{width:7px;height:7px;border-radius:50%;background:var(--emerald);animation:pulseDot 2s ease-in-out infinite;transition:background .5s;}
h1{
  font-size:clamp(2.1rem,4.5vw,3.3rem);font-weight:300;
  line-height:1.14;letter-spacing:-.03em;color:var(--text);
  margin-bottom:22px;animation:fadeUp .5s .08s ease-out both;
  transition:color .5s;
}
h1 strong{font-weight:600;}
h1 em{font-style:normal;color:var(--primary);transition:color .5s;}
.hero-sub{
  font-size:1.08rem;color:var(--text-muted);margin-bottom:36px;
  max-width:440px;line-height:1.65;
  animation:fadeUp .5s .16s ease-out both;
  transition:color .5s;
}
.hero-sub code{
  font-family:'DM Mono',monospace;font-size:.9em;
  background:var(--divider);padding:2px 7px;border-radius:5px;
  color:var(--primary);transition:background .5s,color .5s;
}
.hero-ctas{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:22px;animation:fadeUp .5s .24s ease-out both;}
.hero-login-hint{font-size:.82rem;color:var(--text-subtle);animation:fadeUp .5s .28s ease-out both;transition:color .5s;}
.hero-login-hint a{color:var(--primary);text-decoration:none;font-weight:500;}
.hero-login-hint a:hover{text-decoration:underline;}
.hero-tags{display:flex;gap:8px;flex-wrap:wrap;margin-top:26px;animation:fadeUp .5s .32s ease-out both;}
.tag{
  font-size:.73rem;font-weight:500;color:var(--text-muted);
  background:var(--surface);border:1px solid var(--border);
  border-radius:100px;padding:4px 12px;
  transition:background .5s,border-color .5s,color .5s;
}

/* HERO VISUAL */
.hero-vis{animation:slideRight .6s .4s ease-out both;position:relative;}
.funnel-card{
  background:var(--deep);border-radius:16px;padding:28px 24px;
  box-shadow:var(--shadow),0 0 0 1px rgba(129,140,248,.1);
  position:relative;
  transition:background .5s,box-shadow .5s;
}
.funnel-label{
  font-size:.72rem;font-weight:700;color:var(--on-deep-muted);
  letter-spacing:.08em;text-transform:uppercase;margin-bottom:18px;
  transition:color .5s;
}
.f-steps{display:flex;flex-direction:column;gap:11px;}
.f-step{display:flex;align-items:center;gap:12px;}
.f-name{font-size:.78rem;color:var(--on-deep-sub);width:76px;flex-shrink:0;transition:color .5s;}
.f-bar-wrap{flex:1;background:rgba(255,255,255,.06);border-radius:100px;height:9px;overflow:hidden;}
.f-bar{height:100%;border-radius:100px;width:0;--bar-w:100%;}
.f-bar.animated{animation:barGrow .9s cubic-bezier(.23,1,.32,1) forwards;}
.bar-a{background:var(--accent);--bar-w:100%;}
.bar-b{background:var(--accent);--bar-w:72%;}
.bar-c{background:var(--red);--bar-w:38%;}
.bar-d{background:var(--red);--bar-w:18%;opacity:.8;}
.f-pct{font-size:.73rem;font-weight:700;color:var(--on-deep);width:32px;text-align:right;flex-shrink:0;transition:color .5s;}
.drop-wrap{position:relative;}
.drop-pill{
  position:absolute;right:-12px;top:50%;transform:translateY(-50%);
  background:var(--red);border-radius:6px;
  padding:3px 8px;font-size:.63rem;font-weight:700;color:#fff;white-space:nowrap;
}
.f-divider{border:none;border-top:1px solid rgba(255,255,255,.07);margin:16px 0 12px;}
.f-stat{display:flex;justify-content:space-between;align-items:center;}
.f-stat-l{font-size:.72rem;color:var(--on-deep-muted);transition:color .5s;}
.f-stat-r{font-size:1rem;font-weight:700;color:var(--red);}
.f-stat-s{font-size:.7rem;font-weight:400;color:var(--on-deep-muted);margin-left:4px;transition:color .5s;}

/* Email fly icon */
.email-fly{
  position:absolute;right:20px;top:50%;transform:translateY(-50%);
  width:38px;height:38px;
  background:var(--emerald);border-radius:9px;
  display:grid;place-items:center;color:#fff;
  box-shadow:0 6px 20px rgba(0,0,0,.25);
  animation:float 3.2s ease-in-out infinite;
  transition:background .5s;
}

/* Nudge card */
.nudge-card{
  position:absolute;bottom:-24px;left:-20px;
  background:var(--surface);border:1.5px solid var(--border);
  border-radius:12px;padding:13px 16px;
  box-shadow:var(--shadow);
  display:flex;align-items:center;gap:10px;
  animation:floatB 3.8s .6s ease-in-out infinite;
  transition:background .5s,border-color .5s,box-shadow .5s;
}
.nudge-ico{
  width:30px;height:30px;background:var(--divider);
  border-radius:7px;display:grid;place-items:center;
  color:var(--primary);flex-shrink:0;
  transition:background .5s,color .5s;
}
.nudge-t strong{display:block;font-size:.75rem;font-weight:600;color:var(--text);transition:color .5s;}
.nudge-t span{font-size:.7rem;color:var(--text-muted);transition:color .5s;}

/* ═══════════════════════════════════════════
   AUDIENCE STRIP
═══════════════════════════════════════════ */
.audience-strip{background:var(--deep);padding:52px 0;transition:background .5s;}
.aud-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:rgba(255,255,255,.06);border-radius:12px;overflow:hidden;}
.aud-tile{background:var(--deep);padding:36px 40px;display:flex;gap:18px;align-items:flex-start;transition:background .5s;}
.aud-ico{
  width:44px;height:44px;background:rgba(255,255,255,.07);
  border-radius:9px;display:grid;place-items:center;
  color:var(--accent);flex-shrink:0;transition:background .5s,color .5s;
}
.aud-tile h3{font-size:.95rem;font-weight:600;color:var(--on-deep);margin-bottom:6px;transition:color .5s;}
.aud-tile p{font-size:.84rem;color:var(--on-deep-sub);line-height:1.6;transition:color .5s;}

/* ═══════════════════════════════════════════
   SECTION COMMON
═══════════════════════════════════════════ */
section{padding:96px 0;}
.sec-label{font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--primary);margin-bottom:13px;transition:color .5s;}
.sec-title{
  font-size:clamp(1.75rem,3.5vw,2.55rem);font-weight:300;
  letter-spacing:-.025em;color:var(--text);margin-bottom:14px;line-height:1.2;
  transition:color .5s;
}
.sec-title strong{font-weight:600;}
.sec-sub{font-size:.97rem;color:var(--text-muted);max-width:560px;line-height:1.65;transition:color .5s;}
.sec-hdr{margin-bottom:54px;}
.centered{text-align:center;}.centered .sec-sub{margin:0 auto;}

/* ═══════════════════════════════════════════
   PROBLEM
═══════════════════════════════════════════ */
.problem-sec{background:var(--bg-alt);border-top:1px solid var(--border);border-bottom:1px solid var(--border);transition:background .5s,border-color .5s;}
.prob-headline{
  font-size:clamp(1.4rem,2.8vw,2rem);font-weight:600;
  color:var(--text);text-align:center;margin-bottom:52px;
  letter-spacing:-.02em;line-height:1.3;transition:color .5s;
}
.prob-headline em{font-style:normal;color:var(--red);}
.prob-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}
.prob-card{
  background:var(--surface);border:1px solid var(--border);
  border-radius:12px;padding:32px 28px;
  box-shadow:var(--shadow-sm);
  transition:background .5s,border-color .5s,box-shadow .3s,transform .25s;
}
.prob-card:hover{transform:translateY(-4px);box-shadow:var(--shadow-hov);}
.prob-ico{
  width:42px;height:42px;background:var(--divider);border-radius:9px;
  display:grid;place-items:center;color:var(--red);margin-bottom:16px;
  transition:background .5s,color .5s;
}
.prob-card h3{font-size:.97rem;font-weight:700;color:var(--text);margin-bottom:8px;transition:color .5s;}
.prob-card h3 strong{color:var(--red);}
.prob-card p{font-size:.85rem;color:var(--text-muted);line-height:1.62;transition:color .5s;}

/* ═══════════════════════════════════════════
   FEATURES
═══════════════════════════════════════════ */
.feat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}
.feat-card{
  background:var(--surface);border:1px solid var(--border);
  border-radius:12px;padding:30px 26px;
  box-shadow:var(--shadow-sm);
  transition:background .5s,border-color .5s,box-shadow .3s,transform .25s;
}
.feat-card:hover{box-shadow:var(--shadow-hov);transform:translateY(-4px);}
.feat-ico{
  width:42px;height:42px;background:var(--divider);border-radius:9px;
  display:grid;place-items:center;color:var(--primary);margin-bottom:18px;
  transition:background .5s,color .5s;
}
.feat-card h3{font-size:.93rem;font-weight:600;color:var(--accent-pale);margin-bottom:7px;transition:color .5s;}
.feat-card p{font-size:.84rem;color:var(--text-muted);line-height:1.62;transition:color .5s;}
.feat-wide{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px;}
.feat-card-dark{
  background:var(--deep);border-radius:12px;padding:30px 28px;
  display:flex;gap:18px;align-items:flex-start;
  transition:background .5s,box-shadow .3s,transform .25s;
}
.feat-card-dark:hover{transform:translateY(-3px);box-shadow:var(--shadow-hov);}
.feat-card-dark .feat-ico{background:rgba(255,255,255,.07);margin-bottom:0;flex-shrink:0;}
.feat-card-dark h3{font-size:.93rem;font-weight:600;color:var(--on-deep);margin-bottom:6px;transition:color .5s;}
.feat-card-dark p{font-size:.83rem;color:var(--on-deep-sub);line-height:1.62;transition:color .5s;}

/* ═══════════════════════════════════════════
   HOW IT WORKS
═══════════════════════════════════════════ */
.how-sec{background:var(--deep);transition:background .5s;}
.how-sec .sec-title{color:var(--on-deep);transition:color .5s;}
.how-sec .sec-sub{color:var(--on-deep-sub);transition:color .5s;}
.how-sec .sec-label{color:var(--on-deep-muted);transition:color .5s;}
.steps-grid{
  display:grid;grid-template-columns:repeat(3,1fr);
  gap:2px;background:rgba(255,255,255,.06);
  border-radius:12px;overflow:hidden;margin-bottom:44px;
}
.step{background:var(--deep);padding:36px 28px;transition:background .5s;}
.step-num{
  width:34px;height:34px;border-radius:50%;
  background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.12);
  display:grid;place-items:center;
  font-size:.8rem;font-weight:700;color:var(--accent);
  margin-bottom:20px;transition:background .5s,color .5s,border-color .5s;
}
.step h3{font-size:.93rem;font-weight:600;color:var(--on-deep);margin-bottom:8px;transition:color .5s;}
.step p{font-size:.83rem;color:var(--on-deep-sub);line-height:1.62;transition:color .5s;}
.step p code{
  font-family:'DM Mono',monospace;font-size:.85em;
  background:rgba(255,255,255,.08);padding:2px 6px;border-radius:4px;
  color:var(--accent-soft);transition:background .5s,color .5s;
}

/* CODE BLOCK */
.code-block{
  background:var(--code-bg);border:1px solid var(--code-border);
  border-radius:12px;padding:24px 28px;
  font-family:'DM Mono',monospace;font-size:.81rem;line-height:1.85;
  color:var(--accent-pale);max-width:640px;margin:0 auto;
  transition:background .5s,border-color .5s;
}
.cl{display:block;opacity:0;transform:translateX(-8px);}
.cl.in-view{animation:codeReveal .3s ease-out forwards;}
.cc{color:rgba(165,180,252,.35);}
.cf{color:var(--accent-soft);}
.cs{color:var(--emerald);}
.ck{color:var(--accent);}

/* ═══════════════════════════════════════════
   SOCIAL PROOF
═══════════════════════════════════════════ */
.stat-strip{
  display:grid;grid-template-columns:repeat(3,1fr);
  gap:1px;background:var(--border);
  border-radius:12px;overflow:hidden;margin-bottom:40px;
  transition:background .5s;
}
.stat-tile{
  background:var(--surface);padding:32px 24px;text-align:center;
  transition:background .5s;
}
.stat-num{
  font-size:2.4rem;font-weight:700;color:var(--primary);
  letter-spacing:-.03em;line-height:1;margin-bottom:6px;
  transition:color .5s;
}
.stat-lbl{font-size:.82rem;color:var(--text-muted);transition:color .5s;}
.proof-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}
.proof-card{
  background:var(--surface);border:1px solid var(--border);
  border-radius:12px;padding:28px 24px;
  box-shadow:var(--shadow-sm);
  transition:background .5s,border-color .5s,box-shadow .3s,transform .25s;
}
.proof-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-hov);}
.proof-stars{color:#f59e0b;font-size:.85rem;margin-bottom:12px;}
.proof-q{font-size:.865rem;color:var(--text-muted);line-height:1.68;margin-bottom:18px;font-style:italic;transition:color .5s;}
.proof-auth{display:flex;align-items:center;gap:10px;}
.proof-av{
  width:34px;height:34px;border-radius:50%;background:var(--divider);
  display:grid;place-items:center;font-size:.78rem;font-weight:700;
  color:var(--primary);flex-shrink:0;transition:background .5s,color .5s;
}
.proof-name{font-size:.8rem;font-weight:600;color:var(--text);transition:color .5s;}
.proof-role{font-size:.71rem;color:var(--text-subtle);transition:color .5s;}

/* ═══════════════════════════════════════════
   FEEDBACK / ROADMAP
═══════════════════════════════════════════ */
.feedback-sec{background:var(--bg-alt);border-top:1px solid var(--border);transition:background .5s,border-color .5s;}
.fb-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:48px;}
.fb-grid.single{grid-template-columns:minmax(0,640px);}
.fb-item{display:flex;flex-direction:column;gap:10px;}
.fb-ico{
  width:44px;height:44px;background:var(--divider);border-radius:9px;
  display:grid;place-items:center;color:var(--primary);
  transition:background .5s,color .5s;
}
.fb-item h3{font-size:.93rem;font-weight:600;color:var(--text);transition:color .5s;}
.fb-item p{font-size:.84rem;color:var(--text-muted);line-height:1.62;flex:1;transition:color .5s;}
.fb-link{
  font-size:.82rem;font-weight:600;color:var(--primary);
  text-decoration:none;display:inline-flex;align-items:center;gap:5px;
  transition:gap .2s,color .5s;
}
.fb-link:hover{gap:8px;}

/* WAITLIST */
.waitlist-box{
  background:var(--surface);border:1.5px solid var(--border);
  border-radius:12px;padding:40px 44px;
  box-shadow:var(--shadow-sm);
  transition:background .5s,border-color .5s;
}
.waitlist-box h3{font-size:1.08rem;font-weight:600;color:var(--text);margin-bottom:8px;transition:color .5s;}
.waitlist-box p{font-size:.9rem;color:var(--text-muted);margin-bottom:24px;line-height:1.65;max-width:540px;transition:color .5s;}
.wl-form{display:flex;gap:10px;max-width:460px;}
.wl-input{
  flex:1;font-family:'DM Sans',sans-serif;font-size:.9rem;
  border:1.5px solid var(--border);border-radius:8px;
  padding:11px 16px;outline:none;background:var(--surface-2);
  color:var(--text);transition:border-color .2s,background .5s,color .5s;
}
.wl-input::placeholder{color:var(--placeholder);}
.wl-input:focus{border-color:var(--primary);}
.wl-note{font-size:.73rem;color:var(--text-subtle);margin-top:9px;transition:color .5s;}
.wl-message{font-size:.78rem;margin-top:10px;min-height:1.2em;color:var(--text-muted);transition:color .2s;}
.wl-message.ok{color:var(--emerald);}
.wl-message.error{color:var(--red);}

/* ═══════════════════════════════════════════
   PRICING
═══════════════════════════════════════════ */
.pricing-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:800px;margin:0 auto;}
.price-card{
  background:var(--surface);border:1.5px solid var(--border);
  border-radius:12px;padding:36px 32px;
  box-shadow:var(--shadow-sm);position:relative;
  transition:background .5s,border-color .5s,box-shadow .3s;
}
.price-card.featured{border-color:var(--primary);box-shadow:0 4px 30px rgba(var(--primary-rgb),.18);}
.feat-badge{
  position:absolute;top:-13px;left:50%;transform:translateX(-50%);
  background:var(--primary);color:#fff;
  font-size:.68rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
  padding:4px 14px;border-radius:100px;
  transition:background .5s;
}
.price-tier{font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--primary);margin-bottom:8px;transition:color .5s;}
.price-num{font-size:2.6rem;font-weight:700;color:var(--text);letter-spacing:-.03em;line-height:1;margin-bottom:4px;transition:color .5s;}
.price-num span{font-size:.95rem;font-weight:400;color:var(--text-muted);}
.price-desc{font-size:.84rem;color:var(--text-muted);margin-bottom:28px;line-height:1.5;transition:color .5s;}
.price-list{list-style:none;display:flex;flex-direction:column;gap:10px;margin-bottom:28px;}
.price-list li{font-size:.84rem;color:var(--text-muted);display:flex;align-items:center;gap:9px;transition:color .5s;}
.price-list li svg{color:var(--emerald);flex-shrink:0;}
.price-note{font-size:.73rem;color:var(--text-subtle);text-align:center;margin-top:8px;transition:color .5s;}
.npm-pill{
  display:inline-flex;align-items:center;gap:7px;
  background:rgba(0,0,0,.05);border:1px solid var(--border);
  border-radius:100px;padding:5px 14px;
  font-family:'DM Mono',monospace;font-size:.74rem;
  color:var(--emerald);margin-top:36px;
  transition:background .5s,border-color .5s,color .5s;
}

/* ═══════════════════════════════════════════
   FAQ
═══════════════════════════════════════════ */
.faq-sec{background:var(--bg-alt);border-top:1px solid var(--border);border-bottom:1px solid var(--border);transition:background .5s,border-color .5s;}
.faq-list{max-width:720px;margin:0 auto;}
details{
  background:var(--surface);border:1px solid var(--border);
  border-radius:12px;margin-bottom:10px;overflow:hidden;
  transition:background .5s,border-color .5s,box-shadow .2s;
}
details[open]{box-shadow:var(--shadow-hov);}
summary{
  padding:20px 24px;font-size:.93rem;font-weight:600;color:var(--text);
  cursor:pointer;list-style:none;display:flex;justify-content:space-between;
  align-items:center;user-select:none;transition:color .5s;
}
summary::-webkit-details-marker{display:none;}
.sum-arrow{
  width:26px;height:26px;border-radius:50%;background:var(--divider);
  display:grid;place-items:center;color:var(--primary);flex-shrink:0;
  transition:transform .25s,background .5s,color .5s;
}
details[open] .sum-arrow{transform:rotate(180deg);}
.faq-ans{
  padding:0 24px 20px;font-size:.875rem;color:var(--text-muted);line-height:1.72;
  transition:color .5s;
}
.faq-ans code{
  font-family:'DM Mono',monospace;background:var(--divider);
  padding:2px 6px;border-radius:4px;font-size:.82em;
  color:var(--primary);transition:background .5s,color .5s;
}

/* ═══════════════════════════════════════════
   CTA BANNER
═══════════════════════════════════════════ */
.cta-banner{
  background:var(--deep);border-radius:16px;
  padding:72px 48px;text-align:center;
  position:relative;overflow:hidden;margin:0 0 96px;
  transition:background .5s;
}
.cta-banner::before{
  content:'';position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(ellipse at 50% 0%,var(--glow),transparent 65%);
}
.cta-banner::after{
  content:'';position:absolute;inset:0;pointer-events:none;
  background-image:radial-gradient(rgba(255,255,255,.07) 1px,transparent 1px);
  background-size:24px 24px;
}
.cta-kicker{color:#fff;font-size:1rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px;position:relative;z-index:1;}
.cta-banner h2{
  font-size:clamp(1.65rem,3.5vw,2.55rem);font-weight:300;
  color:var(--on-deep);letter-spacing:-.025em;margin-bottom:14px;
  position:relative;z-index:1;transition:color .5s;
}
.cta-banner h2 strong{font-weight:600;color:#fff;}
.cta-banner p{color:var(--on-deep-sub);font-size:.97rem;margin-bottom:32px;position:relative;z-index:1;transition:color .5s;}
.cta-btns{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;position:relative;z-index:1;}
.btn-white{
  font-family:'DM Sans',sans-serif;font-size:1rem;font-weight:600;
  color:var(--deep);background:#fff;border:none;border-radius:9px;
  padding:13px 30px;cursor:pointer;text-decoration:none;
  display:inline-flex;align-items:center;gap:6px;
  transition:background .2s,transform .15s,color .5s;
}
.btn-white:hover{background:var(--accent-palest);transform:translateY(-2px);}
.btn-outline-white{
  font-family:'DM Sans',sans-serif;font-size:1rem;font-weight:500;
  color:var(--on-deep-sub);background:transparent;
  border:1.5px solid rgba(255,255,255,.18);border-radius:9px;
  padding:12px 28px;cursor:pointer;text-decoration:none;
  display:inline-flex;align-items:center;gap:6px;
  transition:border-color .2s,color .5s;
}
.btn-outline-white:hover{border-color:var(--accent-soft);color:var(--accent-soft);}

/* ═══════════════════════════════════════════
   FOOTER
═══════════════════════════════════════════ */
footer{background:var(--deep);padding:56px 0 32px;border-top:1px solid rgba(255,255,255,.06);transition:background .5s;}
.foot-top{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:48px;margin-bottom:48px;}
.foot-logo{display:flex;align-items:center;gap:10px;text-decoration:none;margin-bottom:14px;}
.foot-logo-ico{width:30px;height:30px;background:var(--primary);border-radius:7px;display:grid;place-items:center;color:#fff;font-size:.78rem;font-weight:700;transition:background .5s;}
.foot-logo-text{font-size:1rem;font-weight:600;color:var(--on-deep);transition:color .5s;}
.foot-desc{font-size:.81rem;color:var(--on-deep-sub);line-height:1.65;max-width:240px;transition:color .5s;}
.foot-col h4{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--on-deep-muted);margin-bottom:16px;transition:color .5s;}
.foot-col ul{list-style:none;display:flex;flex-direction:column;gap:9px;}
.foot-col ul li a{font-size:.83rem;color:var(--on-deep-sub);text-decoration:none;transition:color .2s;}
.foot-col ul li a:hover{color:var(--on-deep);}
.foot-bot{border-top:1px solid rgba(255,255,255,.07);padding-top:24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;}
.foot-bot p{font-size:.76rem;color:rgba(165,180,252,.4);}
.foot-bot-links{display:flex;gap:20px;}
.foot-bot-links a{font-size:.76rem;color:rgba(165,180,252,.4);text-decoration:none;transition:color .2s;}
.foot-bot-links a:hover{color:var(--on-deep);}

/* ═══════════════════════════════════════════
   SVG ICON HELPER
═══════════════════════════════════════════ */
.ico{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}

/* ═══════════════════════════════════════════
   RESPONSIVE
═══════════════════════════════════════════ */
@media(max-width:900px){
  .hero-inner{grid-template-columns:1fr;gap:48px;}
  .aud-grid{grid-template-columns:1fr;}
  .prob-grid,.feat-grid,.steps-grid,.proof-grid,.fb-grid{grid-template-columns:1fr;}
  .feat-wide,.pricing-grid{grid-template-columns:1fr;max-width:460px;}
  .foot-top{grid-template-columns:1fr 1fr;gap:32px;}
  .nav-links{display:none;}
  .wl-form{flex-direction:column;}
  .cta-banner{padding:48px 28px;}
  .stat-strip{grid-template-columns:1fr;}
}
@media(max-width:560px){
  .foot-top{grid-template-columns:1fr;}
  section{padding:64px 0;}
  h1{font-size:2rem;}
}
`;

// This markup is intentionally kept close to the root index-v2.html prototype. The goal is
// to make future copy/design updates easy: edit the semantic sections here, then adjust the
// matching class names in landingStyles above. Auth CTAs have been localized to /login because
// this app creates accounts from the same magic-link login flow.
const landingMarkup = String.raw`<!-- ══════════════════════════════════════════════════
     SVG SPRITE (Lucide-style, hidden)
══════════════════════════════════════════════════ -->
<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
  <symbol id="i-trending-down" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 17 22 17 22 11"/>
  </symbol>
  <symbol id="i-eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/>
  </symbol>
  <symbol id="i-bell-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 1 .6 5"/><path d="M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/><line x1="2" y1="2" x2="22" y2="22"/>
  </symbol>
  <symbol id="i-bar-chart" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </symbol>
  <symbol id="i-zap" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </symbol>
  <symbol id="i-pointer" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="m9 9 5 12 1.8-5.2L21 14Z"/><path d="M7.2 2.2 8 5.1"/><path d="m5.1 8-2.9-.8"/><path d="M14 4.1 12 6"/><path d="m6 12-1.9 2"/>
  </symbol>
  <symbol id="i-send" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </symbol>
  <symbol id="i-list" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </symbol>
  <symbol id="i-package" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.7 4.73a2 2 0 0 0 2 0L20.7 7"/><path d="m7.5 4.27 9 5.15"/>
  </symbol>
  <symbol id="i-building" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>
  </symbol>
  <symbol id="i-store" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/>
  </symbol>
  <symbol id="i-terminal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
  </symbol>
  <symbol id="i-code2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>
  </symbol>
  <symbol id="i-sparkles" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.937A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
    <path d="M20 3v4M22 5h-4M4 17v2M5 18H3"/>
  </symbol>
  <symbol id="i-thumbs-up" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>
  </symbol>
  <symbol id="i-phone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.6 19.79 19.79 0 0 1 1.62 5 2 2 0 0 1 3.6 2.89h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6 6l.92-1.87a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </symbol>
  <symbol id="i-message" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </symbol>
  <symbol id="i-chevron-down" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m6 9 6 6 6-6"/>
  </symbol>
  <symbol id="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </symbol>
  <symbol id="i-mail" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </symbol>
  <symbol id="i-arrow-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
  </symbol>
  <symbol id="i-users" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </symbol>
</svg>

<!-- ══════════════════════════════════════════════════
     NAV
══════════════════════════════════════════════════ -->
<nav id="nav">
  <div class="container">
    <div class="nav-inner">
      <a href="/" class="nav-logo" aria-label="Dripmetric home">
        <div class="nav-logo-icon">OF</div>
        Dripmetric
      </a>
      <ul class="nav-links" role="list">
        <li><a href="#features">Features</a></li>
        <li><a href="#how-it-works">How it works</a></li>
        <li><a href="#pricing">Pricing</a></li>
        <li><a href="#faq">FAQ</a></li>
      </ul>
      <div class="nav-right">
        <!-- Theme selector intentionally removed: the landing page is fixed to the indigo palette. -->
        <a href="/login" class="btn-ghost">Log in</a>
        <a href="/login" class="btn-primary">
          Start free
          <svg class="ico" width="14" height="14"><use href="#i-arrow-right"/></svg>
        </a>
      </div>
    </div>
  </div>
</nav>

<!-- ══════════════════════════════════════════════════
     HERO
══════════════════════════════════════════════════ -->
<section class="hero" aria-label="Hero">
  <div class="container">
    <div class="hero-inner">
      <!-- LEFT -->
      <div>
        <a href="https://www.producthunt.com/products/dripmetric-3/reviews/new?utm_source=badge-product_review&amp;utm_medium=badge&amp;utm_source=badge-dripmetric&#0045;3" target="_blank" rel="noopener" class="product-hunt-badge" aria-label="Review Dripmetric on Product Hunt">
          <img src="https://api.producthunt.com/widgets/embed-image/v1/product_review.svg?product_id=1210405&amp;theme=light" alt="Dripmetric - Easy to setup mail dripping and cold mailing for individuals | Product Hunt" width="250" height="54" />
        </a>
        <div class="hero-badge">
          <span class="badge-dot"></span>
          Free to start · No credit card
        </div>
        <h1>
          Most SaaS products<br/>
          lose <em>60–70%</em> of signups<br/>
          <strong>before activation.</strong>
        </h1>
        <p class="hero-sub">
          Dripmetric shows you exactly where users drop off and automatically nudges them back —
          with only 3 lines of code.
        </p>
        <div class="hero-ctas">
          <a href="/login" class="btn-primary btn-primary-lg">
            Start free
            <svg class="ico" width="16" height="16"><use href="#i-arrow-right"/></svg>
          </a>
          <a href="#how-it-works" class="btn-outline">See how it works</a>
        </div>
        <p class="hero-login-hint">
          Already using it? <a href="/login">Log in</a>
        </p>

      </div>

      <!-- RIGHT: funnel visual -->
      <div class="hero-vis" aria-hidden="true">
        <div class="funnel-card">
          <div class="funnel-label">Onboarding Funnel · Last 30 days</div>
          <div class="f-steps" id="funnelSteps">
            <div class="f-step">
              <span class="f-name">Signed Up</span>
              <div class="f-bar-wrap"><div class="f-bar bar-a" style="--bar-w:100%"></div></div>
              <span class="f-pct">100%</span>
            </div>
            <div class="f-step">
              <span class="f-name">Step 1</span>
              <div class="f-bar-wrap"><div class="f-bar bar-b" style="--bar-w:72%"></div></div>
              <span class="f-pct">72%</span>
            </div>
            <div class="f-step drop-wrap">
              <span class="f-name">Step 2</span>
              <div class="f-bar-wrap"><div class="f-bar bar-c" style="--bar-w:38%"></div></div>
              <span class="f-pct">38%</span>
              <span class="drop-pill">⚡ Drop-off</span>
            </div>
            <div class="f-step">
              <span class="f-name">Activated</span>
              <div class="f-bar-wrap"><div class="f-bar bar-d" style="--bar-w:18%"></div></div>
              <span class="f-pct">18%</span>
            </div>
          </div>
          <!-- floating email icon -->
          <div class="email-fly">
            <svg class="ico" width="18" height="18"><use href="#i-mail"/></svg>
          </div>
          <hr class="f-divider"/>
          <div class="f-stat">
            <span class="f-stat-l">Completion rate</span>
            <span class="f-stat-r">18%<span class="f-stat-s">of signups</span></span>
          </div>
        </div>
        <!-- nudge notification card -->
        <div class="nudge-card">
          <div class="nudge-ico">
            <svg class="ico" width="16" height="16"><use href="#i-mail"/></svg>
          </div>
          <div class="nudge-t">
            <strong>Drip sent automatically</strong>
            <span>3 users nudged at Step 2 · 1h ago</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ══════════════════════════════════════════════════
     AUDIENCE STRIP
══════════════════════════════════════════════════ -->
<div class="audience-strip" id="about" aria-label="Who Dripmetric is for">
  <div class="container">
    <div class="aud-grid">
      <div class="aud-tile reveal">
        <div class="aud-ico">
          <svg class="ico" width="22" height="22"><use href="#i-terminal"/></svg>
        </div>
        <div>
          <h3>For SaaS Developers &amp; Founders</h3>
          <p>Install the SDK, call two functions, and get onboarding analytics + automated drip emails — without building the infrastructure from scratch.</p>
        </div>
      </div>
      <div class="aud-tile reveal d2">
        <div class="aud-ico">
          <svg class="ico" width="22" height="22"><use href="#i-store"/></svg>
        </div>
        <div>
          <h3>For Small Businesses &amp; Freelancers</h3>
          <p>Manage email lists, build drip sequences, and send campaigns from a no-code dashboard — without the complexity or cost of enterprise tools.</p>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════
     PROBLEM
══════════════════════════════════════════════════ -->
<section class="problem-sec" id="problem" aria-label="The problem">
  <div class="container">
    <p class="prob-headline reveal">
      SaaS products are <em>bleeding users silently.</em><br/>
      <span style="font-size:.65em;font-weight:400;color:var(--text-muted);">And traditional analytics won't tell you why.</span>
    </p>
    <div class="prob-grid">
      <div class="prob-card reveal d1">
        <div class="prob-ico">
          <svg class="ico" width="22" height="22"><use href="#i-trending-down"/></svg>
        </div>
        <h3><strong>60–70% of signups never activate</strong></h3>
        <p>Most users quit before they ever experience your product's core value. They sign up, hit one confusing step, and disappear forever.</p>
      </div>
      <div class="prob-card reveal d2">
        <div class="prob-ico">
          <svg class="ico" width="22" height="22"><use href="#i-eye-off"/></svg>
        </div>
        <h3>You have <strong>zero visibility</strong> into the where</h3>
        <p>Traditional analytics show traffic — not the exact onboarding step where motivation dies. You're guessing which step kills the journey.</p>
      </div>
      <div class="prob-card reveal d3">
        <div class="prob-ico">
          <svg class="ico" width="22" height="22"><use href="#i-bell-off"/></svg>
        </div>
        <h3>No automated system <strong>pulls them back</strong></h3>
        <p>You can't manually email every user who goes cold. But leaving them is money left on the table. You need automation that runs itself.</p>
      </div>
    </div>
  </div>
</section>

<!-- ══════════════════════════════════════════════════
     FEATURES
══════════════════════════════════════════════════ -->
<section id="features" aria-label="Features and benefits">
  <div class="container">
    <div class="sec-hdr reveal">
      <p class="sec-label">What you get</p>
      <h2 class="sec-title">Everything the core onboarding<br/><strong>loop needs. Nothing it doesn't.</strong></h2>
      <p class="sec-sub">Two tiers — SDK-level control for developers, no-code dashboard for businesses who just want it to work.</p>
    </div>
    <div class="feat-grid">
      <div class="feat-card reveal d1">
        <div class="feat-ico"><svg class="ico" width="20" height="20"><use href="#i-bar-chart"/></svg></div>
        <h3>Funnel Breakdown Per Step</h3>
        <p>Real-time funnel showing exactly which onboarding step users drop off at, plus a completion rate metric across your entire user base.</p>
      </div>
      <div class="feat-card reveal d2">
        <div class="feat-ico"><svg class="ico" width="20" height="20"><use href="#i-zap"/></svg></div>
        <h3>Automatic Drip Email Triggers</h3>
        <p>Cron-based detection checks users every 15 minutes. Stalled users get a configured drip email — automatically, once per step, no duplicates.</p>
      </div>
      <div class="feat-card reveal d3">
        <div class="feat-ico"><svg class="ico" width="20" height="20"><use href="#i-pointer"/></svg></div>
        <h3>Send nudges manually</h3>
        <p>Re-engage stuck users at any step with a single click from your dashboard. No code required after the initial setup.</p>
      </div>
      <div class="feat-card reveal d4">
        <div class="feat-ico"><svg class="ico" width="20" height="20"><use href="#i-send"/></svg></div>
        <h3>Your Domain, Your Emails</h3>
        <p>Connect your own email API key. All emails send from your verified domain — never from a shared Dripmetric address.</p>
      </div>
      <div class="feat-card reveal d5">
        <div class="feat-ico"><svg class="ico" width="20" height="20"><use href="#i-list"/></svg></div>
        <h3>Email List Management</h3>
        <p>Build and manage email lists, add contacts in bulk, create drip sequences, and launch campaigns — all from the browser, no code needed.</p>
      </div>
      <div class="feat-card reveal d6">
        <div class="feat-ico"><svg class="ico" width="20" height="20"><use href="#i-package"/></svg></div>
        <h3>Simple SDK installation and setup</h3>
        <p>One command install. Full TypeScript support, CJS + ESM exports. Works with any Node.js framework — Next.js, Express, Hono, and more.</p>
      </div>
    </div>
    <div class="feat-wide" style="margin-top:20px">
      <div class="feat-card-dark reveal d1">
        <div class="feat-ico"><svg class="ico" width="20" height="20"><use href="#i-building"/></svg></div>
        <div>
          <h3>Enterprise Tier — For Developers</h3>
          <p>Install the npm SDK, call <code style="font-family:'DM Mono',monospace;font-size:.85em;background:rgba(255,255,255,.08);padding:2px 6px;border-radius:4px;color:var(--accent-soft)">identify()</code> on signup and <code style="font-family:'DM Mono',monospace;font-size:.85em;background:rgba(255,255,255,.08);padding:2px 6px;border-radius:4px;color:var(--accent-soft)">track()</code> on step completion. Dripmetric detects stalled users and fires drip emails automatically. Dashboard shows your full funnel.</p>
        </div>
      </div>
      <div class="feat-card-dark reveal d2">
        <div class="feat-ico" style="color:var(--emerald)"><svg class="ico" width="20" height="20"><use href="#i-store"/></svg></div>
        <div>
          <h3>Individual Tier — No-Code Dashboard</h3>
          <p>Manage email lists, add contacts, build drip sequences, and send campaigns directly from the browser. No SDK, no API keys, no technical setup required. Perfect for 1–3 person teams.</p>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ══════════════════════════════════════════════════
     HOW IT WORKS
══════════════════════════════════════════════════ -->
<section class="how-sec" id="how-it-works" aria-label="How Dripmetric works">
  <div class="container">
    <div class="sec-hdr centered reveal">
      <p class="sec-label">Integration in minutes</p>
      <h2 class="sec-title">How to automate SaaS onboarding emails<br/><strong style="color:#fff">when users get stuck</strong></h2>
      <p class="sec-sub">Three steps. Only 3 lines of code. Working drip automation in under 10 minutes.</p>
    </div>
    <div class="steps-grid">
      <div class="step reveal d1">
        <div class="step-num">01</div>
        <h3>Install &amp; Initialize</h3>
        <p>Run <code>npm install dripmetric</code>, add your API key from the dashboard, and initialize the client in your backend. Any Node.js framework works.</p>
      </div>
      <div class="step reveal d2">
        <div class="step-num">02</div>
        <h3>Call Two Functions</h3>
        <p>Use <code>identify()</code> when a user signs up and <code>track()</code> each time they complete an onboarding step. That's the full integration.</p>
      </div>
      <div class="step reveal d3">
        <div class="step-num">03</div>
        <h3>Dripmetric Does the Rest</h3>
        <p>Cron detection finds stalled users and fires drip emails automatically. Your dashboard shows funnel data, completion rates, and nudge history live.</p>
      </div>
    </div>
    <!-- code block -->
    <div class="code-block reveal" id="codeBlock">
      <span class="cl cc">// 1. Install</span>
      <span class="cl"><span class="cf">npm</span> install <span class="cs">dripmetric</span></span>
      <span class="cl">&nbsp;</span>
      <span class="cl cc">// 2. Initialize</span>
      <span class="cl"><span class="ck">import</span> { Dripmetric } <span class="ck">from</span> <span class="cs">'dripmetric'</span>;</span>
      <span class="cl"><span class="ck">const</span> of = <span class="ck">new</span> <span class="cf">Dripmetric</span>({ apiKey: <span class="cs">'YOUR_KEY'</span> });</span>
      <span class="cl">&nbsp;</span>
      <span class="cl cc">// 3. Track your users</span>
      <span class="cl">await of.<span class="cf">identify</span>({ userId: user.id, email: user.email });</span>
      <span class="cl">await of.<span class="cf">track</span>({ userId: user.id, step: <span class="cs">'profile_completed'</span> });</span>
      <span class="cl">&nbsp;</span>
      <span class="cl cc">// ✓ Dripmetric detects stalls → sends drip emails automatically</span>
    </div>
  </div>
</section>

<!-- ══════════════════════════════════════════════════
     SOCIAL PROOF
══════════════════════════════════════════════════ -->
<section id="social-proof" aria-label="Social proof">
  <div class="container">
    <div class="stat-strip reveal" role="list">
      <div class="stat-tile" role="listitem">
        <div class="stat-num" data-count="70" data-suffix="%">0%</div>
        <div class="stat-lbl">Average signup-to-activation drop-off in SaaS</div>
      </div>
      <div class="stat-tile" role="listitem">
        <div class="stat-num" data-text="&lt;10 min">&lt;10 min</div>
        <div class="stat-lbl">Time to working drip automation</div>
      </div>
      <div class="stat-tile" role="listitem">
        <div class="stat-num" data-text="$0">$0</div>
        <div class="stat-lbl">To start. No credit card required.</div>
      </div>
    </div>
    <!-- Early-adopter testimonials are intentionally hidden until real customer feedback is available.
    <div class="sec-hdr centered reveal">
      <p class="sec-label">Early adopters</p>
      <h2 class="sec-title">Built in public with <strong>early users</strong></h2>
    </div>
    <div class="proof-grid">
      <div class="proof-card reveal d1">
        <div class="proof-stars">★★★★★</div>
        <p class="proof-q">Customer testimonial placeholder.</p>
      </div>
    </div>
    -->
  </div>
</section>

<!-- ══════════════════════════════════════════════════
     FEEDBACK / ROADMAP
══════════════════════════════════════════════════ -->
<section class="feedback-sec" id="roadmap" aria-label="Feedback and roadmap">
  <div class="container">
    <div class="sec-hdr reveal">
      <h2 class="sec-title"><strong>You shape</strong> what gets built next.</h2>
      <p class="sec-sub">Log in, use Dripmetric, and tell us what should improve from the feedback form at the bottom of your dashboard.</p>
    </div>
    <div class="fb-grid single">
      <div class="fb-item reveal d1">
        <div class="fb-ico"><svg class="ico" width="22" height="22"><use href="#i-message"/></svg></div>
        <h3>Use the product, then share feedback</h3>
        <p>Sign in, try the dashboard, and submit your suggestions through the feedback form linked at the bottom of the dashboard page. Your feedback decides what ships next.</p>
        <a href="/login" class="fb-link">Log in or sign up <svg class="ico" width="12" height="12"><use href="#i-arrow-right"/></svg></a>
        <a href="https://docs.google.com/forms/d/e/1FAIpQLSf73_-TjhWiYXqOkHS1Pr1_sNZ__JrTz93O6fgUEUF_F-COhw/viewform" target="_blank" rel="noopener" class="fb-link">Open feedback form <svg class="ico" width="12" height="12"><use href="#i-arrow-right"/></svg></a>
      </div>
    </div>
    <div class="waitlist-box reveal">
      <h3>v2 is being built right now.</h3>
      <p>Based on feedback from our initial users, v2 will include advanced segmentation, a multi-step visual flow builder, Slack alerts, and team collaboration. Join the waitlist and get early access + a founder discount.</p>
      <form class="wl-form" id="waitlistForm">
        <input id="waitlistEmail" name="email" type="email" class="wl-input" placeholder="your@email.com" aria-label="Email for v2 waitlist" required autocomplete="email"/>
        <button class="btn-primary" type="submit">Join v2 waitlist <svg class="ico" width="14" height="14"><use href="#i-arrow-right"/></svg></button>
      </form>
      <p class="wl-note">No spam. One email when v2 ships.</p>
      <p class="wl-message" id="waitlistMessage" role="status" aria-live="polite"></p>
    </div>
  </div>
</section>

<!-- ══════════════════════════════════════════════════
     PRICING / CTA
══════════════════════════════════════════════════ -->
<section id="pricing" aria-label="Free signup">
  <div class="container">
    <div class="cta-banner reveal">
      <p class="cta-kicker">Free to start.</p>
      <h2>Stop guessing.<br/><strong>Start recovering lost signups.</strong></h2>
      <div class="cta-btns">
        <a href="/login" class="btn-white">
          Start free — no credit card required
          <svg class="ico" width="14" height="14"><use href="#i-arrow-right"/></svg>
        </a>
      </div>
    </div>
  </div>
</section>

<!-- ══════════════════════════════════════════════════
     FAQ
══════════════════════════════════════════════════ -->
<section class="faq-sec" id="faq" aria-label="Frequently asked questions">
  <div class="container">
    <div class="sec-hdr centered reveal">
      <p class="sec-label">FAQ</p>
      <h2 class="sec-title">Common questions<br/><strong>answered directly.</strong></h2>
    </div>
    <div class="faq-list">
      <details open class="reveal d1">
        <summary>What is Dripmetric?<span class="sum-arrow"><svg class="ico" width="14" height="14"><use href="#i-chevron-down"/></svg></span></summary>
        <div class="faq-ans">Dripmetric is a multi-tenant SaaS platform for onboarding automation and email campaign management. It has two tiers — an <strong>Enterprise tier</strong> with an npm SDK for developers, and an <strong>Individual tier</strong> with a no-code dashboard for small businesses. Both are free to start, no credit card required.</div>
      </details>
      <details class="reveal d2">
        <summary>How do I integrate Dripmetric into my SaaS?<span class="sum-arrow"><svg class="ico" width="14" height="14"><use href="#i-chevron-down"/></svg></span></summary>
        <div class="faq-ans">Run <code>npm install dripmetric</code>, initialize with your API key, call <code>identify()</code> when a user signs up, and call <code>track()</code> when they complete an onboarding step. The platform handles stall detection and email sending automatically. Most developers are fully live in under 10 minutes.</div>
      </details>
      <details class="reveal d3">
        <summary>What happens when a user gets stuck?<span class="sum-arrow"><svg class="ico" width="14" height="14"><use href="#i-chevron-down"/></svg></span></summary>
        <div class="faq-ans">Dripmetric's cron system checks all users every 15 minutes. If a user hasn't completed their next onboarding step within the configured delay (1 hour for step 1, 24 hours for steps 2 and 3), it sends the configured drip email automatically. Each nudge is sent at most once per user per step — no spam, no duplicates.</div>
      </details>
      <details class="reveal d4">
        <summary>Can I send emails from my own domain?<span class="sum-arrow"><svg class="ico" width="14" height="14"><use href="#i-chevron-down"/></svg></span></summary>
        <div class="faq-ans">Yes. You connect your own email API key in the dashboard. All emails go out from your verified domain — not from a shared Dripmetric address. Your users see your brand, not ours.</div>
      </details>
      <details class="reveal d5">
        <summary>Is Dripmetric only for developers?<span class="sum-arrow"><svg class="ico" width="14" height="14"><use href="#i-chevron-down"/></svg></span></summary>
        <div class="faq-ans">No. The Individual tier is a fully no-code dashboard for small businesses to manage email lists, add contacts, build drip sequences, and send campaigns — no technical setup, no SDK, no API keys required. Just sign up and go.</div>
      </details>
      <details class="reveal d6">
        <summary>What is the free tier exactly?<span class="sum-arrow"><svg class="ico" width="14" height="14"><use href="#i-chevron-down"/></svg></span></summary>
        <div class="faq-ans">The free Enterprise tier includes up to 50 tracked end users, 20 emails per day, and 300 emails per month. The free Individual tier includes 3 email lists, 10 contacts per list, and 1 campaign per list. Both are genuinely functional — not 7-day trials.</div>
      </details>
    </div>
  </div>
</section>

<!-- ══════════════════════════════════════════════════
     FOOTER
══════════════════════════════════════════════════ -->
<footer>
  <div class="container">
    <div class="foot-top">
      <div>
        <a href="/" class="foot-logo">
          <div class="foot-logo-ico">OF</div>
          <span class="foot-logo-text">Dripmetric</span>
        </a>
        <p class="foot-desc">Onboarding automation and email campaign management for SaaS developers and small businesses. Built in public.</p>
      </div>
      <div class="foot-col">
        <h4>Product</h4>
        <ul>
          <li><a href="#features">Features</a></li>
          <li><a href="#how-it-works">How it works</a></li>
          <li><a href="#pricing">Pricing</a></li>
          <li><a href="https://www.npmjs.com/package/dripmetric" target="_blank" rel="noopener">npm SDK</a></li>
        </ul>
      </div>
      <div class="foot-col">
        <h4>Company</h4>
        <ul>
          <li><a href="#about">About</a></li>
          <li><a href="#roadmap">Roadmap</a></li>
          <li><a href="https://www.producthunt.com/products/dripmetric-3" target="_blank" rel="noopener">Product Hunt</a></li>
          <li><a href="mailto:harshit@dripmetric.com">Contact</a></li>
        </ul>
      </div>
      <div class="foot-col">
        <h4>Account</h4>
        <ul>
          <li><a href="/login">Log in / Sign up</a></li>
          <li><a href="https://dripmetric.com/privacy">Privacy</a></li>
          <li><a href="https://dripmetric.com/terms">Terms</a></li>
        </ul>
      </div>
    </div>
    <div class="foot-bot">
      <p>© 2026 Dripmetric · <a href="https://harshitshukla.codes" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">Harshit Shukla</a> · harshitshukla.codes · dripmetric.com</p>
      <div class="foot-bot-links">
        <a href="https://dripmetric.com/privacy">Privacy</a>
        <a href="https://dripmetric.com/terms">Terms</a>
        <a href="mailto:harshit@dripmetric.com">Contact</a>
      </div>
    </div>
  </div>
</footer>

<!-- ══════════════════════════════════════════════════
     JAVASCRIPT
══════════════════════════════════════════════════ -->`;

export default function Home() {
  return (
    // The wrapper owns the fixed indigo theme variables for the entire imported landing page.
    // Future color changes should update the indigo variables above instead of adding a theme toggle.
    <main id="landing-page" className="landing-shell" data-theme="indigo">
      {/* Global landing styles copied from the v2 HTML prototype and scoped to this shell. */}
      <style dangerouslySetInnerHTML={{ __html: landingStyles }} />

      {/* Semantic landing content: nav, hero, social proof, roadmap, pricing, FAQ, and footer. */}
      <div dangerouslySetInnerHTML={{ __html: landingMarkup }} />

      {/* Client-only enhancements for sticky nav shadow, reveals, counters, and prototype animations. */}
      <LandingPageEffects rootId="landing-page" />
    </main>
  );
}
