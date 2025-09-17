// src/starter-components/ui/Card.jsx
import React from "react";

export function Card({ title, children, className = "" }) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border p-6 ${className}`}>
      {title && <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>}
      {children}
    </div>
  );
}

export function KPICard({ title, value, change, positive }) {
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

export default Card;