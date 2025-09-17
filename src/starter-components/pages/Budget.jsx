// src/starter-components/pages/Budget.jsx
import React, { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Card } from "../ui/Card";

const INITIAL_BUDGET_DATA = [
  { category: "Operations", budgeted: 500000, actual: 445000, variance: -55000 },
  { category: "Marketing", budgeted: 150000, actual: 132000, variance: -18000 },
  { category: "Equipment", budgeted: 300000, actual: 285000, variance: -15000 },
  { category: "Personnel", budgeted: 400000, actual: 395000, variance: -5000 },
  { category: "Maintenance", budgeted: 200000, actual: 225000, variance: 25000 },
  { category: "Insurance", budgeted: 80000, actual: 78000, variance: -2000 }
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function BudgetPage() {
  const [budgetData, setBudgetData] = useState(INITIAL_BUDGET_DATA);
  const [newBudgetItem, setNewBudgetItem] = useState({
    category: "",
    budgeted: 0,
    actual: 0
  });

  const addBudgetItem = () => {
    if (newBudgetItem.category.trim()) {
      const variance = newBudgetItem.actual - newBudgetItem.budgeted;
      setBudgetData(prev => [...prev, {
        ...newBudgetItem,
        variance,
        id: Date.now()
      }]);
      setNewBudgetItem({ category: "", budgeted: 0, actual: 0 });
    }
  };

  const updateBudgetItem = (index, field, value) => {
    setBudgetData(prev => prev.map((item, i) => {
      if (i === index) {
        const updated = { ...item, [field]: Number(value) };
        updated.variance = updated.actual - updated.budgeted;
        return updated;
      }
      return item;
    }));
  };

  const totalBudgeted = budgetData.reduce((sum, item) => sum + item.budgeted, 0);
  const totalActual = budgetData.reduce((sum, item) => sum + item.actual, 0);
  const totalVariance = totalActual - totalBudgeted;

  const pieData = budgetData.map(item => ({
    name: item.category,
    value: item.actual,
    percentage: ((item.actual / totalActual) * 100).toFixed(1)
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Budget Management</h2>
      
      {/* Budget Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="text-center">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Total Budgeted</h4>
          <p className="text-2xl font-bold text-blue-600">${totalBudgeted.toLocaleString()}</p>
        </Card>
        <Card className="text-center">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Total Actual</h4>
          <p className="text-2xl font-bold text-gray-900">${totalActual.toLocaleString()}</p>
        </Card>
        <Card className="text-center">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Total Variance</h4>
          <p className={`text-2xl font-bold ${totalVariance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
            {totalVariance >= 0 ? '+' : ''}${totalVariance.toLocaleString()}
          </p>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Budget vs Actual Spending">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={budgetData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, ""]} />
              <Bar dataKey="budgeted" fill="#94a3b8" name="Budgeted" />
              <Bar dataKey="actual" fill="#3b82f6" name="Actual" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Spending Distribution">
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name} (${percentage}%)`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, "Amount"]} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Budget Details Table */}
      <Card title="Budget Details">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-900">Category</th>
                <th className="px-4 py-3 text-right font-medium text-gray-900">Budgeted</th>
                <th className="px-4 py-3 text-right font-medium text-gray-900">Actual</th>
                <th className="px-4 py-3 text-right font-medium text-gray-900">Variance</th>
                <th className="px-4 py-3 text-right font-medium text-gray-900">% of Budget</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {budgetData.map((item, index) => {
                const percentage = (item.actual / item.budgeted) * 100;
                const isOverBudget = percentage > 100;
                
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{item.category}</td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        value={item.budgeted}
                        onChange={(e) => updateBudgetItem(index, 'budgeted', e.target.value)}
                        className="w-24 px-2 py-1 text-right border rounded text-sm"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        value={item.actual}
                        onChange={(e) => updateBudgetItem(index, 'actual', e.target.value)}
                        className="w-24 px-2 py-1 text-right border rounded text-sm"
                      />
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${
                      item.variance >= 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {item.variance >= 0 ? '+' : ''}${item.variance.toLocaleString()}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${
                      isOverBudget ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {percentage.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add New Budget Item */}
      <Card title="Add Budget Category">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Category name"
            value={newBudgetItem.category}
            onChange={(e) => setNewBudgetItem(prev => ({ ...prev, category: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input
            type="number"
            placeholder="Budgeted amount"
            value={newBudgetItem.budgeted || ''}
            onChange={(e) => setNewBudgetItem(prev => ({ ...prev, budgeted: Number(e.target.value) }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input
            type="number"
            placeholder="Actual amount"
            value={newBudgetItem.actual || ''}
            onChange={(e) => setNewBudgetItem(prev => ({ ...prev, actual: Number(e.target.value) }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={addBudgetItem}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Category
          </button>
        </div>
      </Card>

      {/* Budget Actions */}
      <Card title="Budget Management Actions">
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            Export Budget Report
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Import from CSV
          </button>
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            Budget Forecast
          </button>
          <button className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">
            Set Alerts
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          💰 In a production environment, these would connect to financial systems and generate real reports.
        </p>
      </Card>
    </div>
  );
}