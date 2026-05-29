import { Link } from "react-router-dom";
import Navbar from "../components/dashboard/Navbar";

const plans = [
  {
    name: "Free",
    price: "$0",
    description: "Good for testing the editor flow while the engine is still in progress.",
    features: ["10 projects", "3 HD exports", "Basic templates"],
  },
  {
    name: "Pro",
    price: "$29",
    description: "For creators making whiteboard explainers every week.",
    features: ["Unlimited projects", "Full HD exports", "Brand presets"],
    highlighted: true,
  },
  {
    name: "Studio",
    price: "$79",
    description: "For teams producing client videos and training content.",
    features: ["Team seats", "Shared templates", "Priority rendering"],
  },
];

const providers = [
  {
    name: "Lemon Squeezy",
    status: "Recommended for Pakistan",
    detail: "Merchant of record option for SaaS subscriptions and digital products.",
  },
  {
    name: "Paddle",
    status: "Good SaaS option",
    detail: "Merchant of record checkout with global tax handling.",
  },
  {
    name: "Stripe",
    status: "Needs supported business country",
    detail: "Great developer experience, but Pakistan is not on Stripe global availability.",
  },
];

const invoices = [
  ["INV-0003", "Pro plan", "May 01, 2026", "$29.00", "Draft"],
  ["INV-0002", "Pro plan", "Apr 01, 2026", "$29.00", "Paid"],
  ["INV-0001", "Starter setup", "Mar 01, 2026", "$12.00", "Paid"],
];

export default function Billing() {
  return (
    <div className="min-h-screen bg-[#f6f7fb] text-[#101014]">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-lg bg-[#101014] text-white shadow-soft">
          <div className="motion-grid grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase text-lime-300">Billing setup</p>
              <h1 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">
                Plans, payments, and upgrade UI
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">
                This page is ready for checkout later, but it does not charge users
                yet. Real billing should be connected after auth and project access
                rules are in place.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/dashboard"
                  className="rounded-md bg-lime-300 px-5 py-3 text-sm font-bold text-[#101014] transition hover:bg-lime-200"
                >
                  Back to Dashboard
                </Link>
                <Link
                  to="/editor"
                  className="rounded-md border border-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  Open Editor
                </Link>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-bold uppercase text-white/50">Current plan</p>
              <div className="mt-3 flex items-end gap-3">
                <span className="text-5xl font-black">Free</span>
                <span className="pb-2 text-sm text-white/50">UI preview</span>
              </div>
              <div className="mt-5 h-2 rounded-full bg-white/10">
                <div className="h-2 w-3/5 rounded-full bg-lime-300" />
              </div>
              <p className="mt-3 text-sm text-white/60">
                6 of 10 projects used. Upgrade CTA is ready for a checkout link.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={[
                "rounded-lg border p-6 transition hover:-translate-y-1",
                plan.highlighted
                  ? "border-[#101014] bg-[#101014] text-white shadow-soft"
                  : "border-slate-200 bg-white text-[#101014] shadow-sm",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-black">{plan.name}</h2>
                {plan.highlighted ? (
                  <span className="rounded-md bg-lime-300 px-3 py-1 text-xs font-black text-[#101014]">
                    Best value
                  </span>
                ) : null}
              </div>
              <p className={plan.highlighted ? "mt-3 text-sm leading-6 text-white/70" : "mt-3 text-sm leading-6 text-slate-600"}>
                {plan.description}
              </p>
              <div className="mt-5 flex items-end gap-1">
                <span className="text-4xl font-black">{plan.price}</span>
                <span className={plan.highlighted ? "pb-1 text-sm text-white/50" : "pb-1 text-sm text-slate-500"}>
                  /mo
                </span>
              </div>
              <ul className={plan.highlighted ? "mt-6 space-y-3 text-sm text-white/80" : "mt-6 space-y-3 text-sm text-slate-700"}>
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-3">
                    <span className={plan.highlighted ? "mt-1 h-2 w-2 rounded-full bg-lime-300" : "mt-1 h-2 w-2 rounded-full bg-emerald-500"} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={[
                  "mt-7 w-full rounded-md px-4 py-3 text-sm font-bold transition",
                  plan.highlighted
                    ? "bg-lime-300 text-[#101014] hover:bg-lime-200"
                    : "bg-slate-100 text-[#101014] hover:bg-slate-200",
                ].join(" ")}
              >
                Checkout placeholder
              </button>
            </article>
          ))}
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-bold uppercase text-coral">Payment providers</p>
                <h2 className="mt-1 text-2xl font-black text-[#101014]">
                  Choose later, show now
                </h2>
              </div>
              <span className="rounded-md bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500">
                No live charges
              </span>
            </div>

            <div className="mt-5 divide-y divide-slate-100">
              {providers.map((provider) => (
                <div key={provider.name} className="grid gap-3 py-5 sm:grid-cols-[180px_1fr_170px] sm:items-center">
                  <div>
                    <p className="font-black text-[#101014]">{provider.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{provider.status}</p>
                  </div>
                  <p className="text-sm leading-6 text-slate-600">{provider.detail}</p>
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 px-4 py-2 text-sm font-bold text-[#101014] transition hover:bg-slate-100"
                  >
                    Configure later
                  </button>
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-bold uppercase text-emerald-500">Payment method</p>
            <h2 className="mt-1 text-2xl font-black text-[#101014]">Card UI</h2>
            <div className="mt-5 rounded-lg bg-[#101014] p-5 text-white">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white/60">ScribeFlow Pro</span>
                <span className="h-8 w-12 rounded-md bg-lime-300" />
              </div>
              <p className="mt-8 text-xl font-black">•••• •••• •••• 4242</p>
              <div className="mt-5 flex justify-between text-xs font-bold uppercase text-white/50">
                <span>Demo card</span>
                <span>05/29</span>
              </div>
            </div>
            <button
              type="button"
              className="mt-5 w-full rounded-md bg-[#101014] px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              Add payment method later
            </button>
          </aside>
        </section>

        <section className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase text-emerald-500">Invoices</p>
              <h2 className="mt-1 text-2xl font-black text-[#101014]">Billing history</h2>
            </div>
            <button
              type="button"
              className="rounded-md bg-slate-100 px-4 py-2 text-sm font-bold text-[#101014] transition hover:bg-slate-200"
            >
              Download all
            </button>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs font-bold uppercase text-slate-400">
                <tr>
                  <th className="py-3 pr-4">Invoice</th>
                  <th className="py-3 pr-4">Item</th>
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-4">Amount</th>
                  <th className="py-3 pr-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map(([invoice, item, date, amount, status]) => (
                  <tr key={invoice}>
                    <td className="py-4 pr-4 font-bold text-[#101014]">{invoice}</td>
                    <td className="py-4 pr-4 text-slate-600">{item}</td>
                    <td className="py-4 pr-4 text-slate-600">{date}</td>
                    <td className="py-4 pr-4 font-bold text-[#101014]">{amount}</td>
                    <td className="py-4 pr-4">
                      <span className={status === "Paid" ? "rounded-md bg-lime-100 px-3 py-1 text-xs font-bold text-emerald-700" : "rounded-md bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700"}>
                        {status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
