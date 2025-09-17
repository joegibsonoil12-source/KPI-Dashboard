// src/App.jsx
// ============================================================================
// Gibson Oil & Gas — KPI Dashboard Starter Template
// A complete React dashboard template without authentication dependencies
// ============================================================================

import React, { useState, createContext, useContext } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// Mock data for the dashboard
const DUMMY_KPI_DATA = {
  propaneGallonsSold: 15420,
  unleadedSalesCStores: 125600,
  offRoadDieselGallons: 8750,
  newTanksSet: 12,
  serviceRevenue: 42300,
  monthlyRevenue: 189500,
  totalCustomers: 324,
  activeContracts: 156,
  maintenanceRequests: 23
};

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

// Create context for sharing data across components
const DashboardContext = createContext();

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};

// Main App Component
export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [kpiData, setKpiData] = useState(DUMMY_KPI_DATA);

  return (
    <DashboardContext.Provider value={{ kpiData, setKpiData }}>
      <div className="min-h-screen bg-slate-50">
        <TopNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="container mx-auto px-4 py-6">
          {activeTab === "dashboard" && <Dashboard />}
          {activeTab === "kpis" && <KPIsPage />}
          {activeTab === "budget" && <BudgetPage />}
          {activeTab === "procedures" && <ProceduresPage />}
        </main>
        <AIHelperWidget />
      </div>
    </DashboardContext.Provider>
  );
}

