import React, { useEffect, useMemo, useRef, useState } from "react";
import supabase from "../lib/supabaseClient";
import {
  fetchTickets,
  insertTicket,
  updateTicket,
  deleteTicket,
  uploadAttachmentFile,
  insertAttachmentMetadata,
  createSignedUrl,
  listAttachmentsForTicket,
} from "../lib/supabaseHelpers";

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

  const control = useMemo(() => ({
    qty: tickets.reduce((s, t) => s + (Number(t.qty) || 0), 0),
    amount: tickets.reduce((s, t) => s + (Number(t.amount) || 0), 0),
  }), [tickets]);

  async function currentUserId() {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const rows = await fetchTickets();
        if (!mounted) return;
        setTickets(rows);
        // load attachments for visible rows (small optimization)
        const map = {};
        await Promise.all(rows.slice(0, 30).map(async (r) => {
          const a = await listAttachmentsForTicket(r.id);
          map[r.id] = a;
        }));
        if (!mounted) return;
        setAttachmentsMap(map);
      } catch (e) {
        console.error("Failed to load tickets:", e);
        alert("Failed to load tickets. See console.");
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  async function addBlank() {
    const userId = await currentUserId();
    const newRow = {
      date: new Date().toISOString().slice(0, 10),
      driver: "", truck: "", customerName: "", account: "",
      qty: 0, price: 0, tax: 0, amount: 0, status: "draft", notes: "",
      created_by: userId,
    };
    try {
      const created = await insertTicket(newRow);
      setTickets(t => [created, ...t]);
    } catch (e) {
      console.error(e);
      alert("Failed to add ticket.");
    }
  }

  async function update(id, key, val) {
    const numericKeys = ["qty", "price", "tax", "amount"];
    const nextVal = numericKeys.includes(key) ? Number(val || 0) : val;
    setTickets(ts => ts.map(t => t.id === id ? { ...t, [key]: nextVal } : t));
    try {
      await updateTicket(id, { [key]: nextVal });
    } catch (e) {
      console.error("Update failed:", e);
      alert("Update failed, reloading list.");
      const fresh = await fetchTickets();
      setTickets(fresh);
    }
  }

  async function remove(id) {
    if (!confirm("Delete this ticket?")) return;
    try {
      await deleteTicket(id);
      setTickets(ts => ts.filter(t => t.id !== id));
      setAttachmentsMap(m => { const copy = { ...m }; delete copy[id]; return copy; });
    } catch (e) {
      console.error(e);
      alert("Delete failed.");
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

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Delivery Tickets</h2>
        <div className="flex items-center gap-2">
          <button className="rounded-lg border px-3 py-1.5" onClick={addBlank}>Add ticket</button>
          <button className="rounded-lg border px-3 py-1.5" onClick={() => csvRef.current?.click()}>Import CSV</button>
          <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleImportInput} />
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>Tickets in batch: {tickets.length}</div>
        <div>Control Qty: {control.qty}</div>
        <div>Control Amount: {control.amount}</div>
      </div>

      <div className="overflow-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              {["Date","Driver","Truck","Customer","Account","Qty","Price","Tax","Amount","Status","Files",""].map(h => (<th key={h} className="px-3 py-2">{h}</th>))}
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="px-3 py-2"><input type="date" value={t.date || ""} onChange={e => update(t.id, "date", e.target.value)} className="input" /></td>
                <td className="px-3 py-2"><input value={t.driver || ""} onChange={e => update(t.id, "driver", e.target.value)} className="input" /></td>
                <td className="px-3 py-2"><input value={t.truck || ""} onChange={e => update(t.id, "truck", e.target.value)} className="input" /></td>
                <td className="px-3 py-2"><input value={t.customerName || ""} onChange={e => update(t.id, "customerName", e.target.value)} className="input" /></td>
                <td className="px-3 py-2"><input value={t.account || ""} onChange={e => update(t.id, "account", e.target.value)} className="input" /></td>
                <td className="px-3 py-2"><input value={t.qty || 0} type="number" onChange={e => update(t.id, "qty", e.target.value)} className="input" /></td>
                <td className="px-3 py-2"><input value={t.price || 0} type="number" onChange={e => update(t.id, "price", e.target.value)} className="input" /></td>
                <td className="px-3 py-2"><input value={t.tax || 0} type="number" onChange={e => update(t.id, "tax", e.target.value)} className="input" /></td>
                <td className="px-3 py-2"><input value={t.amount || 0} type="number" onChange={e => update(t.id, "amount", e.target.value)} className="input" /></td>
                <td className="px-3 py-2">
                  <select value={t.status || "draft"} onChange={e => update(t.id, "status", e.target.value)}>
                    <option value="draft">draft</option>
                    <option value="posted">posted</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button className="rounded-lg border px-2 py-1" onClick={() => startAttach(t.id)}>Upload</button>
                    <div>
                      {(attachmentsMap[t.id] || []).slice(0,3).map(a => (
                        <div key={a.id} style={{ display: "inline-block", marginRight: 6 }}>
                          <button onClick={() => openAttachment(a.storage_key)} className="text-sky-600">{a.filename}</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <button className="text-red-600" onClick={() => remove(t.id)}>Remove</button>
                </td>
              </tr>
            ))}
            {!tickets.length && (
              <tr><td colSpan={11} className="px-3 py-6 text-center text-slate-500">No tickets yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className="rounded-lg border px-3 py-1.5" onClick={validate}>Run Edit Listing (Preview)</button>
        <button className="rounded-lg border px-3 py-1.5" onClick={postBatch} disabled={batchStatus === "posted"}>Transfer / Post</button>
        <button className="rounded-lg border px-3 py-1.5" onClick={exportPPS} disabled={batchStatus !== "posted"}>Export to Trucks (PPS)</button>
      </div>

      <input ref={attachRef} type="file" accept="*" className="hidden" onChange={onAttachInput} />
    </div>
  );
}
