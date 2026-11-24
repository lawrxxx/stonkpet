import type { Metadata, Viewport } from "next";
import { ClientProviders } from "@/components/ClientProviders";
import { Shell } from "@/components/Shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "stonkpet",
  description: "Your investing agent is a pet. Tell it what you're into, set a few rules, and it builds a portfolio of tokenized stocks on Base.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#FBF6EC" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ClientProviders>
          <Shell>{children}</Shell>
        </ClientProviders>
      </body>
    </html>
  );
}
