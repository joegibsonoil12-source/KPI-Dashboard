import React from "react";

/**
 * WeeklyTicker - Displays weekly metrics (tickets, gallons, revenue) with deltas and percentage change
 * Designed for full-screen TV display
 */
export default function WeeklyTicker({ 
  title = "Deliveries", 
  thisWeek = { tickets: 0, gallons: 0, revenue: 0 },
  lastWeek = { tickets: 0, gallons: 0, revenue: 0 }
}) {
  // Calculate deltas and percentages
  const ticketsDelta = thisWeek.tickets - lastWeek.tickets;
  const gallonsDelta = thisWeek.gallons - lastWeek.gallons;
  const revenueDelta = thisWeek.revenue - lastWeek.revenue;
  
  const ticketsPercent = lastWeek.tickets > 0 
    ? ((ticketsDelta / lastWeek.tickets) * 100).toFixed(1)
    : "0.0";
  const gallonsPercent = lastWeek.gallons > 0
    ? ((gallonsDelta / lastWeek.gallons) * 100).toFixed(1)
    : "0.0";
  const revenuePercent = lastWeek.revenue > 0
    ? ((revenueDelta / lastWeek.revenue) * 100).toFixed(1)
    : "0.0";
  
  // Calculate remaining to beat last week
  const ticketsRemaining = Math.max(0, lastWeek.tickets - thisWeek.tickets);
  const gallonsRemaining = Math.max(0, lastWeek.gallons - thisWeek.gallons);
  const revenueRemaining = Math.max(0, lastWeek.revenue - thisWeek.revenue);
  
  // Format helpers
  const formatNumber = (num) => Math.round(num).toLocaleString();
  const formatCurrency = (num) => "$" + Math.round(num).toLocaleString();
  const formatDelta = (delta, isPercent = false) => {
    const prefix = delta >= 0 ? "+" : "";
    return isPercent ? `${prefix}${delta}%` : `${prefix}${formatNumber(delta)}`;
  };
  
  // Color helper based on delta
  const getDeltaColor = (delta) => {
    if (delta > 0) return "#10b981"; // green
    if (delta < 0) return "#ef4444"; // red
    return "#6b7280"; // gray
  };
  
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
      {/* Title */}
      <h2 className="text-4xl font-bold text-gray-900 mb-8 border-b-4 border-gray-900 pb-4">
        {title}
      </h2>
      
      {/* Metrics Grid */}
      <div className="space-y-6">
        {/* Tickets */}
        <div className="border-b border-gray-200 pb-6">
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-2xl font-semibold text-gray-700">Tickets</h3>
            <div className="text-right">
              <span 
                className="text-3xl font-bold"
                style={{ color: getDeltaColor(ticketsDelta) }}
              >
                {formatDelta(ticketsDelta)}
              </span>
              <span className="text-xl text-gray-500 ml-2">
                ({formatDelta(ticketsPercent, true)})
              </span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-5xl font-bold text-gray-900">{formatNumber(thisWeek.tickets)}</p>
              <p className="text-lg text-gray-500 mt-1">This Week</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-semibold text-gray-600">{formatNumber(lastWeek.tickets)}</p>
              <p className="text-sm text-gray-500 mt-1">Last Week</p>
            </div>
          </div>
          {ticketsRemaining > 0 && (
            <p className="text-lg text-gray-600 mt-3">
              Need <span className="font-bold text-orange-600">{formatNumber(ticketsRemaining)}</span> more to beat last week
            </p>
          )}
        </div>
        
        {/* Gallons */}
        <div className="border-b border-gray-200 pb-6">
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-2xl font-semibold text-gray-700">Gallons</h3>
            <div className="text-right">
              <span 
                className="text-3xl font-bold"
                style={{ color: getDeltaColor(gallonsDelta) }}
              >
                {formatDelta(gallonsDelta)}
              </span>
              <span className="text-xl text-gray-500 ml-2">
                ({formatDelta(gallonsPercent, true)})
              </span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-5xl font-bold text-gray-900">{formatNumber(thisWeek.gallons)}</p>
              <p className="text-lg text-gray-500 mt-1">This Week</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-semibold text-gray-600">{formatNumber(lastWeek.gallons)}</p>
              <p className="text-sm text-gray-500 mt-1">Last Week</p>
            </div>
          </div>
          {gallonsRemaining > 0 && (
            <p className="text-lg text-gray-600 mt-3">
              Need <span className="font-bold text-orange-600">{formatNumber(gallonsRemaining)}</span> more to beat last week
            </p>
          )}
        </div>
        
        {/* Revenue */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-2xl font-semibold text-gray-700">Revenue</h3>
            <div className="text-right">
              <span 
                className="text-3xl font-bold"
                style={{ color: getDeltaColor(revenueDelta) }}
              >
                {formatDelta(revenueDelta)}
              </span>
              <span className="text-xl text-gray-500 ml-2">
                ({formatDelta(revenuePercent, true)})
              </span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-5xl font-bold text-gray-900">{formatCurrency(thisWeek.revenue)}</p>
              <p className="text-lg text-gray-500 mt-1">This Week</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-semibold text-gray-600">{formatCurrency(lastWeek.revenue)}</p>
              <p className="text-sm text-gray-500 mt-1">Last Week</p>
            </div>
          </div>
          {revenueRemaining > 0 && (
            <p className="text-lg text-gray-600 mt-3">
              Need <span className="font-bold text-orange-600">{formatCurrency(revenueRemaining)}</span> more to beat last week
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
