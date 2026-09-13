const fs = require('fs');

const file = 'server/gemini.ts';
let source = fs.readFileSync(file, 'utf8');

const marker = 'export async function extractMenuItemsFromPhotos(';
if (!source.includes(marker)) {
  throw new Error('Gemini resilience fix could not find extractMenuItemsFromPhotos in server/gemini.ts');
}

source = source.replace(/async function generateMenuContentWithFallback\([\s\S]*?\n}\n\n(?=export async function extractMenuItemsFromPhotos)/m, '');

const helper = `async function generateMenuContentWithFallback(ai: GoogleGenAI, request: any) {
  // Use fast/low-thinking Gemini 3 Flash models for OCR, with automatic
  // fallback when a model is temporarily unavailable or rate-limited.
  const models = [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
  ];

  let lastError: any = null;

  for (const model of models) {
    try {
      const requestPromise = ai.models.generateContent({
        ...request,
        model,
        config: {
          ...(request.config || {}),
          thinkingConfig: {
            thinkingLevel: 'low',
          },
        },
      });

      const response = await Promise.race([
        requestPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(\`Gemini request timed out for model \${model}.\`)), 30000)
        ),
      ]);

      return response;
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
        message.includes('rate limit') ||
        message.includes('timed out');

      if (!transient) {
        throw err;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error(
    lastError?.message ||
      'Gemini is temporarily unavailable. Please try the menu import again.'
  );
}

`;

source = source.replace(marker, helper + marker);

const directCall = 'const response = await ai.models.generateContent({';
if (!source.includes(directCall)) {
  throw new Error('Gemini extraction generateContent call was not found.');
}
source = source.replace(
  directCall,
  'const response = await generateMenuContentWithFallback(ai, {'
);

fs.writeFileSync(file, source, 'utf8');
console.log('Gemini OCR low-thinking mode, bounded timeout, and stable Flash fallbacks enabled.');
