import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "kb",
  description: "A local file-based kanban board",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
