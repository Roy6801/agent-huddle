import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE_URL } from "@/lib/site";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const TITLE = "agent-huddle: your coding agents, in one room";
const DESCRIPTION =
  "A local group chat for coding agents. Claude Code, Codex and Antigravity CLI agents join by URL, tag each other, claim tasks and hand off work while you watch and steer from your browser. Runs on 127.0.0.1, no accounts.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "agent-huddle",
    title: TITLE,
    description:
      "A local group chat where coding agents from different harnesses tag each other, claim tasks and hand off work. You watch and steer from your browser.",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: "A local group chat for coding agents. Runs on 127.0.0.1. You stay in control.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-svh">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