// Top Navigation Component
function TopNavigation({ activeTab, setActiveTab }) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "kpis", label: "KPIs", icon: "📈" },
    { id: "budget", label: "Budget", icon: "💰" },
    { id: "procedures", label: "Procedures", icon: "📋" }
  ];

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold">
              G
            </div>
            <span className="text-xl font-semibold text-gray-900">
              Gibson Oil & Gas
            </span>
          </div>

          {/* Navigation Links */}
          <div className="flex space-x-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === item.id
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          {/* User Actions */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Demo Mode</span>
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
              👤
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

// Dashboard Page
function Dashboard() {
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

// KPIs Page
function KPIsPage() {
  const { kpiData, setKpiData } = useDashboard();

  const updateKPI = (key, value) => {
    setKpiData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Key Performance Indicators</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <EditableKPICard
          title="Propane Gallons Sold"
          value={kpiData.propaneGallonsSold}
          unit="gal"
          onChange={(value) => updateKPI('propaneGallonsSold', value)}
        />
        <EditableKPICard
          title="Unleaded Sales to C-Stores"
          value={kpiData.unleadedSalesCStores}
          unit="$"
          onChange={(value) => updateKPI('unleadedSalesCStores', value)}
        />
        <EditableKPICard
          title="Off-Road Diesel Gallons"
          value={kpiData.offRoadDieselGallons}
          unit="gal"
          onChange={(value) => updateKPI('offRoadDieselGallons', value)}
        />
        <EditableKPICard
          title="New Tanks Set"
          value={kpiData.newTanksSet}
          unit=""
          onChange={(value) => updateKPI('newTanksSet', value)}
        />
        <EditableKPICard
          title="Service Revenue"
          value={kpiData.serviceRevenue}
          unit="$"
          onChange={(value) => updateKPI('serviceRevenue', value)}
        />
        <EditableKPICard
          title="Total Customers"
          value={kpiData.totalCustomers}
          unit=""
          onChange={(value) => updateKPI('totalCustomers', value)}
        />
      </div>
    </div>
  );
}

// Budget Page
function BudgetPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Budget Management</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Budget vs Actual Spending">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={DUMMY_BUDGET_DATA}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, ""]} />
              <Bar dataKey="budgeted" fill="#94a3b8" name="Budgeted" />
              <Bar dataKey="actual" fill="#3b82f6" name="Actual" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Budget Summary">
          <div className="space-y-4">
            {DUMMY_BUDGET_DATA.map((item, index) => {
              const percentage = (item.actual / item.budgeted) * 100;
              const isOverBudget = percentage > 100;
              
              return (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{item.category}</span>
                    <span className={`text-sm ${isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${isOverBudget ? 'bg-red-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>${item.actual.toLocaleString()}</span>
                    <span>${item.budgeted.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

// Procedures Page
function ProceduresPage() {
  const [procedures, setProcedures] = useState([
    {
      id: 1,
      title: "Daily Safety Check",
      category: "Safety",
      description: "Complete daily safety inspection checklist",
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      completed: false,
      notes: ""
    },
    {
      id: 2,
      title: "Tank Maintenance",
      category: "Maintenance",
      description: "Monthly tank inspection and maintenance procedure",
      videoUrl: "",
      completed: true,
      notes: "Completed last week"
    }
  ]);

  const [newProcedure, setNewProcedure] = useState({
    title: "",
    category: "General",
    description: "",
    videoUrl: ""
  });

  const categories = ["Safety", "Maintenance", "Operations", "Training", "General"];

  const addProcedure = () => {
    if (newProcedure.title.trim()) {
      setProcedures(prev => [...prev, {
        id: Date.now(),
        ...newProcedure,
        completed: false,
        notes: ""
      }]);
      setNewProcedure({ title: "", category: "General", description: "", videoUrl: "" });
    }
  };

  const toggleProcedure = (id) => {
    setProcedures(prev => prev.map(p => 
      p.id === id ? { ...p, completed: !p.completed } : p
    ));
  };

  const updateNotes = (id, notes) => {
    setProcedures(prev => prev.map(p => 
      p.id === id ? { ...p, notes } : p
    ));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Procedures Management</h2>
      
      {/* Add New Procedure */}
      <Card title="Add New Procedure">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Procedure title"
            value={newProcedure.title}
            onChange={(e) => setNewProcedure(prev => ({ ...prev, title: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <select
            value={newProcedure.category}
            onChange={(e) => setNewProcedure(prev => ({ ...prev, category: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Description"
            value={newProcedure.description}
            onChange={(e) => setNewProcedure(prev => ({ ...prev, description: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input
            type="url"
            placeholder="Video URL (optional)"
            value={newProcedure.videoUrl}
            onChange={(e) => setNewProcedure(prev => ({ ...prev, videoUrl: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={addProcedure}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Procedure
        </button>
      </Card>

      {/* Procedures List */}
      <div className="grid grid-cols-1 gap-4">
        {procedures.map(procedure => (
          <Card key={procedure.id} title="">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="font-semibold text-lg">{procedure.title}</h3>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      {procedure.category}
                    </span>
                  </div>
                  <p className="text-gray-600 mt-1">{procedure.description}</p>
                </div>
                <button
                  onClick={() => toggleProcedure(procedure.id)}
                  className={`px-3 py-1 rounded-lg text-sm ${
                    procedure.completed
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {procedure.completed ? "✓ Done" : "Mark Done"}
                </button>
              </div>

              {procedure.videoUrl && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Training Video:</p>
                  <a
                    href={procedure.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    {procedure.videoUrl}
                  </a>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes:
                </label>
                <textarea
                  value={procedure.notes}
                  onChange={(e) => updateNotes(procedure.id, e.target.value)}
                  placeholder="Add notes about this procedure..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Reusable Components
function Card({ title, children, className = "" }) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border p-6 ${className}`}>
      {title && <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>}
      {children}
    </div>
  );
}

function KPICard({ title, value, change, positive }) {
  return (
    <Card className="text-center">
      <h4 className="text-sm font-medium text-gray-600 mb-2">{title}</h4>
      <p className="text-2xl font-bold text-gray-900 mb-2">{value}</p>
      <p className={`text-sm ${positive ? 'text-green-600' : 'text-red-600'}`}>
        {change}
      </p>
    </Card>
  );
}

function EditableKPICard({ title, value, unit, onChange }) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  const handleSave = () => {
    onChange(tempValue);
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
        <div className="space-y-2">
          <input
            type="number"
            value={tempValue}
            onChange={(e) => setTempValue(Number(e.target.value))}
            className="w-full px-2 py-1 text-center border rounded"
          />
          <div className="space-x-2">
            <button
              onClick={handleSave}
              className="px-2 py-1 bg-green-500 text-white text-xs rounded"
            >
              Save
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="px-2 py-1 bg-gray-500 text-white text-xs rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-2xl font-bold text-gray-900 mb-2">{formatValue(value)}</p>
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Edit
          </button>
        </div>
      )}
    </Card>
  );
}

// AI Helper Widget
function AIHelperWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: "Hi! I'm your AI assistant. How can I help you today?", sender: "ai" }
  ]);
  const [inputText, setInputText] = useState("");

  const sendMessage = () => {
    if (inputText.trim()) {
      const newMessage = { id: Date.now(), text: inputText, sender: "user" };
      setMessages(prev => [...prev, newMessage]);
      
      // Simulate AI response
      setTimeout(() => {
        const aiResponse = {
          id: Date.now() + 1,
          text: "I'm a placeholder AI assistant. In a real implementation, I would be connected to OpenAI, Copilot, or another AI service.",
          sender: "ai"
        };
        setMessages(prev => [...prev, aiResponse]);
      }, 1000);
      
      setInputText("");
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen && (
        <div className="bg-white rounded-lg shadow-lg border w-80 h-96 mb-4 flex flex-col">
          <div className="bg-blue-600 text-white p-3 rounded-t-lg">
            <h4 className="font-semibold">AI Helper</h4>
          </div>
          <div className="flex-1 p-3 overflow-y-auto space-y-2">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`p-2 rounded-lg max-w-xs ${
                  msg.sender === "ai"
                    ? "bg-gray-100 text-gray-800"
                    : "bg-blue-500 text-white ml-auto"
                }`}
              >
                {msg.text}
              </div>
            ))}
          </div>
          <div className="p-3 border-t">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Ask me anything..."
                className="flex-1 px-2 py-1 border rounded-lg text-sm"
              />
              <button
                onClick={sendMessage}
                className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
      >
        {isOpen ? "✕" : "💬"}
      </button>
    </div>
  );
}