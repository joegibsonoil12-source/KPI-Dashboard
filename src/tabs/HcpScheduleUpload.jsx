/**
 * HCP Schedule Upload Component
 * 
 * Features:
 * - Upload HCP exports (.xlsx/.xls/.csv)
 * - Parse and normalize job data
 * - Apply Google Calendar color codes
 * - Filter jobs (All/Today/Upcoming/Missed/Billing/Urgent)
 * - Search customer history
 * - Persistent storage in localStorage
 */

import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';

// Google Calendar color palette
const CALENDAR_COLORS = {
  Yellow: '#FDD835',
  Tangerine: '#F4511E',
  Red: '#E53935',
  Flamingo: '#D81B60',
  Basil: '#0B8043',
  Blueberry: '#3F51B5',
  Lavender: '#8E24AA',
  Grape: '#9575CD',
  Graphite: '#616161',
};

const COLOR_NAMES = Object.keys(CALENDAR_COLORS);

// Status-based auto color rules
const AUTO_COLOR_RULES = {
  'completed': 'Basil',
  'scheduled': 'Blueberry',
  'in progress': 'Yellow',
  'pending': 'Tangerine',
  'pro canceled': 'Graphite',
  'canceled': 'Graphite',
  'urgent': 'Red',
  'emergency': 'Red',
  'billing': 'Flamingo',
};

const STORAGE_KEY = 'hcp-schedule-v1';

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
 * Format date
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format date with time
 */
