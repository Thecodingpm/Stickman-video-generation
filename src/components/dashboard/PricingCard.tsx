import { Link } from "react-router-dom";

type PricingCardProps = {
  name: string;
  price: string;
  description: string;
  features: string[];
  highlighted?: boolean;
};

export default function PricingCard({
  name,
  price,
  description,
  features,
  highlighted = false,
}: PricingCardProps) {
  return (
    <article
      className={[
        "flex h-full flex-col rounded-lg border p-6 transition hover:-translate-y-1",
        highlighted
          ? "border-[#101014] bg-[#101014] text-white shadow-soft"
          : "border-slate-200 bg-white text-[#101014] shadow-sm",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{name}</h3>
        {highlighted ? (
          <span className="rounded-md bg-lime-300 px-3 py-1 text-xs font-semibold text-[#101014]">
            Popular
          </span>
        ) : null}
      </div>
      <p className={highlighted ? "mt-3 text-sm leading-6 text-white/70" : "mt-3 text-sm leading-6 text-slate-600"}>
        {description}
      </p>
      <div className="mt-5 flex items-end gap-1">
        <span className="text-4xl font-bold">{price}</span>
        <span className={highlighted ? "pb-1 text-sm text-white/50" : "pb-1 text-sm text-slate-500"}>
          /mo
        </span>
      </div>
      <ul className={highlighted ? "mt-6 space-y-3 text-sm text-white/80" : "mt-6 space-y-3 text-sm text-slate-700"}>
        {features.map((feature) => (
          <li key={feature} className="flex gap-3">
            <span className={highlighted ? "mt-1 h-2 w-2 rounded-full bg-lime-300" : "mt-1 h-2 w-2 rounded-full bg-emerald-500"} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <Link
        to="/editor"
        className={[
          "mt-7 inline-flex justify-center rounded-md px-4 py-3 text-sm font-semibold transition",
          highlighted
            ? "bg-lime-300 text-[#101014] hover:bg-lime-200"
            : "bg-slate-100 text-[#101014] hover:bg-slate-200",
        ].join(" ")}
      >
        Start Creating
      </Link>
    </article>
  );
}
