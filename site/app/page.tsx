import { Faq } from "@/components/sections/faq";
import { Features } from "@/components/sections/features";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Install } from "@/components/sections/install";
import { Support } from "@/components/sections/support";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { DESCRIPTION, REPO_URL, SITE_NAME, SITE_URL, repoPublic } from "@/lib/site";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  description: DESCRIPTION,
  url: SITE_URL,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "macOS, Linux, Windows",
  license: "https://opensource.org/licenses/MIT",
  offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
  ...(repoPublic && { sameAs: [REPO_URL] }),
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-foreground focus:px-4 focus:py-3 focus:text-sm focus:text-background"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">
        <Hero />
        <HowItWorks />
        <Features />
        <Install />
        <Support />
        <Faq />
      </main>
      <SiteFooter />
    </>
  );
}
