import type { Metadata, Viewport } from "next";
import React from "react";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "NASA Space Mission Design Game",
  description: "Interactive browser-based space mission engineering game for NASA Space Apps Challenge 2026",
};

export const viewport: Viewport = {
  themeColor: "#0b0e14",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
