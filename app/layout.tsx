import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Nav } from "@/components/Nav";
import { ProfileProvider } from "@/components/ProfileContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Hub - Your next opportunity starts here",
  description: "Analyze your resume and find real jobs ranked by how well they fit your profile.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0B0B0D" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ProfileProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-1 focus:text-ink">Skip to content</a>
          <Nav />
          <main id="main" className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </ProfileProvider>
      </body>
    </html>
  );
}
