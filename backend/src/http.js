let calls = 0;
export const apiCalls = () => calls;

export async function getJson(url, headers = {}, { retries = 2 } = {}) {
  for (let attempt = 0; ; attempt++) {
    calls++;
    const res = await fetch(url, { headers });
    if (res.ok) return { json: await res.json(), headers: res.headers };
    if (attempt < retries && (res.status === 429 || res.status >= 500)) { await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); continue; }
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} for ${url.split('?')[0]}: ${body.slice(0, 200)}`);
  }
}
