import React, { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// ===== Brand (match your current site) =====
const BRAND = {
  primary: "#21253F",   // navy
  secondary: "#B6BE82", // green
  neutral: "#111827",
  surface: "#FFFFFF",
  border: "#E5E7EB",
};

// ===== Helpers =====
const fmtMoney0 = (n) =>
  n == null || Number.isNaN(n)
    ? "—"
    : n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const fmtMoney2 = (n) =>
  n == null || Number.isNaN(n)
    ? "—"
    : n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });

const pct = (n) =>
  n == null || Number.isNaN(n) ? "—" : `${(n * 100).toFixed(1)}%`;

// ===== Sample data (used if you don't pass props yet) =====
const SAMPLE_EMPLOYEES = [
  { name: "Driver A", role: "Fuel Driver", annualSalary: 64000, benefitsPct: 0.18, overheadPct: 0.12, allocatedRevenue: 185000 },
  { name: "Driver B", role: "Propane Driver", annualSalary: 62000, benefitsPct: 0.18, overheadPct: 0.12, allocatedRevenue: 172000 },
  { name: "Tech 1", role: "Service Tech", annualSalary: 70000, benefitsPct: 0.2, overheadPct: 0.12, allocatedRevenue: 210000 },
  { name: "CSR 1", role: "Office/CSR", annualSalary: 48000, benefitsPct: 0.2, overheadPct: 0.15, allocatedRevenue: 95000 },
];

const SAMPLE_TRUCKS = [
  // insurancePerMonth is fixed monthly; others are variable-per-mile or hour
  { id: "LP10", fuelCostPerMile: 0.45, maintCostPerMile: 0.18, insurancePerMonth: 420, driverHourly: 26, avgHoursPerDay: 8.5, milesPerDay: 120, stopsPerDay: 18, deliveriesPerDay: 16 },
  { id: "LP6",  fuelCostPerMile: 0.48, maintCostPerMile: 0.20, insurancePerMonth: 430, driverHourly: 27, avgHoursPerDay: 8.0, milesPerDay: 110, stopsPerDay: 15, deliveriesPerDay: 14 },
  { id: "S4",   fuelCostPerMile: 0.42, maintCostPerMile: 0.16, insurancePerMonth: 380, driverHourly: 24, avgHoursPerDay: 7.5, milesPerDay: 95,  stopsPerDay: 12, deliveriesPerDay: 11 },
];

