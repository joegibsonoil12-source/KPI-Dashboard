import React, { useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar } from "recharts";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const BRAND = { primary: "#21253F", secondary: "#B6BE82" };

const formatMoney = (n) =>
  n == null || Number.isNaN(n)
    ? "—"
    : n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function emptyMonthly() {
  return MONTHS.reduce((acc, m) => (acc[m] = 0, acc), {});
}

export default function BudgetPlanner({ budgets, setBudgets, actuals = {} }) {
  const years = Object.keys(budgets ?? {}).length ? Object.keys(budgets) : [String(new Date().getFullYear())];
  const [year, setYear] = useState(years[0]);
  const y = String(year);
  const data = budgets?.[y] ?? { categories: [] };

  const ytdIndex = new Date().getMonth(); // 0-11 current month index
  const ytdMonths = MONTHS.slice(0, ytdIndex + 1);

  // Totals & YTD budget/actual/variance
  const totals = useMemo(() => {
    const byMonth = MONTHS.map((m) => {
      let sum = 0;
      for (const c of (data.categories ?? [])) {
        const v = Number(c.monthly?.[m] ?? 0);
        sum += (c.sign ?? 1) * (Number.isFinite(v) ? v : 0);
      }
      return { month: m, net: sum };
    });
    const ytdBudget = byMonth.slice(0, ytdIndex + 1).reduce((a, b) => a + b.net, 0);

    let ytdActual = null;
    if (actuals?.[y]) {
      let rev = 0, cogs = 0, sga = 0;
      const A = actuals[y];
      for (const m of ytdMonths) {
        rev  += Number(A?.Revenue?.[m] ?? 0);
        cogs += Number(A?.COGS?.[m] ?? 0);
        sga  += Number(A?.["SG&A"]?.[m] ?? 0);
      }
      ytdActual = rev - cogs - sga;
    }
    return { byMonth, ytdBudget, ytdActual, ytdVariance: ytdActual == null ? null : (ytdBudget - ytdActual) };
  }, [data, actuals, y, ytdIndex]);

  const chartData = useMemo(() => [{ name: "YTD", Budget: totals.ytdBudget, Actual: totals.ytdActual ?? 0 }], [totals]);

  // Mutations
  const setCell = (id, m, val) => {
    const v = Number(val);
    const next = structuredClone(budgets);
    const cats = next[y]?.categories ?? [];
    next[y] = { categories: cats.map(c => c.id === id ? { ...c, monthly: { ...c.monthly, [m]: Number.isFinite(v) ? v : 0 } } : c) };
    setBudgets(next);
  };

  const setCatName = (id, name) => {
    const next = structuredClone(budgets);
    next[y] = { categories: (next[y]?.categories ?? []).map(c => c.id === id ? { ...c, name } : c) };
    setBudgets(next);
  };

  const setCatSign = (id, sign) => {
    const next = structuredClone(budgets);
    next[y] = { categories: (next[y]?.categories ?? []).map(c => c.id === id ? { ...c, sign } : c) };
    setBudgets(next);
  };

  const addCategory = () => {
    const id = Math.random().toString(36).slice(2);
    const next = structuredClone(budgets);
    const cats = next[y]?.categories ?? [];
    next[y] = { categories: [...cats, { id, name: "New Category", sign: 1, monthly: emptyMonthly() }] };
    setBudgets(next);
  };

  const deleteCategory = (id) => {
    const next = structuredClone(budgets);
    next[y] = { categories: (next[y]?.categories ?? []).filter(c => c.id !== id) };
    setBudgets(next);
  };

  const addYear = () => {
    const ny = String(Number(Object.keys(budgets).at(-1) || new Date().getFullYear()) + 1);
    if (!budgets[ny]) {
      setBudgets({
        ...budgets,
        [ny]: {
          categories: (budgets[y]?.categories ?? []).map(c => ({ ...c, monthly: emptyMonthly() }))
        }
      });
      setYear(ny);
    } else {
      setYear(ny);
    }
  };

  return (
    <section className="mt-10 rounded-2xl border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800">Budget Planner</h2>
        <div className="flex items-center gap-2">
          <select className="rounded-lg border px-2 py-1 text-sm" value={year} onChange={(e) => setYear(e.target.value)}>
            {Object.keys(budgets).map(yy => <option key={yy} value={yy}>{yy}</option>)}
          </select>
          <button className="rounded-lg border px-3 py-1 text-sm" onClick={addYear}>+ Add Year</button>
          <button className="rounded-lg border px-3 py-1 text-sm" onClick={addCategory}>+ Add Category</button>
        </div>
      </div>

      {/* YTD Cards */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border p-3">
          <div className="text-xs text-slate-500">YTD Budget</div>
          <div className="text-lg font-semibold">{formatMoney(totals.ytdBudget)}</div>
        </div>
        <div className="rounded-xl border p-3">
          <div className="text-xs text-slate-500">YTD Actual</div>
          <div className="text-lg font-semibold">{totals.ytdActual == null ? "— (import to enable)" : formatMoney(totals.ytdActual)}</div>
        </div>
        <div className="rounded-xl border p-3">
          <div className="text-xs text-slate-500">YTD Variance</div>
          <div className={`text-lg font-semibold ${totals.ytdVariance > 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {totals.ytdVariance == null ? "—" : formatMoney(totals.ytdVariance)}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="mb-6 rounded-xl border p-3">
        <div className="mb-2 text-sm font-semibold">Budget vs Actual (YTD)</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(v) => formatMoney(v)} />
            <Legend />
            <Bar dataKey="Budget" fill={BRAND.secondary} />
            <Bar dataKey="Actual" fill={BRAND.primary} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Grid */}
      <div className="overflow-auto">
        <table className="min-w-[900px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="sticky left-0 z-10 border px-3 py-2 text-left bg-slate-50">Category</th>
              <th className="border px-3 py-2">Sign</th>
              {MONTHS.map(m => <th key={m} className="border px-3 py-2">{m}</th>)}
              <th className="border px-3 py-2">Total</th>
              <th className="border px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(data.categories ?? []).map((c) => {
              const total = MONTHS.reduce((a, m) => a + (Number(c.monthly?.[m] ?? 0) * (c.sign ?? 1)), 0);
              return (
                <tr key={c.id}>
                  <td className="sticky left-0 z-10 border bg-white px-3 py-2">
                    <input className="w-48 rounded border px-2 py-1" value={c.name} onChange={(e) => setCatName(c.id, e.target.value)} />
                  </td>
                  <td className="border px-3 py-2">
                    <select className="rounded border px-2 py-1" value={c.sign ?? 1} onChange={(e) => setCatSign(c.id, Number(e.target.value))}>
                      <option value={1}>+</option>
                      <option value={-1}>−</option>
                    </select>
                  </td>
                  {MONTHS.map((m) => (
                    <td key={m} className="border px-2 py-1">
                      <input
                        type="number"
                        className="w-28 rounded border px-2 py-1"
                        value={c.monthly?.[m] ?? 0}
                        onChange={(e) => setCell(c.id, m, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className="border px-3 py-2 font-semibold">{formatMoney(total)}</td>
                  <td className="border px-3 py-2">
                    <button className="rounded border px-2 py-1 text-xs" onClick={() => deleteCategory(c.id)}>Delete</button>
                  </td>
                </tr>
              );
            })}
            <tr className="bg-slate-50 font-semibold">
              <td className="sticky left-0 z-10 border bg-slate-50 px-3 py-2">Net Income (Budget)</td>
              <td className="border px-3 py-2">=</td>
              {MONTHS.map((m) => {
                const net = (data.categories ?? []).reduce((a, c) => a + (c.sign ?? 1) * Number(c.monthly?.[m] ?? 0), 0);
                return <td key={m} className="border px-3 py-2">{formatMoney(net)}</td>;
              })}
              <td className="border px-3 py-2">
                {formatMoney((data.categories ?? []).reduce(
                  (a, c) => a + (c.sign ?? 1) * MONTHS.reduce((s, m) => s + Number(c.monthly?.[m] ?? 0), 0), 0
                ))}
              </td>
              <td className="border px-3 py-2"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Import JSON with <code>actuals[year]</code> → <code>Revenue/COGS/SG&amp;A</code> monthly values to enable Actuals & Variance.
      </p>
    </section>
  );
}
