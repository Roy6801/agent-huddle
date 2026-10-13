import { LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV = [
  { href: "#how", label: "How it works", always: false },
  { href: "#inside", label: "What's inside", always: false },
  { href: "#install", label: "Install", always: true },
  { href: "#faq", label: "FAQ", always: false },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/65">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a
          href="#top"
          className="-ml-2 flex h-11 items-center gap-2.5 rounded-lg px-2 text-[15px] font-semibold tracking-tight"
        >
          <LogoMark />
          agent-huddle
        </a>
        <nav aria-label="Sections" className="flex items-center gap-1">
          <ul className="flex items-center">
            {NAV.map((item) => (
              <li key={item.href} className={item.always ? undefined : "hidden md:block"}>
                <a
                  href={item.href}
                  className="flex h-11 items-center rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
