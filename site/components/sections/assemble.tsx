export function Assemble() {
  return (
    <section aria-labelledby="assemble-title" className="relative isolate overflow-hidden border-t">
      <div aria-hidden className="absolute inset-0 -z-10 bg-signal-glow opacity-70" />
      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-28">
        <p className="max-w-xl text-pretty text-sm italic leading-relaxed text-muted-foreground/80 sm:text-base">
          There was an idea… to bring together a group of remarkable harnesses, to see if they could become something
          more. So when we needed them, they could ship what no single agent could.
        </p>
        <h2
          id="assemble-title"
          className="mt-5 text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl lg:text-6xl"
        >
          Harnesses, assemble.
        </h2>
      </div>
    </section>
  );
}
