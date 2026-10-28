import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Shell } from "@/components/Shell";
import { RegisterSW } from "@/components/RegisterSW";

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
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
        <RegisterSW />
      </body>
    </html>
  );
}
