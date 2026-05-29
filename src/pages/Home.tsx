import { Link } from "react-router-dom";
import Navbar from "../components/dashboard/Navbar";
import PricingCard from "../components/dashboard/PricingCard";

const templates = [
  "Startup Explainer",
  "Course Intro",
  "Product Demo",
  "Client Pitch",
  "Social Ad",
  "Training Scene",
];

const features = [
  {
    title: "Script to storyboard",
    description:
      "Move from rough idea to scene structure without opening a complex editor first.",
    color: "bg-lime-300",
  },
  {
    title: "Whiteboard-ready scenes",
    description:
      "Use layouts made for hand-drawn reveals, explainers, lessons, and pitch videos.",
    color: "bg-sky-300",
  },
  {
    title: "Fast project handoff",
    description:
      "Jump from landing page or dashboard straight into the animation editor route.",
    color: "bg-coral",
  },
  {
    title: "Templates that move",
    description:
      "Browse polished starting points that make the product feel creative from the first click.",
    color: "bg-violet-300",
  },
];

const pricingPlans = [
  {
    name: "Starter",
    price: "$12",
    description: "For creators testing whiteboard video ideas.",
    features: ["Unlimited drafts", "Starter templates", "720p exports"],
  },
  {
    name: "Pro",
    price: "$29",
    description: "For weekly explainers, lessons, and launch videos.",
    features: ["Full HD exports", "Brand presets", "Priority rendering"],
    highlighted: true,
  },
  {
    name: "Studio",
    price: "$79",
    description: "For teams producing client-ready animations.",
    features: ["Team projects", "Shared templates", "Review links"],
  },
];

