import { Link } from "react-router-dom";
import LogoMark from "./LogoMark";

type NavbarProps = {
  variant?: "light" | "dark";
};

export default function Navbar({ variant = "light" }: NavbarProps) {
  const isDark = variant === "dark";

  return (
    <header
      className={[
        "sticky top-0 z-20 border-b backdrop-blur",
        isDark
          ? "border-white/10 bg-[#08080d]/95 text-white"
          : "border-slate-200/80 bg-white/95 text-[#101014]",
      ].join(" ")}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3 font-semibold" aria-label="ScribeFlow home">
          <LogoMark className="h-10 w-10 shrink-0" tone={isDark ? "light" : "dark"} />
          <span className="hidden text-lg font-black sm:inline">ScribeFlow</span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-3">
          <Link
            to="/dashboard"
            className={[
              "inline-flex rounded-md px-2 py-2 text-sm font-medium transition sm:px-4",
              isDark
                ? "text-white/70 hover:bg-white/10 hover:text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-[#101014]",
            ].join(" ")}
          >
            Dashboard
          </Link>
          <a
            href="/#pricing"
            className={[
              "inline-flex rounded-md px-2 py-2 text-sm font-medium transition sm:px-4",
              isDark
                ? "text-white/70 hover:bg-white/10 hover:text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-[#101014]",
            ].join(" ")}
          >
            Pricing
          </a>
          <Link
            to="/editor"
            className={[
              "inline-flex rounded-md px-3 py-2 text-sm font-semibold shadow-sm transition sm:px-4",
              isDark
                ? "bg-white text-[#08080d] hover:bg-lime-200"
                : "bg-[#101014] text-white hover:bg-slate-800",
            ].join(" ")}
          >
            Open Editor
          </Link>
        </div>
      </nav>
    </header>
  );
}
