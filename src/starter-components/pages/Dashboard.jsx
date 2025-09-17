// src/starter-components/pages/Dashboard.jsx
import React from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, KPICard } from "../ui/Card";

const DUMMY_CHART_DATA = [
  { month: "Jan", revenue: 165000, expenses: 120000 },
  { month: "Feb", revenue: 178000, expenses: 125000 },
  { month: "Mar", revenue: 192000, expenses: 135000 },
  { month: "Apr", revenue: 185000, expenses: 140000 },
  { month: "May", revenue: 203000, expenses: 145000 },
  { month: "Jun", revenue: 215000, expenses: 150000 }
];

const DUMMY_BUDGET_DATA = [
  { category: "Operations", budgeted: 500000, actual: 445000 },
  { category: "Marketing", budgeted: 150000, actual: 132000 },
  { category: "Equipment", budgeted: 300000, actual: 285000 },
  { category: "Personnel", budgeted: 400000, actual: 395000 }
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Main KPI Cards */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Operational & Financial Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard 
            title="Monthly Revenue" 
            value="$189,500" 
            change="+12.5%" 
            positive={true}
          />
          <KPICard 
            title="Active Customers" 
            value="324" 
            change="+8.2%" 
            positive={true}
          />
          <KPICard 
            title="Propane Sales" 
            value="15,420 gal" 
            change="+5.1%" 
            positive={true}
          />
          <KPICard 
            title="Service Revenue" 
            value="$42,300" 
            change="-2.3%" 
            positive={false}
          />
        </div>
      </section>

      {/* Charts Section */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Revenue vs Expenses">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={DUMMY_CHART_DATA}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, ""]} />
              <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} />
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Budget Performance">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={DUMMY_BUDGET_DATA}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, ""]} />
              <Bar dataKey="budgeted" fill="#94a3b8" />
              <Bar dataKey="actual" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </section>

      {/* Recent Activity */}
      <Card title="Recent Activity">
        <div className="space-y-3">
          {[
            "New service contract signed with ABC Corp",
            "Propane delivery completed for Route 12",
            "Maintenance scheduled for Tank #A127",
            "Budget review meeting scheduled for next week"
          ].map((activity, index) => (
            <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
              <span className="text-gray-700">{activity}</span>
              <span className="ml-auto text-sm text-gray-500">
                {index + 1}h ago
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}