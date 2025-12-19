"use client"

import dynamic from "next/dynamic";

// This component is safe to import in Server Components
// It handles the "no-ssr" logic internally
const FunnelChart = dynamic(
  () => import("./FunnelChart").then((mod) => mod.FunnelChart),
  { ssr: false }
);

export default FunnelChart;