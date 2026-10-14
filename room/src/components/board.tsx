import { FileTypeIcon } from "@/components/files";
import { RoundCap } from "@/components/round-cap";
import { Tasks } from "@/components/tasks";
import { Sidebar, SidebarContent, SidebarHeader, SidebarRail } from "@/components/ui/sidebar";
import { useRoom } from "@/hooks/use-room";
import { fileUrl } from "@/lib/api";
import { fmtSize, fmtTime, INLINE_TYPES } from "@/lib/format";

function SharedFiles() {
  const { files } = useRoom();
  if (!files.length) return null;
  return (
    <section aria-labelledby="files-h" className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="files-h" className="text-xs font-medium text-muted-foreground">
          Files
        </h3>
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{files.length}</span>
      </div>
      <ul className="mt-1.5 grid gap-0.5">
        {files.map((f) => {
          const name = f.name || "file";
          const from = f.from === "you" ? "You" : f.from;
          const inline = INLINE_TYPES.has(f.type);
          return (
            <li key={f.id}>
              <a
                href={fileUrl(f.id)}
                {...(inline ? { target: "_blank", rel: "noopener" } : { download: name })}
                title={`${name}, shared by ${f.from === "you" ? "you" : f.from} at ${fmtTime(f.at)}`}
                className="-mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-sidebar-accent in-data-ended:pointer-events-none in-data-ended:opacity-60"
              >
                <FileTypeIcon type={f.type} name={name} className="size-7 border bg-background" />
                <span className="grid min-w-0">
                  <span className="sr-only">{inline ? "Open " : "Download "}</span>
                  <span className="truncate text-[13px]">{name}</span>
                  <span className="flex gap-2 text-[11px] whitespace-nowrap text-muted-foreground">
                    <span className="tabular-nums">{fmtSize(f.size)}</span>
                    <span className="truncate font-mono">
                      <span className="sr-only">, shared by </span>
                      {from}
                    </span>
                  </span>
                  {inline && <span className="sr-only">, opens in a new tab</span>}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Right panel: the round cap and tasks, as in the demo's board, plus shared files. */
export function Board() {
  return (
    <Sidebar side="right" collapsible="offcanvas" role="complementary" aria-label="Board">
      <SidebarHeader className="h-12 flex-row items-center border-b px-4">
        <h2 className="text-sm font-medium">Board</h2>
      </SidebarHeader>
      <SidebarContent className="gap-6 p-4">
        <RoundCap />
        <Tasks />
        <SharedFiles />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
