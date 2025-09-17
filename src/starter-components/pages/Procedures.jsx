// src/starter-components/pages/Procedures.jsx
import React, { useState } from "react";
import { Card } from "../ui/Card";

export default function Procedures() {
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

  const deleteProcedure = (id) => {
    setProcedures(prev => prev.filter(p => p.id !== id));
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
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent md:col-span-2"
          />
          <input
            type="url"
            placeholder="Video URL (YouTube, Vimeo, Loom, etc.)"
            value={newProcedure.videoUrl}
            onChange={(e) => setNewProcedure(prev => ({ ...prev, videoUrl: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent md:col-span-2"
          />
        </div>
        <button
          onClick={addProcedure}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Procedure
        </button>
      </Card>

      {/* Categories Filter */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm font-medium text-gray-700">Filter by category:</span>
        {categories.map(category => {
          const count = procedures.filter(p => p.category === category).length;
          return (
            <span
              key={category}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
            >
              {category} ({count})
            </span>
          );
        })}
      </div>

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
                <div className="flex space-x-2">
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
                  <button
                    onClick={() => deleteProcedure(procedure.id)}
                    className="px-3 py-1 bg-red-100 text-red-800 rounded-lg text-sm hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {procedure.videoUrl && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">📹 Training Video:</p>
                  <a
                    href={procedure.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline break-all"
                  >
                    {procedure.videoUrl}
                  </a>
                  <div className="mt-2 text-xs text-gray-500">
                    💡 Tip: For file uploads, you can integrate with cloud storage services like AWS S3, Google Drive, or implement a custom upload solution.
                  </div>
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

      {procedures.length === 0 && (
        <Card title="No Procedures Yet">
          <p className="text-gray-600 text-center py-8">
            Get started by adding your first procedure above. You can organize them into categories and add training videos or documentation links.
          </p>
        </Card>
      )}
    </div>
  );
}