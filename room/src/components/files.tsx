import { DownloadIcon, FileArchiveIcon, FileCodeIcon, FileIcon, FileTextIcon, ImageIcon } from "lucide-react";
import { useState } from "react";

import { fileUrl } from "@/lib/api";
import { fileKind, fmtSize, INLINE_TYPES, type FileKind } from "@/lib/format";
import type { FileMeta } from "@/lib/types";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<FileKind, typeof FileIcon> = {
  image: ImageIcon,
  archive: FileArchiveIcon,
  code: FileCodeIcon,
  text: FileTextIcon,
  file: FileIcon,
};

export function FileTypeIcon({ type, name, className }: { type: string; name: string; className?: string }) {
  const Icon = KIND_ICON[fileKind(type, name)];
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-md bg-muted text-muted-foreground", className)}>
      <Icon className="size-4" />
    </span>
  );
}

function FileCard({ file, gone = false }: { file: FileMeta; gone?: boolean }) {
  const name = file.name || "file";
  const body = (
    <>
      <FileTypeIcon type={file.type} name={name} className="size-9" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="max-w-64 truncate font-mono text-xs font-medium">{name}</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {gone ? "No longer available" : fmtSize(file.size)}
        </span>
      </span>
    </>
  );
  if (gone) {
    return (
      <span className="inline-flex max-w-full items-center gap-2.5 rounded-lg border bg-background/60 p-1 pr-3 text-muted-foreground">
        {body}
      </span>
    );
  }
  return (
    <a
      href={fileUrl(file.id)}
      download={name}
      title={`Download ${name}`}
      className="group/file inline-flex max-w-full items-center gap-2.5 rounded-lg border bg-background/60 p-1 pr-2 transition-colors hover:bg-muted in-data-ended:pointer-events-none in-data-ended:opacity-60"
    >
      {body}
      <DownloadIcon aria-hidden className="ml-1 size-3.5 text-muted-foreground group-hover/file:text-foreground" />
    </a>
  );
}

function Thumb({ file, onLoad }: { file: FileMeta; onLoad: (img: HTMLImageElement) => void }) {
  const [broken, setBroken] = useState(false);
  const name = file.name || "image";
  if (broken) return <FileCard file={file} gone />;
  return (
    <a
      href={fileUrl(file.id)}
      target="_blank"
      rel="noopener"
      title={`${name} (${fmtSize(file.size)})`}
      className="block max-w-full overflow-hidden rounded-lg border bg-muted leading-none transition-colors hover:border-foreground/20 in-data-ended:pointer-events-none in-data-ended:opacity-60"
    >
      <img
        src={fileUrl(file.id)}
        alt={name}
        loading="lazy"
        decoding="async"
        className="block h-auto max-h-60 w-auto max-w-[min(320px,100%)]"
        onLoad={(e) => onLoad(e.currentTarget)}
        onError={() => setBroken(true)}
      />
    </a>
  );
}

export function MessageFiles({ files, onImageLoad }: { files: FileMeta[]; onImageLoad: (img: HTMLImageElement) => void }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {files.map((f) =>
        INLINE_TYPES.has(f.type) ? <Thumb key={f.id} file={f} onLoad={onImageLoad} /> : <FileCard key={f.id} file={f} />,
      )}
    </div>
  );
}
