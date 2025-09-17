import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#B6BE82', '#21253F'];

// Simple, reusable Charts component that renders a line chart (trend), bar chart (categories)
// and pie chart (distribution). If no `data` prop is provided this component will render
// example data so it can be dropped into the dashboard immediately.
export default function Charts({ trendData, categoryData, pieData }) {
  const sampleTrend = trendData || [
    { name: 'Jan', value: 400 },
    { name: 'Feb', value: 420 },
    { name: 'Mar', value: 380 },
    { name: 'Apr', value: 500 },
    { name: 'May', value: 470 },
    { name: 'Jun', value: 520 }
  ];

  const sampleCategories = categoryData || [
    { name: 'Sales', value: 2400 },
    { name: 'Marketing', value: 1398 },
    { name: 'R&D', value: 980 },
    { name: 'Ops', value: 390 }
  ];

  const samplePie = pieData || [
    { name: 'North', value: 400 },
    { name: 'South', value: 300 },
    { name: 'East', value: 300 },
    { name: 'West', value: 200 }
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 18 }}>
      <div style={{ width: '100%', height: 240, background: 'rgba(255,255,255,0.06)', padding: 12, borderRadius: 8 }}>
        <h4 style={{ margin: '0 0 8px 0', color: 'var(--gibson-foreground, #fff)' }}>Trend</h4>
        <ResponsiveContainer>
          <LineChart data={sampleTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="name" stroke="rgba(255,255,255,0.7)" />
            <YAxis stroke="rgba(255,255,255,0.7)" />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="value" stroke="#B6BE82" strokeWidth={3} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div style={{ width: '100%', height: 220, background: 'rgba(255,255,255,0.04)', padding: 12, borderRadius: 8 }}>
          <h4 style={{ margin: '0 0 8px 0', color: 'var(--gibson-foreground, #fff)' }}>By Department</h4>
          <ResponsiveContainer>
            <BarChart data={sampleCategories} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" stroke="rgba(255,255,255,0.7)" />
              <YAxis stroke="rgba(255,255,255,0.7)" />
              <Tooltip />
              <Bar dataKey="value" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ width: '100%', height: 220, background: 'rgba(255,255,255,0.04)', padding: 12, borderRadius: 8 }}>
          <h4 style={{ margin: '0 0 8px 0', color: 'var(--gibson-foreground, #fff)' }}>Regional Share</h4>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={samplePie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} fill="#8884d8" label>
                {samplePie.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}