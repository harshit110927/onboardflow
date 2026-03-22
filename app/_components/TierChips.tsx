"use client";
import { useState } from "react";

export function TierChips() {
  const [active, setActive] = useState<"enterprise" | "individual">("enterprise");

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
      {(["enterprise", "individual"] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setActive(t)}
          style={{
            flex: 1,
            padding: "9px 14px",
            borderRadius: 8,
            border: active === t ? "1px solid #6366f1" : "1px solid #e2e0f5",
            fontSize: 13,
            textAlign: "center",
            cursor: "pointer",
            color: active === t ? "#6366f1" : "#64748b",
            background: active === t ? "#eef2ff" : "#fafafa",
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: active === t ? 500 : 400,
            transition: "all 0.15s",
            textTransform: "capitalize",
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}