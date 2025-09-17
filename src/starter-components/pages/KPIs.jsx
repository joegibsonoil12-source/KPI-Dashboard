// src/starter-components/pages/KPIs.jsx
import React, { useState } from "react";
import { useDashboard } from "../context/DashboardContext";
import { Card } from "../ui/Card";

function EditableKPICard({ title, value, unit, onChange }) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  const handleSave = () => {
    onChange(tempValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempValue(value);
    setIsEditing(false);
  };

  const formatValue = (val) => {
    if (unit === "$") return `$${val.toLocaleString()}`;
    if (unit === "gal") return `${val.toLocaleString()} gal`;
    return val.toLocaleString();
  };

  return (
    <Card className="text-center">
      <h4 className="text-sm font-medium text-gray-600 mb-2">{title}</h4>
      {isEditing ? (
        <div className="space-y-3">
          <input
            type="number"
            value={tempValue}
            onChange={(e) => setTempValue(Number(e.target.value))}
            className="w-full px-3 py-2 text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="space-x-2">
            <button
              onClick={handleSave}
              className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-3xl font-bold text-gray-900 mb-3">{formatValue(value)}</p>
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Edit Value
          </button>
        </div>
      )}
    </Card>
  );
}

export default function KPIsPage() {
  const { kpiData, setKpiData } = useDashboard();

  const updateKPI = (key, value) => {
    setKpiData(prev => ({ ...prev, [key]: value }));
  };

  const kpiMetrics = [
    { key: 'propaneGallonsSold', title: 'Propane Gallons Sold', unit: 'gal' },
    { key: 'unleadedSalesCStores', title: 'Unleaded Sales to C-Stores', unit: '$' },
    { key: 'offRoadDieselGallons', title: 'Off-Road Diesel Gallons', unit: 'gal' },
    { key: 'newTanksSet', title: 'New Tanks Set', unit: '' },
    { key: 'serviceRevenue', title: 'Service Revenue', unit: '$' },
    { key: 'totalCustomers', title: 'Total Customers', unit: '' },
    { key: 'activeContracts', title: 'Active Contracts', unit: '' },
    { key: 'maintenanceRequests', title: 'Maintenance Requests', unit: '' },
    { key: 'monthlyRevenue', title: 'Monthly Revenue', unit: '$' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Key Performance Indicators</h2>
        <div className="text-sm text-gray-500">
          💡 Click "Edit Value" on any KPI to modify the data
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {kpiMetrics.map(metric => (
          <EditableKPICard
            key={metric.key}
            title={metric.title}
            value={kpiData[metric.key]}
            unit={metric.unit}
            onChange={(value) => updateKPI(metric.key, value)}
          />
        ))}
      </div>

      {/* KPI Insights */}
      <Card title="KPI Insights & Analytics">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">Performance Summary</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Revenue</span>
                <span className="font-semibold">${(kpiData.serviceRevenue + kpiData.unleadedSalesCStores).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Fuel Sales</span>
                <span className="font-semibold">{(kpiData.propaneGallonsSold + kpiData.offRoadDieselGallons).toLocaleString()} gal</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Equipment Performance</span>
                <span className="font-semibold">{kpiData.newTanksSet} new installations</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">Key Ratios</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Revenue per Customer</span>
                <span className="font-semibold">${Math.round((kpiData.serviceRevenue + kpiData.unleadedSalesCStores) / kpiData.totalCustomers).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Contracts per Customer</span>
                <span className="font-semibold">{(kpiData.activeContracts / kpiData.totalCustomers).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Maintenance Rate</span>
                <span className="font-semibold">{((kpiData.maintenanceRequests / kpiData.activeContracts) * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Data Export Options */}
      <Card title="Data Management">
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Export to CSV
          </button>
          <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            Generate Report
          </button>
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            Reset to Defaults
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          📊 In a production app, these buttons would connect to real data export and reporting functionality.
        </p>
      </Card>
    </div>
  );
}