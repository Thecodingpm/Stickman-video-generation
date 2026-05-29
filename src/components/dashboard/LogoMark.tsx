type LogoMarkProps = {
  className?: string;
  tone?: "dark" | "light";
};

export default function LogoMark({
  className = "h-10 w-10",
  tone = "dark",
}: LogoMarkProps) {
  const shell = tone === "light" ? "#FFFFFF" : "#101014";
  const border = tone === "light" ? "#E5E7EB" : "#2A2A32";
  const ink = tone === "light" ? "#101014" : "#FFFFFF";

  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="56" height="56" rx="16" fill={shell} />
      <rect x="4.75" y="4.75" width="54.5" height="54.5" rx="15.25" stroke={border} strokeWidth="1.5" />

      <path
        d="M19 39.5C21.7 48.3 34.7 50.4 41.2 44.2C48.7 37.1 41.7 29.2 31.2 31.1C20.8 33 16.2 25.1 22.4 18.9C28.8 12.5 41.3 14.9 44 23.6"
        stroke="url(#scribeFlow)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <rect x="22" y="22" width="20" height="20" rx="5" fill={ink} />
      <path d="M29 27.5L38 32L29 36.5V27.5Z" fill="#BEF264" />

      <path
        d="M17 49L24 42"
        stroke="#7DD3FC"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="47" cy="17" r="4" fill="#F9735B" />
      <circle cx="16" cy="30" r="2.6" fill="#BEF264" />

      <defs>
        <linearGradient id="scribeFlow" x1="18" y1="16" x2="47" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#BEF264" />
          <stop offset="0.52" stopColor="#7DD3FC" />
          <stop offset="1" stopColor="#F9735B" />
        </linearGradient>
      </defs>
    </svg>
  );
}
