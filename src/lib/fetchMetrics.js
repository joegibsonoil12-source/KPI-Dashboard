// src/lib/fetchMetrics.js
// Generalized Service + Delivery aggregator using Supabase on the client.

function toISO(d) {
  return d.toISOString();
}

async function sumDelivery({ supabase, from, to }) {
  const { data, error } = await supabase
    .from("delivery_tickets")
    .select("gallons,total_amount,delivery_date")
    .gte("delivery_date", from)
    .lte("delivery_date", to);
  if (error) throw error;
  return (data || []).reduce(
    (acc, r) => {
      acc.gallons += Number(r.gallons || 0);
      acc.revenue += Number(r.total_amount || 0);
      acc.count += 1;
      return acc;
    },
    { gallons: 0, revenue: 0, count: 0 }
  );
}

async function sumService({ supabase, from, to }) {
  try {
    const { data, error } = await supabase
      .from("service_tickets")
      .select("total,date")
      .gte("date", from)
      .lte("date", to);
    if (error) throw error;
    return (data || []).reduce(
      (acc, r) => {
        acc.revenue += Number(r.total || 0);
        acc.count += 1;
        return acc;
      },
      { revenue: 0, count: 0 }
    );
  } catch {
    // If table isn't present in a given env, just return zeros.
    return { revenue: 0, count: 0 };
  }
}

function withDelta(current, previous, keys) {
  const deltas = {};
  for (const k of keys) {
    const cur = Number(current[k] || 0);
    const prev = Number(previous?.[k] || 0);
    const diff = cur - prev;
    const pct = prev === 0 ? null : (diff / prev) * 100;
    deltas[k] = { value: cur, previous: prev, diff, pct };
  }
  return deltas;
}

export async function fetchMetrics({
  supabase,
  currentStart,
  currentEnd,
  previousStart,
  previousEnd,
}) {
  const from = toISO(currentStart);
  const to = toISO(currentEnd);

  const [dCur, sCur] = await Promise.all([
    sumDelivery({ supabase, from, to }),
    sumService({ supabase, from, to }),
  ]);

  let prev = null;
  if (previousStart && previousEnd) {
    const pFrom = toISO(previousStart);
    const pTo = toISO(previousEnd);
    const [dPrev, sPrev] = await Promise.all([
      sumDelivery({ supabase, from: pFrom, to: pTo }),
      sumService({ supabase, from: pFrom, to: pTo }),
    ]);
    prev = { delivery: dPrev, service: sPrev };
  }

  return {
    range: { from, to },
    delivery: dCur,
    service: sCur,
    compare: prev
      ? {
          delivery: withDelta(dCur, prev.delivery, ["gallons", "revenue", "count"]),
          service: withDelta(sCur, prev.service, ["revenue", "count"]),
        }
      : null,
  };
}