function HeroPreview() {
  return (
    <div className="relative mx-auto mt-12 max-w-6xl lg:mt-16">
      <div className="motion-grid relative overflow-hidden rounded-lg border border-white/10 bg-[#101014] p-4 shadow-2xl sm:p-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex gap-2">
            <span className="h-3 w-3 rounded-full bg-coral" />
            <span className="h-3 w-3 rounded-full bg-amber-300" />
            <span className="h-3 w-3 rounded-full bg-lime-300" />
          </div>
          <div className="hidden items-center gap-2 text-xs font-semibold text-white/50 sm:flex">
            <span className="h-2 w-2 rounded-full bg-lime-300 animate-pulse-dot" />
            Live preview
          </div>
        </div>

        <div className="grid gap-4 pt-4 lg:grid-cols-[180px_1fr_220px]">
          <aside className="hidden space-y-3 lg:block">
            {["Hook", "Sketch", "Reveal", "Offer"].map((scene, index) => (
              <div
                key={scene}
                className={[
                  "rounded-lg border p-3",
                  index === 1
                    ? "border-lime-300 bg-lime-300 text-[#101014]"
                    : "border-white/10 bg-white/5 text-white/70",
                ].join(" ")}
              >
                <p className="text-xs font-bold uppercase">Scene {index + 1}</p>
                <p className="mt-1 text-sm font-semibold">{scene}</p>
              </div>
            ))}
          </aside>

          <div className="paper-grid relative min-h-[340px] overflow-hidden rounded-lg bg-[#f6f7fb] p-5 sm:min-h-[420px] sm:p-8">
            <div className="absolute left-5 top-5 rounded-md bg-white px-3 py-2 text-xs font-bold text-[#101014] shadow-sm">
              Whiteboard scene
            </div>
            <div className="absolute right-5 top-5 rounded-md bg-[#101014] px-3 py-2 text-xs font-bold text-white shadow-sm">
              00:18
            </div>

            <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center pt-10 text-center">
              <div className="relative mb-8 h-32 w-full max-w-md">
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 460 150" fill="none" aria-hidden="true">
                  <path
                    className="animate-draw-line"
                    d="M18 104 C78 8 146 24 186 83 C228 145 286 139 323 73 C354 18 411 20 443 66"
                    stroke="#101014"
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M52 120 L126 120 L126 72 L52 72 Z"
                    stroke="#23b26f"
                    strokeWidth="7"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M328 118 L398 118 L363 61 Z"
                    stroke="#f9735b"
                    strokeWidth="7"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h2 className="max-w-lg text-3xl font-black leading-tight text-[#101014] sm:text-5xl">
                Explain the idea visually
              </h2>
              <p className="mt-5 max-w-md text-sm leading-6 text-slate-600 sm:text-base">
                Start with scenes, voiceover notes, and motion-friendly templates.
              </p>
            </div>

            <div className="animate-float-card absolute bottom-8 left-5 hidden w-36 rounded-lg bg-sky-300 p-4 shadow-lg sm:block">
              <p className="text-xs font-bold uppercase text-[#101014]">Voiceover</p>
              <div className="mt-3 h-2 rounded bg-[#101014]/70" />
              <div className="mt-2 h-2 w-2/3 rounded bg-[#101014]/40" />
            </div>
            <div className="animate-float-card absolute bottom-10 right-6 hidden w-40 rounded-lg bg-lime-300 p-4 shadow-lg sm:block [animation-delay:1.2s]">
              <p className="text-xs font-bold uppercase text-[#101014]">Sketch action</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <span className="h-8 rounded bg-white/75" />
                <span className="h-8 rounded bg-[#101014]" />
                <span className="h-8 rounded bg-white/75" />
              </div>
            </div>
          </div>

          <aside className="hidden rounded-lg border border-white/10 bg-white/5 p-4 lg:block">
            <div className="flex items-center justify-between text-xs font-semibold uppercase text-white/50">
              <span>Timeline</span>
              <span>24 fps</span>
            </div>
            <div className="relative mt-5 h-44 overflow-hidden rounded-lg bg-[#08080d] p-3">
              <span className="animate-timeline-scan absolute bottom-3 top-3 w-1 rounded-full bg-lime-300" />
              {[
                ["bg-lime-300", "w-[72px]"],
                ["bg-sky-300", "w-[96px]"],
                ["bg-coral", "w-[120px]"],
                ["bg-violet-300", "w-[144px]"],
              ].map(([color, width]) => (
                <div key={color} className="mb-3 flex items-center gap-2">
                  <span className={["h-7 rounded-md", color, width].join(" ")} />
                  <span className="h-2 flex-1 rounded bg-white/10" />
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-white/10 p-3">
                <p className="text-xs text-white/50">Scenes</p>
                <p className="mt-1 text-2xl font-black text-white">12</p>
              </div>
              <div className="rounded-lg bg-white/10 p-3">
                <p className="text-xs text-white/50">Export</p>
                <p className="mt-1 text-2xl font-black text-white">HD</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f6f7fb] text-[#101014]">
      <Navbar variant="dark" />

      <main>
        <section className="overflow-hidden bg-[#08080d] text-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mx-auto inline-flex rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold text-lime-200">
                Whiteboard animation, minus the heavy setup
              </div>
              <h1 className="mt-7 text-5xl font-black leading-[0.96] text-white sm:text-7xl lg:text-8xl">
                Make explainer videos feel alive.
              </h1>
              <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-white/70">
                A flashy, fast workspace for scripting scenes, browsing animation
                templates, and jumping straight into your existing editor.
              </p>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  to="/editor"
                  className="rounded-md bg-lime-300 px-6 py-3 text-base font-bold text-[#101014] shadow-sm transition hover:bg-lime-200 animate-pulse-dot"
                >
                  Start Creating
                </Link>
                <Link
                  to="/dashboard"
                  className="rounded-md border border-white/10 px-6 py-3 text-base font-bold text-white transition hover:bg-white/10"
                >
                  View Dashboard
                </Link>
              </div>
            </div>

            <HeroPreview />
          </div>

          <div className="border-y border-white/10 bg-white/5 py-5 overflow-hidden">
            <div className="flex min-w-max animate-marquee gap-4">
              {[...templates, ...templates].map((template, index) => (
                <div
                  key={template + "-" + index}
                  className="rounded-lg border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white/80"
                >
                  {template}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div>
                <p className="text-sm font-bold uppercase text-coral">Creative workflow</p>
                <h2 className="mt-3 text-4xl font-black leading-tight text-[#101014] sm:text-5xl">
                  The dashboard should feel like part of the animation tool.
                </h2>
              </div>
              <p className="text-lg leading-8 text-slate-600">
                Instead of a basic admin page, the UI now uses scene previews,
                animated template strips, and motion-focused cards that match the
                product you are building.
              </p>
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <article
                  key={feature.title}
                  className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-soft"
                >
                  <div className={["h-12 w-12 rounded-lg", feature.color].join(" ")} />
                  <h3 className="mt-5 text-xl font-black text-[#101014]">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {feature.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-[#101014] p-4 shadow-soft">
                <div className="rounded-lg bg-white p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold uppercase text-slate-400">Templates</p>
                    <span className="rounded-md bg-lime-300 px-3 py-1 text-xs font-bold text-[#101014]">
                      New
                    </span>
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    {templates.slice(0, 4).map((template, index) => (
                      <div
                        key={template}
                        className="paper-grid rounded-lg border border-slate-200 p-4"
                      >
                        <div
                          className={[
                            "h-28 rounded-lg",
                            ["bg-lime-300", "bg-sky-300", "bg-coral", "bg-violet-300"][index],
                          ].join(" ")}
                        />
                        <p className="mt-3 font-bold text-[#101014]">{template}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-bold uppercase text-emerald-500">Template-first</p>
                <h2 className="mt-3 text-4xl font-black leading-tight text-[#101014] sm:text-5xl">
                  Give users something exciting before the editor loads.
                </h2>
                <p className="mt-5 text-lg leading-8 text-slate-600">
                  This keeps the UI layer focused on discovery and project launch.
                  The real editor can later take over at the editor route.
                </p>
                <Link
                  to="/dashboard"
                  className="mt-7 inline-flex rounded-md bg-[#101014] px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  Explore Projects
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-bold uppercase text-coral">Pricing</p>
              <h2 className="mt-3 text-4xl font-black text-[#101014] sm:text-5xl">
                Start simple. Scale when the videos do.
              </h2>
            </div>
            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {pricingPlans.map((plan) => (
                <PricingCard key={plan.name} {...plan} />
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>ScribeFlow. A creative UI shell for whiteboard animation.</p>
          <div className="flex gap-5">
            <Link to="/dashboard" className="hover:text-[#101014]">
              Dashboard
            </Link>
            <Link to="/editor" className="hover:text-[#101014]">
              Editor
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
