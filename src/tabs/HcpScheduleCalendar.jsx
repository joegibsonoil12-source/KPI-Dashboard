/**
 * HCP Schedule Calendar Component
 * 
 * Displays service jobs from Supabase in a week-view calendar.
 * Replaces the old file upload stub with real data.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  format, 
  addWeeks, 
  subWeeks,
  isSameDay,
  startOfDay,
  endOfDay,
  parseISO
} from 'date-fns';
import { fetchServiceJobsForRange } from '../lib/serviceSchedule';

// Google Calendar color palette
const COLOR_CODES = {
  Yellow: { bg: '#FDD835', text: '#000000' },
  Tangerine: { bg: '#F4511E', text: '#FFFFFF' },
  Red: { bg: '#E53935', text: '#FFFFFF' },
  Flamingo: { bg: '#D81B60', text: '#FFFFFF' },
  Basil: { bg: '#0B8043', text: '#FFFFFF' },
  Blueberry: { bg: '#3F51B5', text: '#FFFFFF' },
  Lavender: { bg: '#8E24AA', text: '#FFFFFF' },
  Grape: { bg: '#9575CD', text: '#FFFFFF' },
  Graphite: { bg: '#616161', text: '#FFFFFF' },
};

/**
 * Determine color for a job based on type, status, and notes
 */
function getColorForJob(job) {
  const status = (job.status || "").toLowerCase();
  const type = (job.jobType || "").toLowerCase();
  const notes = (job.notes || "").toLowerCase();

  // Red - Leak / Urgent
  if (type.includes("leak") || notes.includes("leak")) return "Red";
  
  // Yellow - Started / Tech on site
  if (status.includes("in progress") || status.includes("in_progress") || status.includes("started")) return "Yellow";
  
  // Tangerine - Part ordered / Job incomplete / Inspection pending
  if (status.includes("part") || status.includes("incomplete") || status.includes("inspection")) return "Tangerine";
  
  // Flamingo - Need more info for billing
  if (notes.includes("need info") || notes.includes("needs info") || status.includes("needs info")) return "Flamingo";
  
  // Blueberry - Installation job
  if (type.includes("install")) return "Blueberry";
  
  // Basil - Service call / light pilot
  if (type.includes("service") || type.includes("call") || type.includes("pilot")) return "Basil";
  
  // Lavender - Complete, ready to bill
  if ((status.includes("completed") || status.includes("done")) && !status.includes("paid")) return "Lavender";
  
  // Grape - Billed, closed work order
  if (status.includes("paid") || status.includes("billed")) return "Grape";
  
  // Graphite - Unscheduled
  if (!job.scheduledStart || status.includes("unscheduled")) return "Graphite";
  
  // Default to Yellow
  return "Yellow";
}

/**
 * Format time range for display
 */
function formatTimeRange(start, end) {
  if (!start) return "";
  try {
    const startDate = typeof start === 'string' ? parseISO(start) : start;
    const timeStr = format(startDate, 'h:mm a');
    if (end) {
      const endDate = typeof end === 'string' ? parseISO(end) : end;
      return `${timeStr} - ${format(endDate, 'h:mm a')}`;
    }
    return timeStr;
  } catch {
    return "";
  }
}

/**
 * Format currency
 */
