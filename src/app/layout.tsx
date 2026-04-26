import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "The League",
  description: "The League — fantasy football, all-time stats and history.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "The League",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0e1a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col pb-[calc(64px+var(--safe-bottom))]">
        <main className="flex-1">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
