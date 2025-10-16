import React, { useEffect, useMemo, useRef, useState } from "react";
import supabase from "../lib/supabaseClient";
import {
  fetchTickets,
  fetchTicketsPage,
  insertTicket,
  updateTicket,
  updateTicketBatchSequential,
  deleteTicket,
  uploadAttachmentFile,
  insertAttachmentMetadata,
  createSignedUrl,
  listAttachmentsForTicket,
} from "../lib/supabaseHelpers";
import { toLocalDateTimeInputValue, fromLocalDateTimeInputValue } from "../lib/datetime";
import { computeMetrics, computePerTruck, getUniqueTrucks } from "../lib/metrics";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import * as XLSX from "xlsx";
import { useAutosave } from "../lib/useAutosave";
import SaveBar from "./SaveBar";

/*
DeliveryTickets (Supabase-backed)
- Tickets are stored in delivery_tickets with created_by = auth.uid()
- Attachments uploaded to a private bucket and metadata stored in ticket_attachments
- Downloads use createSignedUrl(...) for a time-limited URL
*/

export default function DeliveryTickets() {
  const [tickets, setTickets] = useState([]);
  const [batchStatus, setBatchStatus] = useState("open"); // open | posted
  const [errors, setErrors] = useState([]);
  const csvRef = useRef(null);
  const attachRef = useRef(null);
  const [uploadingFor, setUploadingFor] = useState(null);
  const [attachmentsMap, setAttachmentsMap] = useState({}); // ticketId -> [attachments]
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  
  // Autosave: pending changes map { ticketId: { field: value, ... } }
  const [pendingChanges, setPendingChanges] = useState({});
  
  // Filtering state
  const [dateFilter, setDateFilter] = useState("all"); // all | today | week | month | year | custom
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [selectedTruck, setSelectedTruck] = useState("ALL"); // ALL | specific truck

  // Autosave hook
  const autosave = useAutosave({
    storageKey: "delivery-tickets-draft",
    delayMs: 2000,
    serializeDraft: (data) => JSON.stringify(data),
    deserializeDraft: (str) => JSON.parse(str),
    onFlush: async (changesById) => {
      // Flush all pending changes to Supabase
      const results = await updateTicketBatchSequential(changesById);
      
      // Check for any errors
      const errors = Object.entries(results).filter(([_, result]) => !result.success);
      if (errors.length > 0) {
        console.error("Some ticket updates failed:", errors);
        // Throw to trigger error state in autosave
        throw new Error(`Failed to save ${errors.length} ticket(s). See console for details.`);
      }
    },
  });

  // Filtering logic
  const filteredByDate = useMemo(() => {
    if (dateFilter === "all") return tickets;
    
    const now = new Date();
    let startDate, endDate;
    
    if (dateFilter === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else if (dateFilter === "week") {
      const dayOfWeek = now.getDay();
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (7 - dayOfWeek));
    } else if (dateFilter === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    } else if (dateFilter === "year") {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear() + 1, 0, 1);
    } else if (dateFilter === "custom") {
      if (!customStartDate && !customEndDate) return tickets;
      startDate = customStartDate ? new Date(customStartDate) : new Date(0);
      endDate = customEndDate ? new Date(new Date(customEndDate).getTime() + 86400000) : new Date(8640000000000000);
    }
    
    return tickets.filter(t => {
      if (!t.date) return false;
      const ticketDate = new Date(t.date);
      return ticketDate >= startDate && ticketDate < endDate;
    });
  }, [tickets, dateFilter, customStartDate, customEndDate]);
  
  // Get available trucks from filtered data
  const availableTrucks = useMemo(() => getUniqueTrucks(filteredByDate), [filteredByDate]);
  
  // Filter by truck selection
  const filteredTickets = useMemo(() => {
    if (selectedTruck === "ALL") return filteredByDate;
    return filteredByDate.filter(t => {
      const truckKey = t.truck || t.truck_id || "Unassigned";
      return truckKey === selectedTruck;
    });
  }, [filteredByDate, selectedTruck]);
  
  // Overall metrics (for all trucks in date range)
  const overallMetrics = useMemo(() => computeMetrics(filteredByDate), [filteredByDate]);
  
  // Selected truck metrics
  const truckMetrics = useMemo(() => {
    if (selectedTruck === "ALL") return overallMetrics;
    return computeMetrics(filteredTickets);
  }, [filteredTickets, selectedTruck, overallMetrics]);
  
  // Per-truck breakdown
  const perTruckData = useMemo(() => {
    const metrics = computePerTruck(filteredByDate);
    return Object.keys(metrics).map(truck => ({
      truck,
      ...metrics[truck],
    })).sort((a, b) => b.amount - a.amount);
  }, [filteredByDate]);
  
  // Legacy control object for compatibility
  const control = useMemo(() => {
    return {
      qty: overallMetrics.tickets,
      amount: overallMetrics.amount,
      totalGallons: overallMetrics.totalGallons,
      avgMiles: overallMetrics.avgMiles,
      onTimePct: overallMetrics.onTimePct,
    };
  }, [overallMetrics]);

  async function currentUserId() {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const { rows, count } = await fetchTicketsPage(page, pageSize);
        if (!mounted) return;
        
        setTotalCount(count);
        
        // Load any persisted draft and merge into state
        const draft = autosave.loadDraft();
        if (draft) {
          // Apply draft changes to loaded rows
          const mergedRows = rows.map(row => {
            if (draft[row.id]) {
              return { ...row, ...draft[row.id] };
            }
            return row;
          });
          setTickets(mergedRows);
          setPendingChanges(draft);
          
          // Schedule autosave flush for rehydrated changes
          setTimeout(() => {
            if (mounted) {
              autosave.queueChanges(draft);
            }
          }, 100);
        } else {
          setTickets(rows);
        }
        
        // load attachments for visible rows (small optimization)
        // Make attachment fetching non-fatal - wrap each call in try/catch
        const map = {};
        await Promise.all(rows.slice(0, 30).map(async (r) => {
          try {
            const a = await listAttachmentsForTicket(r.id);
            map[r.id] = a;
          } catch (e) {
            console.error(`Failed to load attachments for ticket ${r.id}:`, e.message || e);
            map[r.id] = []; // Set empty array so UI still works
          }
        }));
        if (!mounted) return;
        setAttachmentsMap(map);
      } catch (e) {
        console.error("Failed to load tickets:", e);
        const errorMsg = e.message || e.error_description || JSON.stringify(e);
        alert(`Failed to load tickets: ${errorMsg}. See console for details.`);
      }
    }
    load();
    return () => { mounted = false; };
  }, [page, pageSize]);

  async function addBlank() {
    const userId = await currentUserId();
    // Calculate yesterday's date
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const newRow = {
      date: yesterday,
      driver: "", 
      truck: "", 
      truck_id: null, // legacy - use null to avoid unique constraint on empty string
      customerName: "", 
      customer_name: "", // legacy
      account: "",
      qty: null, 
      price: null, 
      tax: null, 
      hazmat_fee: null,
      amount: null, 
      status: "draft", 
      notes: "",
      ticket_id: null, // use null to avoid unique constraint on empty string
      ticket_no: null, // legacy - use null to avoid unique constraint on empty string
      gallons: null, // legacy
      gallons_delivered: null,
      price_per_gallon: null, // legacy
      total_amount: null, // legacy
      delivery_date: yesterday, // legacy
      ticket_date: yesterday, // legacy
      scheduled_window_start: null,
      arrival_time: null,
      departure_time: null,
      odometer_start: null,
      odometer_end: null,
      miles_driven: null,
      on_time_flag: null,
      created_by: userId,
    };
    try {
      const created = await insertTicket(newRow);
      setTickets(t => [created, ...t]);
    } catch (e) {
      console.error("Failed to add ticket:", e);
      const errorMsg = e.message || e.error_description || JSON.stringify(e);
      alert(`Failed to add ticket: ${errorMsg}. See console for details.`);
    }
  }

  async function update(id, key, val) {
    const numericKeys = ["qty", "price", "tax", "hazmat_fee", "amount", "gallons_delivered", "odometer_start", "odometer_end"];
    // Allow blank/empty for numeric fields - only convert to number if non-empty
    const nextVal = numericKeys.includes(key) 
      ? (val === "" || val == null ? null : Number(val))
      : val;
    
    // Prepare update payload with computed fields
    const payload = { [key]: nextVal };
    
    // Get current ticket state to compute derived fields
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return;
    
    // Include auto-calculated amount in update
    if (key === "qty" || key === "price" || key === "tax" || key === "hazmat_fee") {
      const qty = key === "qty" ? (nextVal || 0) : (ticket.qty || 0);
      const price = key === "price" ? (nextVal || 0) : (ticket.price || 0);
      const tax = key === "tax" ? (nextVal || 0) : (ticket.tax || 0);
      const hazmat_fee = key === "hazmat_fee" ? (nextVal || 0) : (ticket.hazmat_fee || 0);
      payload.amount = qty * price + tax + hazmat_fee;
    }
    
    // Include computed fields in update if they were computed
    if (key === "odometer_start" || key === "odometer_end") {
      const start = key === "odometer_start" ? nextVal : ticket.odometer_start;
      const end = key === "odometer_end" ? nextVal : ticket.odometer_end;
      if (start != null && end != null && start !== "" && end !== "") {
        payload.miles_driven = Number(end) - Number(start);
      } else {
        payload.miles_driven = null;
      }
    }
    
    if (key === "scheduled_window_start" || key === "arrival_time") {
      const scheduled = key === "scheduled_window_start" ? nextVal : ticket.scheduled_window_start;
      const arrival = key === "arrival_time" ? nextVal : ticket.arrival_time;
      if (scheduled && arrival) {
        const scheduledDate = new Date(scheduled);
        const arrivalDate = new Date(arrival);
        const graceMs = 5 * 60 * 1000;
        payload.on_time_flag = arrivalDate <= new Date(scheduledDate.getTime() + graceMs) ? 1 : 0;
      } else {
        payload.on_time_flag = null;
      }
    }
    
    // Update local state immediately for responsiveness
    setTickets(ts => ts.map(t => {
      if (t.id !== id) return t;
      return { ...t, ...payload };
    }));
    
    // Queue changes for autosave
    setPendingChanges(prev => {
      const updated = {
        ...prev,
        [id]: {
          ...(prev[id] || {}),
          ...payload,
        },
      };
      
      // Queue autosave
      autosave.queueChanges(updated);
      
      return updated;
    });
  }

  async function remove(id) {
    if (!confirm("Delete this ticket?")) return;
    try {
      await deleteTicket(id);
      setTickets(ts => ts.filter(t => t.id !== id));
      setAttachmentsMap(m => { const copy = { ...m }; delete copy[id]; return copy; });
      
      // Clear pending changes for deleted ticket
      setPendingChanges(prev => {
        const updated = { ...prev };
        delete updated[id];
        if (Object.keys(updated).length > 0) {
          autosave.queueChanges(updated);
        } else {
          autosave.discard();
        }
        return updated;
      });
    } catch (e) {
      console.error(e);
      alert("Delete failed.");
    }
  }

  // SaveBar handlers
  async function handleSaveNow() {
    await autosave.saveNow();
    setPendingChanges({});
  }

  async function handleDiscard() {
    if (!confirm("Discard all unsaved changes? This will reload data from the server.")) return;
    
    // Clear pending changes
    setPendingChanges({});
    autosave.discard();
    
    // Reload fresh data from server
    try {
      const { rows, count } = await fetchTicketsPage(page, pageSize);
      setTickets(rows);
      setTotalCount(count);
    } catch (e) {
      console.error("Failed to reload tickets:", e);
      alert("Failed to reload tickets. Please refresh the page.");
    }
  }

  // Reset input scroll position on blur to prevent inputs staying scrolled to the right
  function handleInputBlur(e) {
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) {
      e.target.scrollLeft = 0;
    }
  }

  async function importCSVFile(file) {
    const text = await file.text();
    const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
    const headers = headerLine.split(",").map(h => h.trim());
    const required = ["date","driver","truck","customer","account","qty","price","tax","amount"];
    const missing = required.filter(r => !headers.includes(r));
    if (missing.length) {
      alert("Missing csv columns: " + missing.join(", "));
      return;
    }
    const idx = Object.fromEntries(headers.map((h,i)=>[h,i]));
    const rows = lines.map((ln) => {
      const c = ln.split(",");
      return {
        date: c[idx.date],
        driver: c[idx.driver],
        truck: c[idx.truck],
        customerName: c[idx.customer],
        account: c[idx.account],
        qty: Number(c[idx.qty]||0),
        price: Number(c[idx.price]||0),
        tax: Number(c[idx.tax]||0),
        amount: Number(c[idx.amount]||0),
        status: "draft",
      };
    });
    const userId = await currentUserId();
    try {
      const toInsert = rows.map(r => ({ ...r, created_by: userId }));
      const { data, error } = await supabase.from("delivery_tickets").insert(toInsert).select();
      if (error) throw error;
      setTickets(t => [...data, ...t]);
      alert(`Imported ${data.length} rows.`);
    } catch (e) {
      console.error("Import failed:", e);
      alert("CSV import failed. See console.");
    }
  }

  function handleImportInput(e) {
    const f = e.target.files?.[0];
    if (f) importCSVFile(f);
    e.target.value = "";
  }

  // Attachments flow
  function startAttach(ticketId) {
    setUploadingFor(ticketId);
    attachRef.current?.click();
  }

  async function onAttachInput(e) {
    const file = e.target.files?.[0];
    if (file && uploadingFor) {
      await handleAttachFile(uploadingFor, file);
      // refresh attachments for ticket
      const a = await listAttachmentsForTicket(uploadingFor);
      setAttachmentsMap(m => ({ ...m, [uploadingFor]: a }));
      setUploadingFor(null);
    }
    e.target.value = "";
  }

  async function handleAttachFile(ticketId, file) {
    const path = `tickets/${ticketId}/${Date.now()}-${file.name}`;
    try {
      const upload = await uploadAttachmentFile(file, path);
      const userId = await currentUserId();
      // upload.path may be returned as 'Key' or 'path' depending on client; fall back to our path
      const storage_key = upload?.path || upload?.Key || path;
      await insertAttachmentMetadata({
        ticket_id: ticketId,
        storage_key,
        filename: file.name,
        content_type: file.type,
        size: file.size,
        uploaded_by: userId,
      });
      alert("Attachment uploaded.");
    } catch (e) {
      console.error("Upload failed:", e);
      alert("Attachment upload failed.");
    }
  }

  async function openAttachment(storageKey) {
    try {
      const { signedUrl } = await createSignedUrl(storageKey, 60 * 10);
      if (signedUrl) {
        window.open(signedUrl, "_blank", "noopener");
      } else {
        alert("Unable to create download link.");
      }
    } catch (e) {
      console.error("Signed URL error:", e);
      alert("Unable to create download link.");
    }
  }

  function validate() {
    const es = [];
    tickets.forEach((t, i) => {
      if (!t.customerName) es.push({ i, msg: "Missing customer" });
      if (!t.account) es.push({ i, msg: "Missing account" });
      if ((t.qty || 0) <= 0) es.push({ i, msg: "Qty must be > 0" });
      if ((t.price || 0) < 0) es.push({ i, msg: "Price must be >= 0" });
    });
    setErrors(es);
    if (!es.length) alert("No exceptions. Ready to transfer.");
  }

  async function postBatch() {
    if (errors.length) return alert("Resolve exceptions first.");
    if (!tickets.length) return alert("Nothing to post.");
    try {
      const ids = tickets.filter(t => t.status === "draft").map(t => t.id);
      if (ids.length) {
        await supabase.from("delivery_tickets").update({ status: "posted" }).in("id", ids);
      }
      const fresh = await fetchTickets();
      setTickets(fresh);
      setBatchStatus("posted");
      alert("Batch posted.");
    } catch (e) {
      console.error("Post failed:", e);
      alert("Post failed.");
    }
  }

  function exportPPS() {
    const csv = [
      "date,driver,truck,customer,qty,amount",
      ...tickets.filter(t => t.status === "posted").map(t =>
        [t.date, t.driver, t.truck, t.customerName, t.qty, t.amount].join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "pps-truck-export.csv"; a.click(); URL.revokeObjectURL(a.href);
  }
  
  // Export filtered tickets to CSV
  function exportCSV() {
    const headers = ["date", "truck", "driver", "ticket_id", "customerName", "gallons_delivered", 
                     "account", "qty", "price", "tax", "hazmat_fee", "amount", "status"];
    const csvContent = [
      headers.join(","),
      ...filteredTickets.map(t => 
        headers.map(h => {
          const val = t[h] ?? "";
          // Escape values that contain commas or quotes
          return String(val).includes(",") || String(val).includes('"') 
            ? `"${String(val).replace(/"/g, '""')}"` 
            : val;
        }).join(",")
      )
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `delivery-tickets-${dateFilter}-${selectedTruck}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  // Export filtered tickets to Excel
  function exportExcel() {
    const headers = ["Date", "Truck", "Driver", "Ticket ID", "Customer", "Gallons Delivered", 
                     "Account", "Qty", "Price", "Tax", "Hazmat Fee", "Amount", "Status"];
    const dataKeys = ["date", "truck", "driver", "ticket_id", "customerName", "gallons_delivered", 
                      "account", "qty", "price", "tax", "hazmat_fee", "amount", "status"];
    
    const worksheetData = [
      headers,
      ...filteredTickets.map(t => dataKeys.map(k => t[k] ?? ""))
    ];
    
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tickets");
    
    const filename = `delivery-tickets-${dateFilter}-${selectedTruck}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
  }
  
  // Prepare chart data - group by date
  const chartData = useMemo(() => {
    const dataToUse = selectedTruck === "ALL" ? filteredByDate : filteredTickets;
    const grouped = {};
    
    dataToUse.forEach(t => {
      const date = t.date || "Unknown";
      if (!grouped[date]) {
        grouped[date] = { date, gallons: 0, revenue: 0 };
      }
      grouped[date].gallons += Number(t.gallons_delivered || t.qty) || 0;
      grouped[date].revenue += Number(t.amount) || 0;
    });
    
    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredByDate, filteredTickets, selectedTruck]);

  return (
    <div className="dt-page space-y-6">
      {/* SaveBar for manual save/discard */}
      <SaveBar
        visible={autosave.hasUnsavedChanges}
        isSaving={autosave.isSaving}
        lastSavedAt={autosave.lastSavedAt}
        error={autosave.error}
        onSave={handleSaveNow}
        onDiscard={handleDiscard}
      />
      
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Delivery Tickets</h2>
        <div className="flex items-center gap-2">
          <button className="rounded-lg border px-3 py-1.5" onClick={addBlank}>Add ticket</button>
          <button className="rounded-lg border px-3 py-1.5" onClick={() => csvRef.current?.click()}>Import CSV</button>
          <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleImportInput} />
        </div>
      </header>

      {/* Date Filter Bar */}
      <div className="rounded-lg border p-4 bg-slate-50">
        <div className="flex flex-wrap items-center gap-3">
          <label className="font-semibold">Filters:</label>
          <button 
            className={`px-3 py-1 rounded ${dateFilter === "all" ? "bg-blue-600 text-white" : "bg-white border"}`}
            onClick={() => setDateFilter("all")}
          >
            All
          </button>
          <button 
            className={`px-3 py-1 rounded ${dateFilter === "today" ? "bg-blue-600 text-white" : "bg-white border"}`}
            onClick={() => setDateFilter("today")}
          >
            Today
          </button>
          <button 
            className={`px-3 py-1 rounded ${dateFilter === "week" ? "bg-blue-600 text-white" : "bg-white border"}`}
            onClick={() => setDateFilter("week")}
          >
            This Week
          </button>
          <button 
            className={`px-3 py-1 rounded ${dateFilter === "month" ? "bg-blue-600 text-white" : "bg-white border"}`}
            onClick={() => setDateFilter("month")}
          >
            This Month
          </button>
          <button 
            className={`px-3 py-1 rounded ${dateFilter === "year" ? "bg-blue-600 text-white" : "bg-white border"}`}
            onClick={() => setDateFilter("year")}
          >
            This Year
          </button>
          <button 
            className={`px-3 py-1 rounded ${dateFilter === "custom" ? "bg-blue-600 text-white" : "bg-white border"}`}
            onClick={() => setDateFilter("custom")}
          >
            Custom Range
          </button>
          {dateFilter === "custom" && (
            <>
              <input 
                type="date" 
                value={customStartDate} 
                onChange={e => setCustomStartDate(e.target.value)}
                className="px-2 py-1 border rounded text-sm"
                placeholder="Start"
              />
              <span>to</span>
              <input 
                type="date" 
                value={customEndDate} 
                onChange={e => setCustomEndDate(e.target.value)}
                className="px-2 py-1 border rounded text-sm"
                placeholder="End"
              />
            </>
          )}
        </div>
      </div>

      {/* Truck Selector */}
      <div className="flex items-center gap-3">
        <label className="font-semibold">Truck:</label>
        <select 
          value={selectedTruck} 
          onChange={e => setSelectedTruck(e.target.value)}
          className="px-3 py-1.5 border rounded"
        >
          <option value="ALL">All Trucks</option>
          {availableTrucks.map(truck => (
            <option key={truck} value={truck}>{truck}</option>
          ))}
        </select>
        <span className="text-sm text-slate-600">
          Showing {filteredTickets.length} of {tickets.length} tickets
        </span>
      </div>

      {/* Overall Metrics */}
      <div className="rounded-lg border p-4">
        <h3 className="font-semibold mb-3">Overall Metrics {selectedTruck !== "ALL" && `(${selectedTruck})`}</h3>
        <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <div>
            <div className="text-xs text-slate-600">Tickets</div>
            <div className="text-lg font-semibold">{truckMetrics.tickets}</div>
          </div>
          <div>
            <div className="text-xs text-slate-600">Total Gallons</div>
            <div className="text-lg font-semibold">{truckMetrics.totalGallons.toFixed(1)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-600">Revenue</div>
            <div className="text-lg font-semibold">${truckMetrics.amount.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-600">Avg $/Gallon</div>
            <div className="text-lg font-semibold">${truckMetrics.avgPricePerGallon.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-600">Avg Miles/Ticket</div>
            <div className="text-lg font-semibold">{truckMetrics.avgMiles.toFixed(1)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-600">On-Time %</div>
            <div className="text-lg font-semibold">{truckMetrics.onTimePct.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* Per-Truck Breakdown (only show when viewing all trucks) */}
      {selectedTruck === "ALL" && perTruckData.length > 0 && (
        <div className="rounded-lg border p-4">
          <h3 className="font-semibold mb-3">Per-Truck Breakdown</h3>
          <div className="overflow-x-hidden max-w-full">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-3 py-2 text-xs">Truck</th>
                  <th className="px-3 py-2 text-xs">Tickets</th>
                  <th className="px-3 py-2 text-xs">Gallons</th>
                  <th className="px-3 py-2 text-xs">Revenue</th>
                  <th className="px-3 py-2 text-xs">Avg $/Gal</th>
                  <th className="px-3 py-2 text-xs">On-Time %</th>
                </tr>
              </thead>
              <tbody>
                {perTruckData.map(row => (
                  <tr key={row.truck} className="border-t">
                    <td className="px-3 py-2 font-medium">{row.truck}</td>
                    <td className="px-3 py-2 tabular-nums">{row.tickets}</td>
                    <td className="px-3 py-2 tabular-nums">{row.totalGallons.toFixed(1)}</td>
                    <td className="px-3 py-2 tabular-nums">${row.amount.toFixed(2)}</td>
                    <td className="px-3 py-2 tabular-nums">${row.avgPricePerGallon.toFixed(2)}</td>
                    <td className="px-3 py-2 tabular-nums">{row.onTimePct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sticky Toolbar above table */}
      <div style={{
        position: "sticky",
        top: "60px",
        zIndex: 10,
        backgroundColor: "#f8fafc",
        borderBottom: "1px solid #e2e8f0",
        padding: "12px 16px",
        marginLeft: "-24px",
        marginRight: "-24px",
        marginBottom: "16px"
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button 
              className="rounded-lg border px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700" 
              onClick={addBlank}
              style={{ fontWeight: 500 }}
            >
              + Add Ticket
            </button>
            <span className="text-sm text-slate-600">
              {filteredTickets.length} tickets on this page
            </span>
          </div>
          <div className="text-sm text-slate-600">
            Page {page} of {Math.max(1, Math.ceil(totalCount / pageSize))} • Total: {totalCount}
          </div>
        </div>
      </div>

      <div className="dt-table-wrap rounded-xl border" onBlurCapture={handleInputBlur}>
        <table className="dt-table w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="dt-th px-2 py-2 text-xs">Date</th>
              <th className="dt-th px-2 py-2 text-xs">Truck</th>
              <th className="dt-th px-2 py-2 text-xs hidden md:table-cell">Driver</th>
              <th className="dt-th px-2 py-2 text-xs hidden lg:table-cell">TicketID</th>
              <th className="dt-th px-2 py-2 text-xs">Customer</th>
              <th className="dt-th px-2 py-2 text-xs">Gallons</th>
              <th className="dt-th px-2 py-2 text-xs hidden 2xl:table-cell">Arrival</th>
              <th className="dt-th px-2 py-2 text-xs hidden 2xl:table-cell">Odo Start</th>
              <th className="dt-th px-2 py-2 text-xs hidden 2xl:table-cell">Odo End</th>
              <th className="dt-th px-2 py-2 text-xs hidden 2xl:table-cell">Miles</th>
              <th className="dt-th px-2 py-2 text-xs hidden xl:table-cell">On-Time</th>
              <th className="dt-th px-2 py-2 text-xs hidden md:table-cell">Account</th>
              <th className="dt-th px-2 py-2 text-xs">Qty</th>
              <th className="dt-th px-2 py-2 text-xs">Price</th>
              <th className="dt-th px-2 py-2 text-xs hidden md:table-cell">Tax</th>
              <th className="dt-th px-2 py-2 text-xs hidden md:table-cell">Hazmat</th>
              <th className="dt-th px-2 py-2 text-xs">Amount</th>
              <th className="dt-th px-2 py-2 text-xs hidden lg:table-cell">Status</th>
              <th className="dt-th px-2 py-2 text-xs hidden xl:table-cell">Files</th>
              <th className="dt-th px-2 py-2 text-xs"></th>
            </tr>
          </thead>
          <tbody>
            {filteredTickets.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="dt-td px-2 py-2 whitespace-nowrap"><input type="date" value={t.date || ""} onChange={e => update(t.id, "date", e.target.value)} className="input text-xs w-28" /></td>
                <td className="dt-td px-2 py-2"><input value={t.truck || ""} onChange={e => update(t.id, "truck", e.target.value)} className="input text-xs w-16" /></td>
                <td className="dt-td px-2 py-2 hidden md:table-cell"><input value={t.driver || ""} onChange={e => update(t.id, "driver", e.target.value)} className="input text-xs w-20" /></td>
                <td className="dt-td px-2 py-2 hidden lg:table-cell"><input value={t.ticket_id || ""} onChange={e => update(t.id, "ticket_id", e.target.value)} className="input text-xs w-20" placeholder="ID" /></td>
                <td className="dt-td px-2 py-2"><input value={t.customerName || ""} onChange={e => update(t.id, "customerName", e.target.value)} className="input text-xs w-24" /></td>
                <td className="dt-td px-2 py-2"><input value={t.gallons_delivered ?? ""} type="number" step="0.1" onChange={e => update(t.id, "gallons_delivered", e.target.value)} className="input text-xs w-16 tabular-nums" /></td>
                <td className="dt-td px-2 py-2 hidden 2xl:table-cell whitespace-nowrap"><input type="datetime-local" value={toLocalDateTimeInputValue(t.arrival_time)} onChange={e => update(t.id, "arrival_time", fromLocalDateTimeInputValue(e.target.value))} className="input text-xs w-36" /></td>
                <td className="dt-td px-2 py-2 hidden 2xl:table-cell"><input value={t.odometer_start ?? ""} type="number" step="0.1" onChange={e => update(t.id, "odometer_start", e.target.value)} className="input text-xs w-20 tabular-nums" placeholder="Start" /></td>
                <td className="dt-td px-2 py-2 hidden 2xl:table-cell"><input value={t.odometer_end ?? ""} type="number" step="0.1" onChange={e => update(t.id, "odometer_end", e.target.value)} className="input text-xs w-20 tabular-nums" placeholder="End" /></td>
                <td className="dt-td px-2 py-2 hidden 2xl:table-cell"><span className="text-xs font-mono tabular-nums">{t.miles_driven != null ? Number(t.miles_driven).toFixed(1) : "-"}</span></td>
                <td className="dt-td px-2 py-2 text-center hidden xl:table-cell">
                  {t.on_time_flag === 1 && <span title="On Time">✅</span>}
                  {t.on_time_flag === 0 && <span title="Late">⏱️</span>}
                  {t.on_time_flag == null && <span className="text-slate-400">-</span>}
                </td>
                <td className="dt-td px-2 py-2 hidden md:table-cell"><input value={t.account || ""} onChange={e => update(t.id, "account", e.target.value)} className="input text-xs w-20" /></td>
                <td className="dt-td px-2 py-2"><input value={t.qty ?? ""} type="number" step="1" onChange={e => update(t.id, "qty", e.target.value)} className="input text-xs w-14 tabular-nums" /></td>
                <td className="dt-td px-2 py-2"><input value={t.price ?? ""} type="number" step="0.01" onChange={e => update(t.id, "price", e.target.value)} className="input text-xs w-16 tabular-nums" /></td>
                <td className="dt-td px-2 py-2 hidden md:table-cell"><input value={t.tax ?? ""} type="number" step="0.01" onChange={e => update(t.id, "tax", e.target.value)} className="input text-xs w-14 tabular-nums" /></td>
                <td className="dt-td px-2 py-2 hidden md:table-cell"><input value={t.hazmat_fee ?? ""} type="number" step="0.01" onChange={e => update(t.id, "hazmat_fee", e.target.value)} className="input text-xs w-14 tabular-nums" /></td>
                <td className="dt-td px-2 py-2 whitespace-nowrap"><span className="text-xs font-mono tabular-nums">${(t.amount || 0).toFixed(2)}</span></td>
                <td className="dt-td px-2 py-2 hidden lg:table-cell">
                  <select value={t.status || "draft"} onChange={e => update(t.id, "status", e.target.value)} className="text-xs w-20">
                    <option value="draft">draft</option>
                    <option value="posted">posted</option>
                  </select>
                </td>
                <td className="dt-td px-2 py-2 hidden xl:table-cell">
                  <div className="flex items-center gap-1">
                    <button className="rounded border px-1 py-0.5 text-xs whitespace-nowrap" onClick={() => startAttach(t.id)}>📎</button>
                    {(attachmentsMap[t.id] || []).length > 0 && (
                      <span className="text-xs text-slate-500">({(attachmentsMap[t.id] || []).length})</span>
                    )}
                  </div>
                </td>
                <td className="dt-td px-2 py-2">
                  <button className="text-red-600 text-xs" onClick={() => remove(t.id)} title="Remove">✕</button>
                </td>
              </tr>
            ))}
            {!filteredTickets.length && (
              <tr><td colSpan={20} className="dt-td px-3 py-6 text-center text-slate-500">No tickets match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between rounded-lg border p-4 bg-slate-50">
        <div className="text-sm text-slate-600">
          Showing {tickets.length > 0 ? (page - 1) * pageSize + 1 : 0} - {Math.min(page * pageSize, totalCount)} of {totalCount} tickets
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded border disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <span className="text-sm font-medium">
            Page {page} of {Math.max(1, Math.ceil(totalCount / pageSize))}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page * pageSize >= totalCount}
            className="px-3 py-1.5 rounded border disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next →
          </button>
          <button 
            className="rounded-lg border px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 ml-2" 
            onClick={addBlank}
            style={{ fontWeight: 500 }}
          >
            + Add Ticket
          </button>
        </div>
      </div>

      {/* Analytics Charts */}
      {chartData.length > 0 && (
        <div className="dt-analytics rounded-lg border p-4">
          <h3 className="font-semibold mb-4">Analytics {selectedTruck !== "ALL" && `(${selectedTruck})`}</h3>
          
          <div className="space-y-8">
            {/* Gallons by Day */}
            <div>
              <h4 className="text-sm font-medium mb-2 text-slate-700">Gallons Delivered by Day</h4>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="gallons" stroke="#3b82f6" strokeWidth={2} name="Gallons" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            {/* Revenue by Day */}
            <div>
              <h4 className="text-sm font-medium mb-2 text-slate-700">Revenue by Day</h4>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue ($)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button className="rounded-lg border px-3 py-1.5" onClick={validate}>Run Edit Listing (Preview)</button>
        <button className="rounded-lg border px-3 py-1.5" onClick={postBatch} disabled={batchStatus === "posted"}>Transfer / Post</button>
        <button className="rounded-lg border px-3 py-1.5" onClick={exportPPS} disabled={batchStatus !== "posted"}>Export to Trucks (PPS)</button>
        <button className="rounded-lg border px-3 py-1.5 bg-blue-50" onClick={exportCSV}>Export CSV</button>
        <button className="rounded-lg border px-3 py-1.5 bg-green-50" onClick={exportExcel}>Export Excel</button>
      </div>

      <input ref={attachRef} type="file" accept="*" className="hidden" onChange={onAttachInput} />
    </div>
  );
}