// ===== Component =====
export default function OperationalKPIs({
  employees = SAMPLE_EMPLOYEES,
  trucks = SAMPLE_TRUCKS,
  daysPerMonth = 22, // used to spread insurance & labor into per-day math
}) {
  // Allow quick local tweaking without breaking props
  const [emp, setEmp] = useState(employees);
  const [fleet, setFleet] = useState(trucks);

  // ---- Derived: Employees
  const employeeRows = useMemo(() => {
    return emp.map((e) => {
      const loadedAnnual =
        e.annualSalary * (1 + (e.benefitsPct || 0) + (e.overheadPct || 0));
      const margin = (e.allocatedRevenue ?? 0) - loadedAnnual;
      const marginPct = loadedAnnual > 0 ? margin / loadedAnnual : null;
      const rpe = e.allocatedRevenue ?? 0;
      return {
        ...e,
        loadedAnnual,
        margin,
        marginPct,
        revenue: rpe,
      };
    });
  }, [emp]);

  const empSummary = useMemo(() => {
    const totalRevenue = employeeRows.reduce((s, r) => s + (r.revenue || 0), 0);
    const totalCost = employeeRows.reduce((s, r) => s + (r.loadedAnnual || 0), 0);
    const totalMargin = totalRevenue - totalCost;
    const marginPct = totalCost > 0 ? totalMargin / totalCost : null;
    const headcount = employeeRows.length;
    const avgRPE = headcount > 0 ? totalRevenue / headcount : null;
    const avgCostPE = headcount > 0 ? totalCost / headcount : null;
    return { totalRevenue, totalCost, totalMargin, marginPct, headcount, avgRPE, avgCostPE };
  }, [employeeRows]);

  const empChart = useMemo(() => {
    return employeeRows.map((r) => ({
      name: r.name,
      Revenue: Math.max(0, r.revenue || 0),
      Cost: Math.max(0, r.loadedAnnual || 0),
    }));
  }, [employeeRows]);

  // ---- Derived: Trucks
  const truckRows = useMemo(() => {
    return fleet.map((t) => {
      const variablePerMile = (t.fuelCostPerMile || 0) + (t.maintCostPerMile || 0);
      const laborPerDay = (t.driverHourly || 0) * (t.avgHoursPerDay || 0);
      const insurancePerDay = (t.insurancePerMonth || 0) / daysPerMonth;

      const milesPerDay = t.milesPerDay || 0;
      const stopsPerDay = t.stopsPerDay || 0;
      const deliveriesPerDay = t.deliveriesPerDay || 0;

      const variablePerDay = variablePerMile * milesPerDay;
      const totalCostPerDay = variablePerDay + laborPerDay + insurancePerDay;

      const costPerMile = milesPerDay > 0 ? totalCostPerDay / milesPerDay : null;
      const costPerStop = stopsPerDay > 0 ? totalCostPerDay / stopsPerDay : null;
      const costPerDelivery = deliveriesPerDay > 0 ? totalCostPerDay / deliveriesPerDay : null;

      return {
        ...t,
        variablePerMile,
        laborPerDay,
        insurancePerDay,
        variablePerDay,
        totalCostPerDay,
        costPerMile,
        costPerStop,
        costPerDelivery,
      };
    });
  }, [fleet, daysPerMonth]);

  const fleetSummary = useMemo(() => {
    const daily = truckRows.reduce((s, r) => s + (r.totalCostPerDay || 0), 0);
    const perStop = average(truckRows.map((r) => r.costPerStop));
    const perDel = average(truckRows.map((r) => r.costPerDelivery));
    const perMile = average(truckRows.map((r) => r.costPerMile));
    return { daily, perStop, perDel, perMile, count: truckRows.length };
  }, [truckRows]);

  const truckChart = useMemo(() => {
    return truckRows.map((r) => ({
      id: r.id,
      "Per Delivery": safeNum(r.costPerDelivery),
      "Per Stop": safeNum(r.costPerStop),
      "Per Mile": safeNum(r.costPerMile),
    }));
  }, [truckRows]);

  // ===== UI =====
  return (
    <section className="mt-8">
      {/* Summary tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile title="Headcount" value={empSummary.headcount} />
        <Tile title="Avg Revenue / Employee" value={fmtMoney0(empSummary.avgRPE)} />
        <Tile title="Avg Cost / Employee" value={fmtMoney0(empSummary.avgCostPE)} />
        <Tile title="Employee Margin %" value={pct(empSummary.marginPct)} />
      </div>

      {/* Employee Cost vs Revenue */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Employee Cost vs Revenue">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: BRAND.border }}>
                  <th className="py-2 pr-3">Employee</th>
                  <th className="py-2 pr-3 hidden md:table-cell">Role</th>
                  <th className="py-2 pr-3">Loaded Cost (Annual)</th>
                  <th className="py-2 pr-3">Revenue</th>
                  <th className="py-2 pr-3">Margin</th>
                  <th className="py-2 pr-3">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {employeeRows.map((r) => (
                  <tr key={r.name} className="border-b last:border-none" style={{ borderColor: BRAND.border }}>
                    <td className="py-2 pr-3 font-medium">{r.name}</td>
                    <td className="py-2 pr-3 hidden md:table-cell text-slate-600">{r.role}</td>
                    <td className="py-2 pr-3">{fmtMoney0(r.loadedAnnual)}</td>
                    <td className="py-2 pr-3">{fmtMoney0(r.revenue)}</td>
                    <td className="py-2 pr-3">{fmtMoney0(r.margin)}</td>
                    <td className="py-2 pr-3">{pct(r.marginPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Employee Cost vs Revenue (Bar)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={empChart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(v) => fmtMoney0(v)} />
              <Legend />
              <Bar dataKey="Revenue" fill={BRAND.secondary} />
              <Bar dataKey="Cost" fill={BRAND.primary} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Truck Costs */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Truck Operating Cost (per Mile / Stop / Delivery)">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: BRAND.border }}>
                  <th className="py-2 pr-3">Truck</th>
                  <th className="py-2 pr-3">Miles / Day</th>
                  <th className="py-2 pr-3">Stops / Day</th>
                  <th className="py-2 pr-3">Deliveries / Day</th>
                  <th className="py-2 pr-3">Cost / Mile</th>
                  <th className="py-2 pr-3">Cost / Stop</th>
                  <th className="py-2 pr-3">Cost / Delivery</th>
                </tr>
              </thead>
              <tbody>
                {truckRows.map((r) => (
                  <tr key={r.id} className="border-b last:border-none" style={{ borderColor: BRAND.border }}>
                    <td className="py-2 pr-3 font-medium">{r.id}</td>
                    <td className="py-2 pr-3">{r.milesPerDay}</td>
                    <td className="py-2 pr-3">{r.stopsPerDay}</td>
                    <td className="py-2 pr-3">{r.deliveriesPerDay}</td>
                    <td className="py-2 pr-3">{fmtMoney2(r.costPerMile)}</td>
                    <td className="py-2 pr-3">{fmtMoney2(r.costPerStop)}</td>
                    <td className="py-2 pr-3">{fmtMoney2(r.costPerDelivery)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Includes driver labor, fuel+maintenance per mile, and insurance pro-rated by {daysPerMonth} working days/mo.
          </div>
        </Card>

        <Card title="Truck Cost (Bar)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={truckChart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="id" />
              <YAxis />
              <Tooltip formatter={(v) => fmtMoney2(v)} />
              <Legend />
              <Bar dataKey="Per Delivery" fill={BRAND.secondary} />
              <Bar dataKey="Per Stop" fill={BRAND.primary} />
              <Bar dataKey="Per Mile" fill="#9CA3AF" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <MiniStat label="Avg Cost / Delivery" value={fmtMoney2(fleetSummary.perDel)} />
            <MiniStat label="Avg Cost / Stop" value={fmtMoney2(fleetSummary.perStop)} />
            <MiniStat label="Avg Cost / Mile" value={fmtMoney2(fleetSummary.perMile)} />
          </div>
        </Card>
      </div>
    </section>
  );
}

// ===== UI subcomponents =====
function Card({ title, children }) {
  return (
    <div
      className="rounded-2xl border p-4 shadow-sm bg-white"
      style={{ borderColor: BRAND.border, backgroundColor: BRAND.surface }}
    >
      <h3 className="text-sm font-semibold text-slate-700 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Tile({ title, value }) {
  return (
    <div
      className="rounded-2xl border p-4 shadow-sm bg-white"
      style={{ borderColor: BRAND.border }}
    >
      <div className="text-xs text-slate-500">{title}</div>
      <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl border p-3 text-sm" style={{ borderColor: BRAND.border }}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

// ===== small utils =====
function average(arr) {
  const valid = arr.filter((n) => n != null && !Number.isNaN(n));
  if (!valid.length) return null;
  return valid.reduce((s, n) => s + n, 0) / valid.length;
}
function safeNum(n) {
  return n == null || Number.isNaN(n) ? 0 : n;
}
