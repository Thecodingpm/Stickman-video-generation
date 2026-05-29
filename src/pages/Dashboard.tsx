import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/dashboard/Navbar";
import ProjectCard from "../components/dashboard/ProjectCard";
import { sceneStore } from "../store/sceneStore";

export default function Dashboard() {
  const navigate = useNavigate();
  const [projectsList, setProjectsList] = useState(() => sceneStore.listProjects());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");

  const ACCENTS = [
    "bg-lime-200",
    "bg-sky-200",
    "bg-orange-200",
    "bg-violet-200",
    "bg-rose-200",
    "bg-amber-200",
  ];

  const formatDuration = (secNum: number) => {
    const m = Math.floor(secNum / 60).toString().padStart(2, "0");
    const s = Math.floor(secNum % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "Updated just now";
      if (mins < 60) return `Updated ${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `Updated ${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      if (days === 1) return "Updated yesterday";
      if (days < 7) return `Updated ${days} days ago`;
      return `Updated on ${new Date(dateStr).toLocaleDateString()}`;
    } catch {
      return "Updated recently";
    }
  };

  const templates = [
    { id: "blank", title: "Blank whiteboard", color: "bg-white", tag: "Start clean" },
    { id: "startup-pitch", title: "Startup pitch", color: "bg-lime-300", tag: "Popular" },
    { id: "lesson-opener", title: "Lesson opener", color: "bg-sky-300", tag: "Education" },
    { id: "product-reveal", title: "Product reveal", color: "bg-coral", tag: "Launch" },
  ];

  const activity = useMemo(() => {
    const list: [string, string][] = [
      ["Template added", "Course intro pack is available"],
    ];
    if (projectsList.length > 0) {
      const newest = [...projectsList].sort(
        (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
      )[0];
      list.unshift(["Scene updated", `"${newest.name}" has new timeline parameters`]);
      list.push(["Project library synced", `${projectsList.length} drafts persisted in local memory`]);
    }
    return list;
  }, [projectsList]);

  const stats = useMemo(() => {
    const totalSecs = projectsList.reduce((acc, p) => acc + (p.duration ?? 0), 0);
    const totalTimeStr = totalSecs > 60 ? `${Math.round(totalSecs / 60)}m` : `${Math.round(totalSecs)}s`;
    return [
      [projectsList.length.toString(), "Drafts"],
      ["6", "Exports"],
      [totalTimeStr, "Video time"],
      ["4", "Templates"],
    ];
  }, [projectsList]);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return projectsList.filter((project) => {
      const type = (project as any).type ?? "Explainer";
      const matchesFilter = filter === "All" || type === filter;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        project.name.toLowerCase().includes(normalizedQuery) ||
        type.toLowerCase().includes(normalizedQuery);

      return matchesFilter && matchesQuery;
    });
  }, [projectsList, filter, query]);

  const filters = useMemo(() => {
    const types = projectsList.map((p) => (p as any).type ?? "Explainer");
    return ["All", ...Array.from(new Set(types))];
  }, [projectsList]);

  const handleOpenProject = (id: string) => {
    sceneStore.loadProject(id);
    navigate("/editor");
  };

  const handleDeleteProject = (id: string) => {
    sceneStore.deleteProject(id);
    setProjectsList(sceneStore.listProjects());
  };

  const handleRenameProject = (id: string, newName: string) => {
    sceneStore.renameProject(id, newName);
    setProjectsList(sceneStore.listProjects());
  };

  const handleCreateNewProject = () => {
    sceneStore.createProject("Untitled Project");
    navigate("/editor");
  };

  const handleCreateFromTemplate = (templateId: string, title: string) => {
    const name = templateId === "blank" ? "Blank Canvas" : `${title} Scribe`;
    sceneStore.createProject(name, templateId);
    navigate("/editor");
  };

  // Billing active items counts
  const projectsPct = Math.min(100, Math.round((projectsList.length / 10) * 100));

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-900">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-lg bg-[#101014] text-white shadow-soft">
          <div className="motion-grid grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_400px] lg:items-center">
            <div>
              <div className="inline-flex rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm font-bold text-lime-300">
                Pro workspace preview
              </div>
              <h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">
                Your Projects
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">
                Manage whiteboard videos, start from templates, track usage, and
                jump into the editor when the engine is ready.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handleCreateNewProject}
                  className="rounded-md bg-lime-300 px-5 py-3 text-sm font-bold text-[#101014] transition hover:bg-lime-200 cursor-pointer text-center"
                >
                  Create New Project
                </button>
                <Link
                  to="/billing"
                  className="rounded-md border border-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 text-center"
                >
                  Manage Billing
                </Link>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between text-xs font-bold uppercase text-white/50">
                <span>Production pulse</span>
                <span>Live UI</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
                {stats.map(([value, label]) => (
                  <div key={label} className="rounded-lg bg-white/10 p-4">
                    <p className="text-3xl font-black">{value}</p>
                    <p className="mt-1 text-xs text-white/50">{label}</p>
                  </div>
                ))}
              </div>
              <div className="relative mt-5 h-16 overflow-hidden rounded-lg bg-[#08080d] p-3">
                <span className="animate-timeline-scan absolute bottom-2 top-2 w-1 rounded-full bg-lime-300" />
                <div className="flex h-full items-center gap-3">
                  <span className="h-7 w-20 rounded-md bg-lime-300" />
                  <span className="h-7 w-28 rounded-md bg-sky-300" />
                  <span className="h-7 w-16 rounded-md bg-[#e11d48]" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase text-[#f43f5e]">Quick start</p>
                <h2 className="mt-1 text-2xl font-black text-[#101014]">Templates</h2>
              </div>
              <button
                onClick={handleCreateNewProject}
                className="text-sm font-bold text-[#101014] hover:text-[#0d9488] cursor-pointer"
              >
                Open editor
              </button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {templates.map((template) => (
                <button
                  key={template.title}
                  onClick={() => handleCreateFromTemplate(template.id, template.title)}
                  className="group text-left rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-soft cursor-pointer"
                >
                  <div
                    className={[
                      "paper-grid h-32 rounded-lg border border-slate-200",
                      template.color,
                    ].join(" ")}
                  >
                    <div className="flex h-full items-end p-3">
                      <span className="h-3 w-20 rounded bg-[#101014] transition-all group-hover:w-28" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="font-bold text-[#101014]">{template.title}</p>
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">
                      {template.tag}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold uppercase text-[#0d9488]">Plan</p>
                <h2 className="mt-1 text-2xl font-black text-[#101014]">Free</h2>
              </div>
              <Link
                to="/billing"
                className="rounded-md bg-lime-300 px-3 py-1 text-xs font-black text-[#101014] transition hover:bg-lime-200"
              >
                Upgrade
              </Link>
            </div>
            <div className="mt-5 space-y-4">
              {[
                ["Projects", `${projectsList.length} of 10`, `${projectsPct}%`],
                ["HD exports", "2 of 3", "66%"],
                ["Storage", "1.4 GB of 2 GB", "70%"],
              ].map(([label, value, width]) => (
                <div key={label}>
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-[#101014]">{label}</span>
                    <span className="text-slate-500">{value}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-[#101014]" style={{ width }} />
                  </div>
                </div>
              ))}
            </div>
            <Link
              to="/billing"
              className="mt-6 inline-flex w-full justify-center rounded-md bg-[#101014] px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 text-center"
            >
              Upgrade Plan
            </Link>
          </aside>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-bold uppercase text-[#0d9488]">Recent work</p>
                <h2 className="mt-1 text-2xl font-black text-[#101014]">Project library</h2>
              </div>
              <div className="w-full sm:w-80">
                <label className="sr-only" htmlFor="project-search">
                  Search projects
                </label>
                <input
                  id="project-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search projects"
                  className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-[#101014]"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {filters.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={[
                    "rounded-md px-3 py-2 text-sm font-bold transition cursor-pointer",
                    filter === item
                      ? "bg-[#101014] text-white"
                      : "bg-white text-slate-600 hover:bg-slate-100",
                  ].join(" ")}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {filteredProjects.map((project, idx) => (
                <ProjectCard
                  key={project.id}
                  id={project.id}
                  title={project.name}
                  updatedAt={formatRelativeTime(project.lastUpdated)}
                  accent={ACCENTS[idx % ACCENTS.length]}
                  type={(project as any).type ?? "Explainer"}
                  duration={formatDuration(project.duration ?? 0)}
                  onOpen={handleOpenProject}
                  onDelete={handleDeleteProject}
                  onRename={handleRenameProject}
                />
              ))}
            </div>

            {filteredProjects.length === 0 ? (
              <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
                <h3 className="text-xl font-black text-[#101014]">No projects found</h3>
                <p className="mt-2 text-sm text-slate-500">
                  Try a different search or start a new whiteboard animation.
                </p>
              </div>
            ) : null}
          </div>

          <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold uppercase text-[#f43f5e]">Activity</p>
            <h2 className="mt-1 text-2xl font-black text-[#101014]">Today</h2>
            <div className="mt-5 space-y-4">
              {activity.map(([title, detail]) => (
                <div key={title} className="border-l-4 border-lime-300 pl-4">
                  <p className="font-bold text-[#101014]">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{detail}</p>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
