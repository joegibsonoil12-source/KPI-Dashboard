import React, { useMemo, useRef, useState } from "react";

function fmt(n) { return n?.toLocaleString(undefined,{ style:"currency", currency:"USD" }) ?? "—"; }
function sum(arr, key) { return arr.reduce((a,b)=>a+(+b[key]||0),0); }

export default function DeliveryTickets() {
  const [tickets, setTickets] = useState([]);
  const [batchStatus, setBatchStatus] = useState("open"); // open | posted
  const [errors, setErrors] = useState([]);
  const fileRef = useRef(null);

  const control = useMemo(() => ({
    qty: sum(tickets,"qty"),
    amount: sum(tickets,"amount"),
  }), [tickets]);

  function addBlank() {
    setTickets(t => [...t, {
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0,10),
      driver:"", truck:"", customerName:"", account:"",
      qty: 0, price: 0, tax: 0, amount: 0, status: "draft", notes:""
    }]);
  }

  function update(id, key, val) {
    setTickets(ts => ts.map(t => t.id===id ? {
      ...t,
      [key]: key==="qty"||key==="price"||key==="tax"||key==="amount" ? Number(val||0) : val
    } : t));
  }

  function remove(id) { setTickets(ts => ts.filter(t => t.id !== id)); }

  async function importCSV(file) {
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
        id: crypto.randomUUID(),
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
        notes: ""
      };
    });
    setTickets(t => [...t, ...rows]);
  }

  function validate() {
    const es = [];
    tickets.forEach((t,i) => {
      if (!t.customerName) es.push({i,msg:"Missing customer"});
      if (!t.account) es.push({i,msg:"Missing account"});
      if (t.qty<=0) es.push({i,msg:"Qty must be > 0"});
      if (t.price<0) es.push({i,msg:"Price must be >= 0"});
    });
    setErrors(es);
    if (es.length===0) alert("No exceptions. Ready to transfer.");
  }

  function postBatch() {
    if (errors.length) return alert("Resolve exceptions first.");
    if (!tickets.length) return alert("Nothing to post.");
    setBatchStatus("posted");
    setTickets(ts => ts.map(t => ({ ...t, status:"posted" })));
    alert("Batch posted (Transfer to Posting File).");
  }

  function exportPPS() {
    // basic CSV “truck interface” export (driver,truck,customer,qty,amount)
    const csv = [
      "date,driver,truck,customer,qty,amount",
      ...tickets.filter(t=>t.status==="posted").map(t =>
        [t.date,t.driver,t.truck,t.customerName,t.qty,t.amount].join(","))
    ].join("\n");
    const blob = new Blob([csv],{type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "pps-truck-export.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Delivery Tickets</h2>
        <div className="flex items-center gap-2">
          <button className="rounded-lg border px-3 py-1.5" onClick={addBlank}>Add ticket</button>
          <button className="rounded-lg border px-3 py-1.5" onClick={()=>fileRef.current?.click()}>Import CSV</button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
                 onChange={(e)=>e.target.files?.[0] && importCSV(e.target.files[0])}/>
        </div>
      </header>

      {/* KPIs & Control totals */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card title="Tickets in batch" value={tickets.length}/>
        <Card title="Control Qty" value={control.qty}/>
        <Card title="Control Amount" value={fmt(control.amount)}/>
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              {["Date","Driver","Truck","Customer","Account","Qty","Price","Tax","Amount","Status",""]
               .map(h=>(<th key={h} className="px-3 py-2">{h}</th>))}
            </tr>
          </thead>
          <tbody>
            {tickets.map((t)=>(
              <tr key={t.id} className="border-t">
                <Td><input type="date" value={t.date} onChange={e=>update(t.id,"date",e.target.value)} className="input"/></Td>
                <Td><input value={t.driver} onChange={e=>update(t.id,"driver",e.target.value)} className="input"/></Td>
                <Td><input value={t.truck} onChange={e=>update(t.id,"truck",e.target.value)} className="input"/></Td>
                <Td><input value={t.customerName} onChange={e=>update(t.id,"customerName",e.target.value)} className="input"/></Td>
                <Td><input value={t.account} onChange={e=>update(t.id,"account",e.target.value)} className="input"/></Td>
                <Td><input type="number" step="0.01" value={t.qty} onChange={e=>update(t.id,"qty",e.target.value)} className="input w-24"/></Td>
                <Td><input type="number" step="0.01" value={t.price} onChange={e=>update(t.id,"price",e.target.value)} className="input w-24"/></Td>
                <Td><input type="number" step="0.01" value={t.tax} onChange={e=>update(t.id,"tax",e.target.value)} className="input w-24"/></Td>
                <Td><input type="number" step="0.01" value={t.amount} onChange={e=>update(t.id,"amount",e.target.value)} className="input w-28"/></Td>
                <Td>{t.status}</Td>
                <Td><button className="text-red-600" onClick={()=>remove(t.id)}>Remove</button></Td>
              </tr>
            ))}
            {!tickets.length && (
              <tr><td colSpan={11} className="px-3 py-6 text-center text-slate-500">No tickets yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Actions row mirrors Suburban: Edit Listing → Exceptions → Transfer → Export */}
      <div className="flex flex-wrap items-center gap-2">
        <button className="rounded-lg border px-3 py-1.5" onClick={validate}>Run Edit Listing (Preview)</button>
        <button className="rounded-lg border px-3 py-1.5" onClick={postBatch} disabled={batchStatus==="posted"}>Transfer / Post</button>
        <button className="rounded-lg border px-3 py-1.5" onClick={exportPPS} disabled={batchStatus!=="posted"}>Export to Trucks (PPS)</button>
        <span className="text-xs text-slate-500">Batch: {batchStatus}</span>
      </div>

      {/* Exceptions */}
      {!!errors.length && (
        <div className="rounded-xl border bg-amber-50 p-3 text-sm">
          <div className="font-semibold mb-1">Exceptions</div>
          <ul className="list-disc pl-5">
            {errors.map((e,idx)=>(
              <li key={idx}>Row {e.i+1}: {e.msg}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Card({title, value}) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-xs text-slate-500">{title}</div>
      <div className="text-lg font-semibold">{typeof value==='number' ? value : value}</div>
    </div>
  );
}
function Td({children}) { return <td className="px-3 py-2 align-top">{children}</td>; }