function formatDateTime(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Parse HCP export file
 */
function parseHcpFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { raw: false, defval: '' });
        
        const jobs = rows.map((row, idx) => {
          // Normalize column names (handle variations)
          const jobNumber = row['Job #'] || row['Job Number'] || row['job_number'] || `JOB-${idx + 1}`;
          const customer = row['Customer name'] || row['Customer'] || row['customer_name'] || '';
          const status = (row['Job status'] || row['Status'] || row['status'] || '').toLowerCase();
          const jobType = row['Job description'] || row['Description'] || row['job_type'] || '';
          const scheduledDate = row['Job scheduled start date'] || row['Scheduled Date'] || row['scheduled_date'] || '';
          const createdDate = row['Job created date'] || row['Created Date'] || row['created_date'] || '';
          const technician = row['Assigned employees'] || row['Technician'] || row['assigned_to'] || '';
          const notes = row['Notes'] || row['notes'] || '';
          const amount = row['Job amount'] || row['Amount'] || row['amount'] || 0;
          const dueAmount = row['Due amount'] || row['Due'] || row['due'] || 0;
          const colorColumn = row['Color'] || row['color'] || '';
          
          // Determine color (explicit color column or auto-rule)
          let color = colorColumn && COLOR_NAMES.includes(colorColumn) ? colorColumn : null;
          
          if (!color) {
            // Apply auto rules based on status or job type
            for (const [keyword, autoColor] of Object.entries(AUTO_COLOR_RULES)) {
              if (status.includes(keyword) || jobType.toLowerCase().includes(keyword)) {
                color = autoColor;
                break;
              }
            }
          }
          
          // Default to Blueberry if no match
          if (!color) {
            color = 'Blueberry';
          }
          
          return {
            id: `${jobNumber}-${idx}`,
            jobNumber,
            customer,
            status,
            jobType,
            date: scheduledDate || createdDate,
            time: scheduledDate ? new Date(scheduledDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '',
            technician,
            notes,
            price: amount,
            dueAmount,
            color,
            rawRow: row,
          };
        });
        
        resolve(jobs);
      } catch (err) {
        reject(err);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Get today's date string (YYYY-MM-DD)
 */
function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Check if job is today
 */
function isToday(dateStr) {
  if (!dateStr) return false;
  try {
    const jobDate = new Date(dateStr).toISOString().split('T')[0];
    return jobDate === getTodayString();
  } catch {
    return false;
  }
}

/**
 * Check if job is upcoming (future)
 */
function isUpcoming(dateStr) {
  if (!dateStr) return false;
  try {
    const jobDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return jobDate > today;
  } catch {
    return false;
  }
}

/**
 * Check if job is missed (past and not completed)
 */
function isMissed(dateStr, status) {
  if (!dateStr) return false;
  try {
    const jobDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return jobDate < today && status !== 'completed';
  } catch {
    return false;
  }
}

/**
 * Color Legend Component
 */
function ColorLegend() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Color Legend (Google Calendar)</h3>
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
        {COLOR_NAMES.map((name) => (
          <div key={name} className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: CALENDAR_COLORS[name] }}
            />
            <span className="text-xs text-gray-600">{name}</span>
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
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[90vh] overflow-auto">
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
              <div className="font-medium capitalize">{job.status || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Scheduled</div>
              <div className="font-medium">{formatDateTime(job.date)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Technician</div>
              <div className="font-medium">{job.technician || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Job Amount</div>
              <div className="font-medium">{formatCurrency(job.price)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Due Amount</div>
              <div className="font-medium">{formatCurrency(job.dueAmount)}</div>
            </div>
            <div className="col-span-2">
              <div className="text-xs text-gray-500 mb-1">Color</div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: CALENDAR_COLORS[job.color] }}
                />
                <span className="font-medium">{job.color}</span>
              </div>
            </div>
          </div>
          
          {job.notes && (
            <div>
              <div className="text-xs text-gray-500 mb-1">Notes</div>
              <div className="bg-gray-50 p-3 rounded border border-gray-200">
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
 * Customer Search Component
 */
function CustomerSearch({ jobs, onSelectJob }) {
  const [search, setSearch] = useState('');
  const [showResults, setShowResults] = useState(false);
  
  const matchingJobs = useMemo(() => {
    if (!search.trim()) return [];
    const query = search.toLowerCase();
    return jobs.filter((job) =>
      job.customer.toLowerCase().includes(query)
    );
  }, [jobs, search]);
  
  const groupedByCustomer = useMemo(() => {
    const groups = {};
    matchingJobs.forEach((job) => {
      if (!groups[job.customer]) {
        groups[job.customer] = [];
      }
      groups[job.customer].push(job);
    });
    return groups;
  }, [matchingJobs]);
  
  return (
    <div className="relative mb-6">
      <input
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setShowResults(true);
        }}
        onFocus={() => setShowResults(true)}
        placeholder="Search customer name..."
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      
      {showResults && search.trim() && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-auto">
          {Object.keys(groupedByCustomer).length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No customers found</div>
          ) : (
            <div>
              {Object.entries(groupedByCustomer).map(([customer, customerJobs]) => (
                <div key={customer} className="border-b last:border-b-0">
                  <div className="bg-gray-50 px-4 py-2 font-semibold text-sm">
                    {customer} ({customerJobs.length} job{customerJobs.length !== 1 ? 's' : ''})
                  </div>
                  {customerJobs.map((job) => (
                    <div
                      key={job.id}
                      onClick={() => {
                        onSelectJob(job);
                        setShowResults(false);
                      }}
                      className="px-4 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded"
                              style={{ backgroundColor: CALENDAR_COLORS[job.color] }}
                            />
                            <span className="font-medium text-sm">Job #{job.jobNumber}</span>
                            <span className="text-xs text-gray-500 capitalize">{job.status}</span>
                          </div>
                          <div className="text-xs text-gray-600 mt-1">{job.jobType}</div>
                          <div className="text-xs text-gray-500">{formatDate(job.date)}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-sm">{formatCurrency(job.price)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Main HCP Schedule Upload Component
 */
export default function HcpScheduleUpload() {
  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [selectedJob, setSelectedJob] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        setJobs(data.jobs || []);
      }
    } catch (err) {
      console.error('[HcpSchedule] Error loading from localStorage:', err);
    }
  }, []);
  
  // Save to localStorage whenever jobs change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ jobs }));
    } catch (err) {
      console.error('[HcpSchedule] Error saving to localStorage:', err);
    }
  }, [jobs]);
  
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    
    try {
      const parsedJobs = await parseHcpFile(file);
      setJobs(parsedJobs);
      alert(`Successfully imported ${parsedJobs.length} job(s)!`);
    } catch (err) {
      console.error('[HcpSchedule] Error parsing file:', err);
      alert('Failed to parse file: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset input
    }
  };
  
  const filteredJobs = useMemo(() => {
    switch (filter) {
      case 'today':
        return jobs.filter((job) => isToday(job.date));
      case 'upcoming':
        return jobs.filter((job) => isUpcoming(job.date));
      case 'missed':
        return jobs.filter((job) => isMissed(job.date, job.status));
      case 'billing':
        return jobs.filter((job) => parseFloat(job.dueAmount) > 0);
      case 'urgent':
        return jobs.filter((job) => 
          job.color === 'Red' || 
          job.status.includes('emergency') ||
          job.jobType.toLowerCase().includes('emergency')
        );
      default:
        return jobs;
    }
  }, [jobs, filter]);
  
  const stats = useMemo(() => {
    const today = jobs.filter((job) => isToday(job.date)).length;
    const upcoming = jobs.filter((job) => isUpcoming(job.date)).length;
    const missed = jobs.filter((job) => isMissed(job.date, job.status)).length;
    const billing = jobs.filter((job) => parseFloat(job.dueAmount) > 0).length;
    const urgent = jobs.filter((job) => 
      job.color === 'Red' || 
      job.status.includes('emergency') ||
      job.jobType.toLowerCase().includes('emergency')
    ).length;
    
    return { today, upcoming, missed, billing, urgent };
  }, [jobs]);
  
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">HCP Schedule</h1>
        <p className="text-gray-600">Upload and manage HousecallPro schedule exports</p>
      </div>
      
      {/* File Upload */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold mb-3">Upload Schedule</h3>
        <div className="flex items-center gap-4">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            disabled={uploading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />
          {jobs.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Clear all jobs?')) {
                  setJobs([]);
                }
              }}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
            >
              Clear All
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Supports .xlsx, .xls, and .csv files exported from HousecallPro
        </p>
      </div>
      
      {jobs.length > 0 && (
        <>
          {/* Color Legend */}
          <ColorLegend />
          
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">Total Jobs</div>
              <div className="text-2xl font-bold">{jobs.length}</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">Today</div>
              <div className="text-2xl font-bold text-blue-600">{stats.today}</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">Upcoming</div>
              <div className="text-2xl font-bold text-green-600">{stats.upcoming}</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">Missed</div>
              <div className="text-2xl font-bold text-yellow-600">{stats.missed}</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">Urgent</div>
              <div className="text-2xl font-bold text-red-600">{stats.urgent}</div>
            </div>
          </div>
          
          {/* Customer Search */}
          <CustomerSearch jobs={jobs} onSelectJob={setSelectedJob} />
          
          {/* Filters */}
          <div className="mb-6 flex gap-2 flex-wrap">
            {['all', 'today', 'upcoming', 'missed', 'billing', 'urgent'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg font-medium text-sm ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f !== 'all' && ` (${stats[f] || filteredJobs.length})`}
              </button>
            ))}
          </div>
          
          {/* Jobs List */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {filteredJobs.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No jobs match the selected filter
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Color</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job #</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date/Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Technician</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredJobs.map((job) => (
                      <tr key={job.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div
                            className="w-6 h-6 rounded"
                            style={{ backgroundColor: CALENDAR_COLORS[job.color] }}
                            title={job.color}
                          />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">{job.jobNumber}</td>
                        <td className="px-4 py-3 text-sm">{job.customer}</td>
                        <td className="px-4 py-3 text-sm">{job.jobType}</td>
                        <td className="px-4 py-3 text-sm">
                          <div>{formatDate(job.date)}</div>
                          {job.time && <div className="text-xs text-gray-500">{job.time}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm">{job.technician}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="capitalize">{job.status}</span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">{formatCurrency(job.price)}</td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => setSelectedJob(job)}
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
            )}
          </div>
        </>
      )}
      
      {jobs.length === 0 && !uploading && (
        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <div className="text-gray-500 mb-2">No schedule uploaded</div>
          <div className="text-sm text-gray-400">
            Upload an HCP export file (.xlsx, .xls, or .csv) to get started
          </div>
        </div>
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
