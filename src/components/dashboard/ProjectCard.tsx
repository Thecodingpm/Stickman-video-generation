import { useState } from "react";

type ProjectCardProps = {
  id: string;
  title: string;
  updatedAt: string;
  accent: string;
  type?: string;
  duration?: string;
  onOpen?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, newName: string) => void;
};

export default function ProjectCard({
  id,
  title,
  updatedAt,
  accent,
  type = "Explainer",
  duration = "00:42",
  onOpen,
  onDelete,
  onRename,
}: ProjectCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [nameVal, setNameVal] = useState(title);

  const handleSaveRename = () => {
    const trimmed = nameVal.trim();
    if (trimmed && trimmed !== title && onRename) {
      onRename(id, trimmed);
    }
    setIsEditing(false);
  };

  return (
    <article className="group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-soft">
      <div className={["relative aspect-video overflow-hidden p-4", accent].join(" ")}>
        <div className="absolute right-4 top-4 rounded-md bg-[#101014] px-2.5 py-1 text-xs font-semibold text-white">
          {duration}
        </div>
        <div className="paper-grid h-full rounded-lg border border-white/80 bg-white/80 p-4 shadow-sm backdrop-blur">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </div>
            <span className="h-2 w-12 rounded bg-slate-300" />
          </div>
          <div className="relative h-[calc(100%-1.5rem)] overflow-hidden rounded-md bg-white/75 p-4">
            <svg className="absolute left-5 top-7 h-16 w-32" viewBox="0 0 160 72" fill="none" aria-hidden="true">
              <path
                className="animate-draw-line"
                d="M6 50 C36 10 74 10 95 42 C108 62 134 58 152 22"
                stroke="#101014"
                strokeWidth="5"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute bottom-4 left-4 right-4 grid grid-cols-4 gap-2">
              <div className="h-8 rounded-md bg-[#101014]" />
              <div className="h-8 rounded-md bg-lime-300" />
              <div className="h-8 rounded-md bg-sky-300" />
              <div className="h-8 rounded-md bg-rose-400" />
            </div>
          </div>
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase text-slate-400">{type}</p>
            {isEditing ? (
              <input
                type="text"
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                onBlur={handleSaveRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveRename();
                  if (e.key === "Escape") {
                    setNameVal(title);
                    setIsEditing(false);
                  }
                }}
                autoFocus
                className="mt-1 w-full rounded border border-slate-300 px-1.5 py-0.5 text-sm font-semibold text-[#101014] outline-none focus:border-[#101014]"
              />
            ) : (
              <div className="mt-1 flex items-center gap-1.5 group/title">
                <h3
                  onDoubleClick={() => setIsEditing(true)}
                  className="text-base font-semibold text-[#101014] truncate cursor-text"
                  title="Double-click to rename"
                >
                  {title}
                </h3>
                {onRename && (
                  <button
                    onClick={() => setIsEditing(true)}
                    title="Rename project"
                    className="opacity-0 group-hover/title:opacity-100 p-0.5 rounded text-slate-400 hover:text-[#101014] transition cursor-pointer text-xs"
                  >
                    ✏️
                  </button>
                )}
              </div>
            )}
            <p className="mt-1 text-sm text-slate-500">{updatedAt}</p>
          </div>
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete project "${title}" permanently?`)) {
                  onDelete(id);
                }
              }}
              title="Delete project"
              className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition cursor-pointer"
            >
              🗑️
            </button>
          )}
        </div>
        <button
          onClick={() => {
            if (onOpen) onOpen(id);
          }}
          className="mt-5 inline-flex w-full justify-center rounded-md bg-[#101014] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 cursor-pointer"
        >
          Open Project
        </button>
      </div>
    </article>
  );
}
