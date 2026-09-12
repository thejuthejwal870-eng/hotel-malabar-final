const fs = require('fs');

const DATA_FILE = '/tmp/hotel_malabar.json';

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return {
    url: `${url.replace(/\/$/, '')}/rest/v1/hotel_malabar_data`,
    headers: { apikey: key, 'Content-Type': 'application/json' },
  };
}

function validDatabase(data) {
  return !!data && typeof data === 'object' && !Array.isArray(data)
    && Array.isArray(data.users) && Array.isArray(data.orders);
}

async function syncFromSupabase() {
  const cfg = supabaseConfig();
  if (!cfg) return false;
  try {
    const response = await fetch(`${cfg.url}?id=eq.1&select=data`, {
      method: 'GET', headers: cfg.headers,
    });
    if (!response.ok) return false;
    const rows = await response.json();
    const data = rows?.[0]?.data;
    if (!validDatabase(data)) return false;
    fs.mkdirSync('/tmp', { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log('Hotel Malabar database loaded from Supabase.');
    return true;
  } catch (error) {
    console.error('Supabase startup read failed:', error.message);
    return false;
  }
}

async function syncToSupabase() {
  const cfg = supabaseConfig();
  if (!cfg || !fs.existsSync(DATA_FILE)) return false;
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!validDatabase(data)) return false;
    const body = JSON.stringify({ id: 1, data, updated_at: new Date().toISOString() });
    const response = await fetch(`${cfg.url}?id=eq.1`, {
      method: 'PATCH', headers: cfg.headers, body,
    });
    if (response.ok) {
      console.log('Hotel Malabar database updated in Supabase.');
      return true;
    }
    const insert = await fetch(cfg.url, {
      method: 'POST',
      headers: { ...cfg.headers, Prefer: 'return=minimal' },
      body,
    });
    return insert.ok;
  } catch (error) {
    console.error('Supabase write failed:', error.message);
    return false;
  }
}

(async () => {
  await syncFromSupabase();

  // db.ts writes atomically with renameSync(tmp, /tmp/hotel_malabar.json).
  // Hook that final rename so every admin/customer change is persisted to Supabase.
  const originalRenameSync = fs.renameSync;
  fs.renameSync = function (oldPath, newPath) {
    const result = originalRenameSync.call(fs, oldPath, newPath);
    if (newPath === DATA_FILE) {
      setTimeout(() => { void syncToSupabase(); }, 0);
    }
    return result;
  };

  require('../dist/server.cjs');
})();
