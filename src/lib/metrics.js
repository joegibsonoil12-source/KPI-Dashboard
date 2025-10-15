/**
 * Metrics utility functions for computing overall and per-truck KPIs
 * from delivery tickets data.
 */

/**
 * Compute aggregate metrics from an array of ticket rows.
 * 
 * @param {Array} rows - Array of delivery ticket objects
 * @returns {Object} - Metrics object with tickets, totalGallons, amount, avgMiles, onTimePct, etc.
 */
export function computeMetrics(rows) {
  const tickets = rows.length;
  
  // Use gallons_delivered if present, else qty
  const totalGallons = rows.reduce((sum, t) => {
    const gallons = Number(t.gallons_delivered || t.qty) || 0;
    return sum + gallons;
  }, 0);
  
  const amount = rows.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  
  // Average miles per ticket (only count tickets with miles_driven)
  const ticketsWithMiles = rows.filter(t => t.miles_driven != null && t.miles_driven > 0);
  const totalMiles = ticketsWithMiles.reduce((sum, t) => sum + (Number(t.miles_driven) || 0), 0);
  const avgMiles = ticketsWithMiles.length > 0 ? totalMiles / ticketsWithMiles.length : 0;
  
  // On-time percentage (only count tickets with on_time_flag set)
  const ticketsWithFlag = rows.filter(t => t.on_time_flag === 0 || t.on_time_flag === 1);
  const onTimeTickets = ticketsWithFlag.filter(t => t.on_time_flag === 1).length;
  const onTimePct = ticketsWithFlag.length > 0 ? (onTimeTickets / ticketsWithFlag.length) * 100 : 0;
  
  // Additional metrics
  const avgPricePerGallon = totalGallons > 0 ? amount / totalGallons : 0;
  const revenuePerGallon = avgPricePerGallon; // Same as avgPricePerGallon
  const gallonsPerTicket = tickets > 0 ? totalGallons / tickets : 0;
  const milesPerTicket = avgMiles; // Already computed as average
  
  return {
    tickets,
    totalGallons,
    amount,
    avgMiles,
    onTimePct,
    avgPricePerGallon,
    revenuePerGallon,
    gallonsPerTicket,
    milesPerTicket,
  };
}

/**
 * Compute per-truck metrics, grouping rows by truck identifier.
 * Uses coalesced truck key: truck || truck_id || "Unassigned"
 * 
 * @param {Array} rows - Array of delivery ticket objects
 * @returns {Object} - Map of truck key to metrics object
 */
export function computePerTruck(rows) {
  // Group tickets by truck
  const grouped = {};
  
  rows.forEach(ticket => {
    const truckKey = ticket.truck || ticket.truck_id || "Unassigned";
    if (!grouped[truckKey]) {
      grouped[truckKey] = [];
    }
    grouped[truckKey].push(ticket);
  });
  
  // Compute metrics for each truck group
  const perTruckMetrics = {};
  Object.keys(grouped).forEach(truckKey => {
    perTruckMetrics[truckKey] = computeMetrics(grouped[truckKey]);
  });
  
  return perTruckMetrics;
}

/**
 * Get unique truck list from tickets, using coalesced truck key.
 * 
 * @param {Array} rows - Array of delivery ticket objects
 * @returns {Array} - Sorted array of unique truck identifiers
 */
export function getUniqueTrucks(rows) {
  const trucks = new Set();
  rows.forEach(ticket => {
    const truckKey = ticket.truck || ticket.truck_id || "Unassigned";
    trucks.add(truckKey);
  });
  return Array.from(trucks).sort();
}
