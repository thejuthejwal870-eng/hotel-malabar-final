const fs = require('fs');

const file = 'server/gemini.ts';
let source = fs.readFileSync(file, 'utf8');

if (source.includes('generateMenuContentWithFallback')) {
  console.log('Gemini resilience fix already present.');
  process.exit(0);
}

const marker = 'export async function extractMenuItemsFromPhotos(';
if (!source.includes(marker)) {
  throw new Error('Gemini resilience fix could not find extractMenuItemsFromPhotos in server/gemini.ts');
}

const helper = `async function generateMenuContentWithFallback(ai: GoogleGenAI, request: any) {
  // Prefer the newest stable model, then fall back automatically when Google
  // temporarily returns 503/UNAVAILABLE or 429/rate-limit responses.
  const models = [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
  ];

  let lastError: any = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await ai.models.generateContent({
          ...request,
          model,
        });
      } catch (err: any) {
        lastError = err;
        const status = Number(err?.status || err?.code || err?.error?.code || 0);
        const message = String(err?.message || err?.error?.message || '').toLowerCase();
        const transient =
          status === 429 ||
          status === 500 ||
          status === 502 ||
          status === 503 ||
          message.includes('unavailable') ||
          message.includes('high demand') ||
          message.includes('temporarily') ||
          message.includes('rate limit');

        if (!transient) {
          throw err;
        }

        // Small exponential backoff before retrying the same model.
        await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
      }
    }
  }

  throw new Error(
    lastError?.message ||
      'Gemini is temporarily busy. The menu import will automatically retry other Gemini models. Please try again in a minute.'
  );
}

`;

source = source.replace(marker, helper + marker);
source = source.replace(
  'const response = await ai.models.generateContent({',
  'const response = await generateMenuContentWithFallback(ai, {'
);

fs.writeFileSync(file, source, 'utf8');
console.log('Gemini OCR resilience/fallback models added.');
