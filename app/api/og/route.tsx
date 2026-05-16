import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#0f172a",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            color: "#ffffff",
            fontSize: 96,
            fontWeight: 800,
            letterSpacing: "-0.04em",
          }}
        >
          Dripmetric
        </div>
        <div
          style={{
            color: "#94a3b8",
            fontSize: 38,
            marginTop: 24,
          }}
        >
          Track where users drop off. Drip them back.
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
