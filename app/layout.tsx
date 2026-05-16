import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { organizationSchema } from "./schema";

export const metadata: Metadata = {
  title: "Dripmetric — Track where users drop off. Drip them back.",
  description: "Dripmetric tracks where SaaS users get stuck during onboarding and automatically sends drip emails to bring them back. One npm install. Free to start.",
  metadataBase: new URL("https://www.dripmetric.com"),
  openGraph: {
    title: "Dripmetric — Onboarding analytics and drip automation",
    description: "Track where users drop off and automatically nudge them back. One npm install for developers. No-code dashboard for small businesses.",
    url: "https://www.dripmetric.com",
    siteName: "Dripmetric",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dripmetric",
    description: "Track where users drop off. Drip them back automatically.",
    site: "@dripmetric",
  },
  keywords: [
    "SaaS onboarding automation",
    "drip email automation",
    "user onboarding tracking",
    "onboarding drop-off",
    "drip email SDK",
    "funnel analytics",
    "email automation for SaaS",
    "npm onboarding SDK",
    "user activation emails",
    "dripmetric"
  ],
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body>{children}
      <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
