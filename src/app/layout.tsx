import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Shell } from "@/components/Shell";
import { RegisterSW } from "@/components/RegisterSW";
import { readDevState } from "@/core/dev-state";
import { VERSION } from "@/core/version";

export const metadata: Metadata = {
  title: "sparrow",
  description: "Work task board",
  appleWebApp: { capable: true, title: "sparrow", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Only `pnpm dev` can switch between the local DB and prod. See scripts/dev.sh.
  const env = process.env.NODE_ENV === "development" ? (readDevState()?.env ?? "dev") : undefined;
  return (
    <html lang="en" data-env={env}>
      <body>
        <Shell env={env} version={VERSION}>{children}</Shell>
        <RegisterSW />
      </body>
    </html>
  );
}
