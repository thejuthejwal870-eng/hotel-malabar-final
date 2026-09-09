import fs from 'fs';
import path from 'path';

const DATA_DIR = '/tmp';
const DATA_FILE = path.join(DATA_DIR, 'hotel_malabar.json');

function endpoint() {
  const url = process.env.SUPABASE_URL;
  return url ? `${url.replace(/\/$/, '')}/rest/v1/hotel_malabar_data` : null;
}

function authHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return key
    ? {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      }
    : null;
}

function isUsableDatabase(data: any): boolean {
  return !!data &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    Array.isArray(data.users) &&
    Array.isArray(data.orders);
}

export async function syncFromSupabase(): Promise<boolean> {
  const url = endpoint();
  const headers = authHeaders();

  if (!url || !headers) {
    console.error('Supabase read skipped: configuration missing.');
    return false;
  }

  try {
    const response = await fetch(`${url}?id=eq.1&select=data`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      console.error(
        'Supabase read failed:',
        response.status,
        await response.text()
      );
      return false;
    }

    const rows = (await response.json()) as Array<{ data?: any }>;
    const remoteData = rows?.[0]?.data;

    if (!isUsableDatabase(remoteData)) {
      console.error('Supabase database row is empty or invalid.');
      return false;
    }

    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(remoteData, null, 2),
      'utf8'
    );

    console.log('Hotel Malabar database loaded from Supabase.');
    return true;
  } catch (error) {
    console.error('Supabase read error:', error);
    return false;
  }
}

export async function syncToSupabase(): Promise<boolean> {
  const url = endpoint();
  const headers = authHeaders();

  if (!url || !headers || !fs.existsSync(DATA_FILE)) {
    console.error(
      'Supabase write skipped: configuration or database file missing.'
    );
    return false;
  }

  try {
    const data = JSON.parse(
      fs.readFileSync(DATA_FILE, 'utf8')
    );

    if (!isUsableDatabase(data)) {
      console.error('Supabase write skipped: invalid database.');
      return false;
    }

    const body = JSON.stringify({
      id: 1,
      data,
      updated_at: new Date().toISOString(),
    });

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            ...headers,
            Prefer: 'resolution=merge-duplicates,return=minimal',
          },
          body,
        });

        if (response.ok) {
          console.log('Hotel Malabar database saved to Supabase.');
          return true;
        }

        console.error(
          `Supabase write failed (attempt ${attempt}):`,
          response.status,
          await response.text()
        );
      } catch (error) {
        console.error(
          `Supabase write error (attempt ${attempt}):`,
          error
        );
      }

      if (attempt < 3) {
        await new Promise(resolve =>
          setTimeout(resolve, 400 * attempt)
        );
      }
    }

    return false;
  } catch (error) {
    console.error('Supabase write error:', error);
    return false;
  }
}
