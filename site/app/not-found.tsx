import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex min-h-[60svh] max-w-6xl flex-col items-start justify-center gap-4 px-4 py-24 sm:px-6">
        <p className="text-sm text-muted-foreground">404</p>
        <h1 className="text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Page not found</h1>
        <p className="max-w-xl text-pretty text-muted-foreground">That page does not exist. It may have moved, or the link is wrong.</p>
        <Link href="/" className="flex h-11 items-center font-medium underline underline-offset-4">
          Back to the home page
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
