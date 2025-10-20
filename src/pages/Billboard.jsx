import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import WeeklyTicker from "../components/WeeklyTicker";

/**
 * Billboard - Full-screen TV-friendly display of weekly delivery and service metrics
 * Shows this week vs last week with auto-refresh
 */
export default function Billboard() {
  const [deliveryData, setDeliveryData] = useState({
    thisWeek: { tickets: 0, gallons: 0, revenue: 0 },
    lastWeek: { tickets: 0, gallons: 0, revenue: 0 }
  });
  
  const [serviceData, setServiceData] = useState({
    thisWeek: { tickets: 0, gallons: 0, revenue: 0 },
    lastWeek: { tickets: 0, gallons: 0, revenue: 0 }
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [serviceTableExists, setServiceTableExists] = useState(true);
  
  // Get start and end of current week (Sunday to Saturday)
  const getWeekBounds = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // Adjust to Sunday
    
    const weekStart = new Date(d.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    weekEnd.setHours(0, 0, 0, 0);
    
    return { weekStart, weekEnd };
  };
  
  // Fetch and aggregate delivery tickets
  const fetchDeliveryMetrics = async () => {
    try {
      const now = new Date();
      const { weekStart: thisWeekStart, weekEnd: thisWeekEnd } = getWeekBounds(now);
      
      // Last week bounds
      const lastWeekStart = new Date(thisWeekStart);
      lastWeekStart.setDate(thisWeekStart.getDate() - 7);
      const lastWeekEnd = new Date(thisWeekStart);
      
      // Fetch this week's tickets
      const { data: thisWeekTickets, error: thisWeekError } = await supabase
        .from("delivery_tickets")
        .select("*")
        .gte("delivery_date", thisWeekStart.toISOString())
        .lt("delivery_date", thisWeekEnd.toISOString());
      
      if (thisWeekError) throw thisWeekError;
      
      // Fetch last week's tickets
      const { data: lastWeekTickets, error: lastWeekError } = await supabase
        .from("delivery_tickets")
        .select("*")
        .gte("delivery_date", lastWeekStart.toISOString())
        .lt("delivery_date", lastWeekEnd.toISOString());
      
      if (lastWeekError) throw lastWeekError;
      
      // Aggregate this week
      const thisWeek = {
        tickets: thisWeekTickets?.length || 0,
        gallons: thisWeekTickets?.reduce((sum, t) => sum + (parseFloat(t.gallons) || 0), 0) || 0,
        revenue: thisWeekTickets?.reduce((sum, t) => sum + (parseFloat(t.total_amount) || 0), 0) || 0
      };
      
      // Aggregate last week
      const lastWeek = {
        tickets: lastWeekTickets?.length || 0,
        gallons: lastWeekTickets?.reduce((sum, t) => sum + (parseFloat(t.gallons) || 0), 0) || 0,
        revenue: lastWeekTickets?.reduce((sum, t) => sum + (parseFloat(t.total_amount) || 0), 0) || 0
      };
      
      setDeliveryData({ thisWeek, lastWeek });
    } catch (err) {
      console.error("Error fetching delivery metrics:", err);
      throw err;
    }
  };
  
  // Fetch and aggregate service tickets
  const fetchServiceMetrics = async () => {
    try {
      const now = new Date();
      const { weekStart: thisWeekStart, weekEnd: thisWeekEnd } = getWeekBounds(now);
      
      // Last week bounds
      const lastWeekStart = new Date(thisWeekStart);
      lastWeekStart.setDate(thisWeekStart.getDate() - 7);
      const lastWeekEnd = new Date(thisWeekStart);
      
      // Fetch this week's service tickets
      const { data: thisWeekTickets, error: thisWeekError } = await supabase
        .from("service_tickets")
        .select("*")
        .gte("date", thisWeekStart.toISOString())
        .lt("date", thisWeekEnd.toISOString());
      
      if (thisWeekError) {
        // Check if table doesn't exist
        if (thisWeekError.code === "42P01" || thisWeekError.message?.includes("does not exist")) {
          setServiceTableExists(false);
          return;
        }
        throw thisWeekError;
      }
      
      // Fetch last week's service tickets
      const { data: lastWeekTickets, error: lastWeekError } = await supabase
        .from("service_tickets")
        .select("*")
        .gte("date", lastWeekStart.toISOString())
        .lt("date", lastWeekEnd.toISOString());
      
      if (lastWeekError) throw lastWeekError;
      
      // Aggregate this week
      const thisWeek = {
        tickets: thisWeekTickets?.length || 0,
        gallons: 0, // Service tickets typically don't track gallons
        revenue: thisWeekTickets?.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0) || 0
      };
      
      // Aggregate last week
      const lastWeek = {
        tickets: lastWeekTickets?.length || 0,
        gallons: 0,
        revenue: lastWeekTickets?.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0) || 0
      };
      
      setServiceData({ thisWeek, lastWeek });
      setServiceTableExists(true);
    } catch (err) {
      console.error("Error fetching service metrics:", err);
      // Don't throw - allow delivery metrics to still display
      setServiceTableExists(false);
    }
  };
  
  // Load all metrics
  const loadMetrics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await fetchDeliveryMetrics();
      await fetchServiceMetrics();
      setLastUpdate(new Date());
    } catch (err) {
      console.error("Error loading metrics:", err);
      setError(err.message || "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  };
  
  // Initial load
  useEffect(() => {
    loadMetrics();
  }, []);
  
  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadMetrics();
    }, 60000); // 60 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  if (loading && !lastUpdate) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-white mx-auto mb-4"></div>
          <p className="text-white text-2xl font-semibold">Loading metrics...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-6xl font-bold text-white mb-4">
          Weekly Performance Dashboard
        </h1>
        <div className="flex justify-between items-center">
          <p className="text-2xl text-gray-300">
            This Week vs Last Week
          </p>
          {lastUpdate && (
            <p className="text-lg text-gray-400">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>
      
      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-6 mb-8 rounded-lg">
          <p className="font-bold text-xl">Error</p>
          <p className="text-lg">{error}</p>
        </div>
      )}
      
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Deliveries */}
        <WeeklyTicker 
          title="Deliveries"
          thisWeek={deliveryData.thisWeek}
          lastWeek={deliveryData.lastWeek}
        />
        
        {/* Service */}
        {serviceTableExists ? (
          <WeeklyTicker 
            title="Service"
            thisWeek={serviceData.thisWeek}
            lastWeek={serviceData.lastWeek}
          />
        ) : (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
            <h2 className="text-4xl font-bold text-gray-900 mb-8 border-b-4 border-gray-900 pb-4">
              Service
            </h2>
            <div className="text-center py-12">
              <p className="text-2xl text-gray-500">
                Service tracking table not configured
              </p>
              <p className="text-lg text-gray-400 mt-4">
                Contact your administrator to set up service ticket tracking
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Footer Note */}
      <div className="mt-8 text-center text-gray-400 text-sm">
        <p>Auto-refreshes every 60 seconds • Week starts on Sunday</p>
      </div>
    </div>
  );
}