function formatCurrency(value) {
  const num = typeof value === 'number' ? value : parseFloat(value?.toString().replace(/[^0-9.-]/g, '') || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
}

/**
 * Color Legend Component
 */
function ColorLegend() {
  const legendItems = [
    { color: 'Yellow', label: 'Started / Tech on site' },
    { color: 'Tangerine', label: 'Part ordered / Incomplete / Inspection' },
    { color: 'Red', label: 'Leak / Urgent' },
    { color: 'Flamingo', label: 'Need more info for billing' },
    { color: 'Basil', label: 'Service call / Light pilot' },
    { color: 'Blueberry', label: 'Installation job' },
    { color: 'Lavender', label: 'Complete, ready to bill' },
    { color: 'Grape', label: 'Billed, closed work order' },
    { color: 'Graphite', label: 'Unscheduled' },
  ];
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Color Legend</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {legendItems.map(({ color, label }) => (
          <div key={color} className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: COLOR_CODES[color].bg }}
            />
            <span className="text-xs text-gray-600">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Job Detail Modal
 */
function JobDetailModal({ job, onClose }) {
  if (!job) return null;
  
  const colorKey = getColorForJob(job);
  const color = COLOR_CODES[colorKey];
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="border-b p-6 sticky top-0 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Job #{job.jobNumber}</h2>
              <p className="text-gray-600 mt-1">{job.customer}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <div className="text-xs text-gray-500 mb-1">Job Type</div>
              <div className="font-medium">{job.jobType || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Status</div>
              <div className="font-medium capitalize">{job.status.replace(/_/g, ' ') || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Scheduled</div>
              <div className="font-medium">
                {job.scheduledStart ? format(parseISO(job.scheduledStart), 'MMM d, yyyy h:mm a') : '-'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Technician</div>
              <div className="font-medium">{job.technician || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Job Amount</div>
              <div className="font-medium">{formatCurrency(job.jobAmount)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Due Amount</div>
              <div className="font-medium">{formatCurrency(job.dueAmount)}</div>
            </div>
            {job.address && (
              <div className="col-span-2">
                <div className="text-xs text-gray-500 mb-1">Address</div>
                <div className="font-medium">{job.address}</div>
              </div>
            )}
            <div className="col-span-2">
              <div className="text-xs text-gray-500 mb-1">Color</div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: color.bg }}
                />
                <span className="font-medium">{colorKey}</span>
              </div>
            </div>
          </div>
          
          {job.notes && (
            <div>
              <div className="text-xs text-gray-500 mb-1">Notes</div>
              <div className="bg-gray-50 p-3 rounded border border-gray-200 whitespace-pre-wrap">
                {job.notes}
              </div>
            </div>
          )}
        </div>
        
        <div className="border-t p-6 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Calendar Header with Navigation
 */
function CalendarHeader({ viewStart, viewEnd, onPrevWeek, onNextWeek, onToday }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onPrevWeek}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          ← Prev Week
        </button>
        <button
          onClick={onToday}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
        >
          Today
        </button>
        <button
          onClick={onNextWeek}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Next Week →
        </button>
      </div>
      <div className="text-lg font-semibold">
        {format(viewStart, 'MMM d')} - {format(viewEnd, 'MMM d, yyyy')}
      </div>
    </div>
  );
}

/**
 * Day Column Component
 */
function DayColumn({ day, jobs, onSelectJob }) {
  const isToday = isSameDay(day, new Date());
  
  return (
    <div className={`border rounded-lg p-2 min-h-[200px] ${isToday ? 'bg-blue-50 border-blue-300' : 'bg-white'}`}>
      <div className={`text-xs font-semibold mb-2 ${isToday ? 'text-blue-700' : 'text-gray-600'}`}>
        {format(day, 'EEE MM/dd')}
        {isToday && <span className="ml-1 text-xs">(Today)</span>}
      </div>
      <div className="flex flex-col gap-1">
        {jobs.map(job => {
          const colorKey = getColorForJob(job);
          const color = COLOR_CODES[colorKey];
          return (
            <button
              key={job.id}
              className="w-full text-left rounded-md px-2 py-1 text-xs hover:opacity-80 transition-opacity"
              style={{ backgroundColor: color.bg, color: color.text }}
              onClick={() => onSelectJob(job)}
            >
              <div className="font-semibold truncate">{job.customer}</div>
              <div className="truncate">{job.jobType || job.status.replace(/_/g, ' ')}</div>
              <div className="text-xs opacity-90">{formatTimeRange(job.scheduledStart, job.scheduledEnd)}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Customer History Section
 */
function CustomerHistory({ jobs, searchTerm, onSelectJob }) {
  const historyJobs = useMemo(() => {
    if (!searchTerm.trim()) return [];
    
    const filtered = jobs.filter(j => 
      j.customer.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    // Sort by date descending
    return filtered.sort((a, b) => {
      if (!a.scheduledStart) return 1;
      if (!b.scheduledStart) return -1;
      return new Date(b.scheduledStart) - new Date(a.scheduledStart);
    });
  }, [jobs, searchTerm]);
  
  if (!searchTerm.trim() || historyJobs.length === 0) {
    return null;
  }
  
  return (
    <div className="mt-6 bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-3">
        Customer History ({historyJobs.length} job{historyJobs.length !== 1 ? 's' : ''})
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Job #</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Job Type</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Amount</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {historyJobs.map(job => (
              <tr key={job.id} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  {job.scheduledStart ? format(parseISO(job.scheduledStart), 'MMM d, yyyy') : '-'}
                </td>
                <td className="px-3 py-2 font-medium">{job.jobNumber}</td>
                <td className="px-3 py-2">{job.jobType || '-'}</td>
                <td className="px-3 py-2 capitalize">{job.status.replace(/_/g, ' ')}</td>
                <td className="px-3 py-2">{formatCurrency(job.jobAmount)}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => onSelectJob(job)}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Main HCP Schedule Calendar Component
 */
export default function HcpScheduleCalendar() {
  const [viewStart, setViewStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [viewEnd, setViewEnd] = useState(() => endOfWeek(new Date(), { weekStartsOn: 0 }));
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [filterTech, setFilterTech] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Load jobs for current week
  useEffect(() => {
    async function loadJobs() {
      setLoading(true);
      setError(null);
      
      try {
        const data = await fetchServiceJobsForRange(viewStart, viewEnd);
        setJobs(data);
      } catch (err) {
        console.error('[HcpSchedule] Error loading jobs:', err);
        setError(err.message || 'Failed to load jobs');
      } finally {
        setLoading(false);
      }
    }
    
    loadJobs();
  }, [viewStart, viewEnd]);
  
  // Navigation handlers
  const handlePrevWeek = () => {
    const newStart = subWeeks(viewStart, 1);
    setViewStart(startOfWeek(newStart, { weekStartsOn: 0 }));
    setViewEnd(endOfWeek(newStart, { weekStartsOn: 0 }));
  };
  
  const handleNextWeek = () => {
    const newStart = addWeeks(viewStart, 1);
    setViewStart(startOfWeek(newStart, { weekStartsOn: 0 }));
    setViewEnd(endOfWeek(newStart, { weekStartsOn: 0 }));
  };
  
  const handleToday = () => {
    const today = new Date();
    setViewStart(startOfWeek(today, { weekStartsOn: 0 }));
    setViewEnd(endOfWeek(today, { weekStartsOn: 0 }));
  };
  
  // Get unique technicians
  const availableTechs = useMemo(() => {
    const techSet = new Set();
    jobs.forEach(job => {
      if (job.technician) techSet.add(job.technician);
    });
    return Array.from(techSet).sort();
  }, [jobs]);
  
  // Filter jobs by technician and search
  const filteredJobs = useMemo(() => {
    let filtered = jobs;
    
    // Filter by tech
    if (filterTech !== "all") {
      filtered = filtered.filter(j => j.technician === filterTech);
    }
    
    // Filter by search term
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      filtered = filtered.filter(j => 
        j.customer.toLowerCase().includes(query) ||
        j.jobNumber.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [jobs, filterTech, searchTerm]);
  
  // Group jobs by day
  const jobsByDay = useMemo(() => {
    const days = eachDayOfInterval({ start: viewStart, end: viewEnd });
    const grouped = {};
    
    days.forEach(day => {
      grouped[day.toISOString()] = [];
    });
    
    filteredJobs.forEach(job => {
      if (job.scheduledStart) {
        const jobDate = parseISO(job.scheduledStart);
        const dayKey = startOfDay(jobDate).toISOString();
        
        if (grouped[dayKey]) {
          grouped[dayKey].push(job);
        }
      }
    });
    
    return grouped;
  }, [viewStart, viewEnd, filteredJobs]);
  
  const days = eachDayOfInterval({ start: viewStart, end: viewEnd });
  
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Schedule (HCP)</h1>
        <p className="text-gray-600">Weekly calendar view of service jobs</p>
      </div>
      
      {/* Color Legend */}
      <ColorLegend />
      
      {/* Search and Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search customer name or job number..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Technician:</label>
            <select
              value={filterTech}
              onChange={(e) => setFilterTech(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Technicians</option>
              {availableTechs.map(tech => (
                <option key={tech} value={tech}>{tech}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-6">
          <p className="text-red-800">
            <strong>Error:</strong> {error}
          </p>
        </div>
      )}
      
      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="text-gray-500">Loading schedule...</div>
        </div>
      )}
      
      {/* Calendar */}
      {!loading && (
        <>
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
            <CalendarHeader
              viewStart={viewStart}
              viewEnd={viewEnd}
              onPrevWeek={handlePrevWeek}
              onNextWeek={handleNextWeek}
              onToday={handleToday}
            />
            
            <div className="grid grid-cols-7 gap-2">
              {days.map(day => (
                <DayColumn
                  key={day.toISOString()}
                  day={day}
                  jobs={jobsByDay[startOfDay(day).toISOString()] || []}
                  onSelectJob={setSelectedJob}
                />
              ))}
            </div>
          </div>
          
          {/* Stats */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
            <div className="text-sm text-gray-600">
              Showing <strong>{filteredJobs.length}</strong> job{filteredJobs.length !== 1 ? 's' : ''} this week
              {filterTech !== "all" && ` for ${filterTech}`}
              {searchTerm && ` matching "${searchTerm}"`}
            </div>
          </div>
          
          {/* Customer History */}
          <CustomerHistory
            jobs={jobs}
            searchTerm={searchTerm}
            onSelectJob={setSelectedJob}
          />
        </>
      )}
      
      {/* Job Detail Modal */}
      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
        />
      )}
    </div>
  );
}
