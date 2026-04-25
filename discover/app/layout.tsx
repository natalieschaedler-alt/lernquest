/**
 * Root layout. Sets up the Inter variable font, applies the dark base theme,
 * and renders any child route segment without additional chrome — the
 * Header + BottomTabBar live in app/(main)/layout.tsx.
 */
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Discover",
  description: "Frisch reingestellt, lokal kuratiert, premium ausgewählt.",
};

export const viewport: Viewport = {
  themeColor: "#0A0A0B",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={inter.variable}>
      <body className="min-h-dvh bg-bg-primary text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
