// src/components/OperationalKPIs.jsx
import React, { useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Legend
} from "recharts";

const BRAND = { primary: "#21253F", secondary: "#B6BE82" };

// tiny CSV parser
function parseCSV(text) {
  const rows = text.trim().split(/\r?\n/);
  if (!rows.length) return [];
  const headers = rows[0].split(",").map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const cols = r.split(",");
    const obj = {};
    headers.forEach((h, i) => (obj[h] = (cols[i] ?? "").trim()));
    return obj;
  });
}

export default function OperationalKPIs({
  employees, setEmployees,
  trucks, setTrucks,
  truckBudget, setTruckBudget, // { [truckId]: { perDelivery, perStop, perMile } }
  opsSettings, setOpsSettings,
  revenuePerEmployee,
}) {
  const empFileRef = useRef(null);
  const trkFileRef = useRef(null);
  const budgetFileRef = useRef(null);

  // ---------- Month Filter ----------
  const allMonths = useMemo(() => {
    const m = new Set();
    employees?.forEach((e) => e.month && m.add(e.month));
    trucks?.forEach((t) => t.month && m.add(t.month));
    return ["All", ...Array.from(m).sort()];
  }, [employees, trucks]);

  const [month, setMonth] = useState("All");

  const employeesFiltered = useMemo(() => {
    if (month === "All") return employees;
    return employees.filter((e) => (e.month || "") === month);
  }, [employees, month]);

  const trucksFiltered = useMemo(() => {
    if (month === "All") return trucks;
    return trucks.filter((t) => (t.month || "") === month);
  }, [trucks, month]);

  // ---------- Importers ----------
  const importEmployeesCSV = (text) => {
    // id,name,role,basePay,benefits,month,hours
    const rows = parseCSV(text);
    const norm = rows.map((r, i) => ({
      id: r.id || `emp_${i + 1}`,
      name: r.name || `Employee ${i + 1}`,
      role: r.role || "",
      basePay: Number(r.basePay || r.base || 0),
      benefits: Number(r.benefits || 0),
      hours: Number(r.hours || 0),
      month: r.month || "",
    }));
    setEmployees(norm);
  };

  const importTrucksCSV = (text) => {
    // id,deliveries,stops,miles,fuelCost,maintenance,insurance,other,month
    const rows = parseCSV(text);
    const norm = rows.map((r, i) => ({
      id: r.id || `truck_${i + 1}`,
      deliveries: Number(r.deliveries || 0),
      stops: Number(r.stops || 0),
      miles: Number(r.miles || 0),
      fuelCost: Number(r.fuelCost || 0),
      maintenance: Number(r.maintenance || 0),
      insurance: Number(r.insurance || 0),
      other: Number(r.other || 0),
      month: r.month || "",
    }));
    setTrucks(norm);
  };

  const importTruckBudgetCSV = (text) => {
    // id,perDelivery,perStop,perMile
    const rows = parseCSV(text);
    const out = {};
    rows.forEach((r) => {
      const id = r.id?.trim();
      if (!id) return;
      out[id] = {
        perDelivery: Number(r.perDelivery || 0),
        perStop: Number(r.perStop || 0),
        perMile: Number(r.perMile || 0),
      };
    });
    setTruckBudget(out);
  };

  // ---------- Derived Employee metrics ----------
  const employeeMetrics = useMemo(() => {
    return (employeesFiltered || []).map((e) => {
      const totalCost = (Number(e.basePay) || 0) + (Number(e.benefits) || 0);
      const rpe = revenuePerEmployee ?? 0;
      const margin = rpe - totalCost;
      const ratio = totalCost ? rpe / totalCost : null;
      return { ...e, totalCost, rpe, margin, ratio };
    });
  }, [employeesFiltered, revenuePerEmployee]);

  const employeeBarData = useMemo(() => {
    return [...employeeMetrics]
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 10)
      .map((e) => ({ name: e.name, TotalCost: e.totalCost, RPE: e.rpe }));
  }, [employeeMetrics]);

  // ---------- Derived Truck metrics ----------
  const truckMetrics = useMemo(() => {
    return (trucksFiltered || []).map((t) => {
      const totalOpCost =
        (Number(t.fuelCost) || 0) +
        (Number(t.maintenance) || 0) +
        (Number(t.insurance) || 0) +
        (Number(t.other) || 0);
      const deliveries = Number(t.deliveries) || 0;
      const stops = Number(t.stops) || 0;
      const miles = Number(t.miles) || 0;

      const actuals = {
        perDelivery: deliveries ? totalOpCost / deliveries : null,
        perStop: stops ? totalOpCost / stops : null,
        perMile: miles ? totalOpCost / miles : null,
      };
      const targets = truckBudget?.[t.id] || {};

      return {
        ...t,
        totalOpCost,
        ...actuals,
        targetPerDelivery: targets.perDelivery ?? null,
        targetPerStop: targets.perStop ?? null,
        targetPerMile: targets.perMile ?? null,
      };
    });
  }, [trucksFiltered, truckBudget]);

  const budgetVsActualData = useMemo(() => {
    // combine into a flat array for a grouped bar chart (per truck)
    return truckMetrics.map((t) => ({
      name: t.id,
      "Actual $/Delivery": t.perDelivery ?? 0,
      "Budget $/Delivery": t.targetPerDelivery ?? 0,
      "Actual $/Stop": t.perStop ?? 0,
      "Budget $/Stop": t.targetPerStop ?? 0,
      "Actual $/Mile": t.perMile ?? 0,
      "Budget $/Mile": t.targetPerMile ?? 0,
    }));
  }, [truckMetrics]);

  const money = (n) =>
    n == null
      ? "—"
      : n.toLocaleString(undefined, {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        });

  return (
    <section className="rounded-2xl border bg-white p-0 shadow-sm">
      {/* Header bar like Geotab section header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-800">Operational KPIs</h2>

        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border px-2 py-1 text-sm"
          >
            {allMonths.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>

          <details className="relative">
            <summary className="cursor-pointer rounded-lg border px-3 py-1.5 text-sm">
              Import Employees
            </summary>
            <div className="absolute right-0 z-10 mt-2 w-[360px] rounded-lg border bg-white p-3 shadow">
              <p className="mb-2 text-xs text-slate-600">
                CSV columns: <code>id,name,role,basePay,benefits,month,hours</code>
              </p>
              <textarea
                rows={6}
                placeholder="Paste CSV…"
                onBlur={(e) => e.target.value && importEmployeesCSV(e.target.value)}
                className="mb-2 w-full rounded border p-2 text-xs"
              />
              <input
                ref={empFileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const fr = new FileReader();
                  fr.onload = () => importEmployeesCSV(String(fr.result || ""));
                  fr.readAsText(f);
                }}
                className="w-full text-xs"
              />
            </div>
          </details>

          <details className="relative">
            <summary className="cursor-pointer rounded-lg border px-3 py-1.5 text-sm">
              Import Trucks
            </summary>
            <div className="absolute right-0 z-10 mt-2 w-[360px] rounded-lg border bg-white p-3 shadow">
              <p className="mb-2 text-xs text-slate-600">
                CSV columns:{" "}
                <code>
                  id,deliveries,stops,miles,fuelCost,maintenance,insurance,other,month
                </code>
              </p>
              <textarea
                rows={6}
                placeholder="Paste CSV…"
                onBlur={(e) => e.target.value && importTrucksCSV(e.target.value)}
                className="mb-2 w-full rounded border p-2 text-xs"
              />
              <input
                ref={trkFileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const fr = new FileReader();
                  fr.onload = () => importTrucksCSV(String(fr.result || ""));
                  fr.readAsText(f);
                }}
                className="w-full text-xs"
              />
            </div>
          </details>

          <details className="relative">
            <summary className="cursor-pointer rounded-lg border px-3 py-1.5 text-sm">
              Import Truck Budgets
            </summary>
            <div className="absolute right-0 z-10 mt-2 w-[360px] rounded-lg border bg-white p-3 shadow">
              <p className="mb-2 text-xs text-slate-600">
                CSV columns: <code>id,perDelivery,perStop,perMile</code>
              </p>
              <textarea
                rows={6}
                placeholder="Paste CSV…"
                onBlur={(e) => e.target.value && importTruckBudgetCSV(e.target.value)}
                className="mb-2 w-full rounded border p-2 text-xs"
              />
              <input
                ref={budgetFileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const fr = new FileReader();
                  fr.onload = () => importTruckBudgetCSV(String(fr.result || ""));
                  fr.readAsText(f);
                }}
                className="w-full text-xs"
              />
            </div>
          </details>
        </div>
      </div>

      {/* Content */}
      <div className="grid gap-6 p-4 lg:grid-cols-2">
        {/* Employees: Cost vs RPE */}
        <div className="rounded-xl border p-4">
          <h3 className="mb-2 text-sm font-semibold">
            Employee Cost vs Revenue / Employee
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={employeeBarData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(v) => money(v)} />
              <Legend />
              <Bar dataKey="TotalCost" name="Total Cost" fill={BRAND.primary} />
              <Bar dataKey="RPE" name="Revenue/Employee" fill={BRAND.secondary} />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-3 max-h-48 overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-600">
                  <th className="py-1 pr-4">Employee</th>
                  <th className="py-1 pr-4">Role</th>
                  <th className="py-1 pr-4">Cost</th>
                  <th className="py-1 pr-4">RPE</th>
                  <th className="py-1 pr-4">Margin</th>
                  <th className="py-1 pr-4">RPE/Cost</th>
                </tr>
              </thead>
              <tbody>
                {employeeMetrics.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="py-1 pr-4">{e.name}</td>
                    <td className="py-1 pr-4">{e.role}</td>
                    <td className="py-1 pr-4">{money(e.totalCost)}</td>
                    <td className="py-1 pr-4">{money(e.rpe)}</td>
                    <td className="py-1 pr-4">{money(e.margin)}</td>
                    <td className="py-1 pr-4">{e.ratio ? e.ratio.toFixed(2) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Trucks: Budget vs Actual */}
        <div className="rounded-xl border p-4">
          <h3 className="mb-2 text-sm font-semibold">
            Truck Budget vs Actual (per Delivery / Stop / Mile)
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={budgetVsActualData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Actual $/Delivery" fill={BRAND.primary} />
              <Bar dataKey="Budget $/Delivery" fill={BRAND.secondary} />
              <Bar dataKey="Actual $/Stop" fill="#64748B" />
              <Bar dataKey="Budget $/Stop" fill="#A3B18A" />
              <Bar dataKey="Actual $/Mile" fill="#334155" />
              <Bar dataKey="Budget $/Mile" fill="#94A3B8" />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-3 max-h-48 overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-600">
                  <th className="py-1 pr-4">Truck</th>
                  <th className="py-1 pr-4">Op Cost</th>
                  <th className="py-1 pr-4">$/Delivery</th>
                  <th className="py-1 pr-4">Budget</th>
                  <th className="py-1 pr-4">$/Stop</th>
                  <th className="py-1 pr-4">Budget</th>
                  <th className="py-1 pr-4">$/Mile</th>
                  <th className="py-1 pr-4">Budget</th>
                </tr>
              </thead>
              <tbody>
                {truckMetrics.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="py-1 pr-4">{t.id}</td>
                    <td className="py-1 pr-4">{money(t.totalOpCost)}</td>
                    <td className="py-1 pr-4">
                      {t.perDelivery != null ? money(t.perDelivery) : "—"}
                    </td>
                    <td className="py-1 pr-4">
                      {t.targetPerDelivery != null ? money(t.targetPerDelivery) : "—"}
                    </td>
                    <td className="py-1 pr-4">
                      {t.perStop != null ? money(t.perStop) : "—"}
                    </td>
                    <td className="py-1 pr-4">
                      {t.targetPerStop != null ? money(t.targetPerStop) : "—"}
                    </td>
                    <td className="py-1 pr-4">
                      {t.perMile != null ? money(t.perMile) : "—"}
                    </td>
                    <td className="py-1 pr-4">
                      {t.targetPerMile != null ? money(t.targetPerMile) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Trucks: Actual series (optional line view) */}
        <div className="rounded-xl border p-4 lg:col-span-2">
          <h3 className="mb-2 text-sm font-semibold">
            Actual Unit Costs (per truck)
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={truckMetrics.map((t) => ({
                name: t.id,
                PerDelivery: t.perDelivery ?? 0,
                PerStop: t.perStop ?? 0,
                PerMile: t.perMile ?? 0,
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="PerDelivery" stroke={BRAND.primary} dot={false} />
              <Line type="monotone" dataKey="PerStop" stroke="#64748B" dot={false} />
              <Line type="monotone" dataKey="PerMile" stroke={BRAND.secondary} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
