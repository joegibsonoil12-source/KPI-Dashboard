// src/lib/api.js
export function getApiBase() {
  const runtime = (typeof window !== 'undefined' && window.__ENV) ? window.__ENV : {};
  // Try a few common env names
  const candidates = [
    runtime.API_BASE,
    runtime.NEXT_PUBLIC_API_BASE,
    runtime.VITE_API_BASE,
    process.env.API_BASE,
    process.env.NEXT_PUBLIC_API_BASE,
    process.env.VITE_API_BASE
  ];
  const base = (candidates.find(Boolean) || '').replace(/\/$/, '');
  return base;
}

export async function postFn(path, body, opts = {}) {
  const base = getApiBase();
  const url = path.match(/^https?:\/\//) ? path : `${base}/${path.replace(/^\/+/, '')}`;
  const fetchOpts = {
    method: opts.method || 'POST',
    ...opts,
    body,
  };

  const res = await fetch(url, fetchOpts);
  // Read as text first for robust diagnostics
  const text = await res.text();
  const ct = (res.headers.get('content-type') || '').toLowerCase();

  if (!res.ok) {
    const preview = text ? text.slice(0, 1000) : '';
    // Throw a helpful error that includes a preview of the non-JSON body (often HTML)
    throw new Error(`API error ${res.status} ${res.statusText} from ${url}: ${preview}`);
  }

  if (ct.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 1000)}`);
    }
  }

  // If we expected JSON but got HTML (common when github pages serves an error page)
  throw new Error(`Expected JSON from ${url} but got content-type: ${ct} — preview: ${text.slice(0, 1000)}`);
}
