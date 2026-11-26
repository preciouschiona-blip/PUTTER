// Minimal Supabase REST client (service role key, server side only).
const URL_ = () => process.env.SUPABASE_URL?.replace(/\/$/, '');
const KEY = () => process.env.SUPABASE_SERVICE_KEY;

async function rest(path, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${URL_()}/rest/v1/${path}`, {
    method,
    headers: { apikey: KEY(), Authorization: `Bearer ${KEY()}`, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = `Supabase ${method} ${path.split('?')[0]} -> ${res.status} ${(await res.text()).slice(0, 300)}`;
    console.error(`::error title=Database request failed::${msg}`);
    throw new Error(msg);
  }
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

export const dbReady = () => !!(URL_() && KEY());
export const select = (table, query = '') => rest(`${table}?${query}`);
export const upsert = (table, rows, onConflict) => rows.length ? rest(`${table}${onConflict ? `?on_conflict=${onConflict}` : ''}`, { method: 'POST', body: rows, prefer: 'resolution=merge-duplicates,return=minimal' }) : null;
export const insertIgnore = (table, rows, onConflict) => rows.length ? rest(`${table}?on_conflict=${onConflict}`, { method: 'POST', body: rows, prefer: 'resolution=ignore-duplicates,return=representation' }) : [];
export const patch = (table, query, body) => rest(`${table}?${query}`, { method: 'PATCH', body, prefer: 'return=minimal' });
export const insertRun = rows => rest('runs', { method: 'POST', body: rows, prefer: 'return=representation' });
export const patchRun = (id, body) => patch('runs', `id=eq.${id}`, body);
