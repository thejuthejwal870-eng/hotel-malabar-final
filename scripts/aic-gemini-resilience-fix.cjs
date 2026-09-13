const fs = require('fs');

const file = 'server/gemini.ts';
let source = fs.readFileSync(file, 'utf8');

const marker = 'export async function extractMenuItemsFromPhotos(';
if (!source.includes(marker)) {
  throw new Error('Gemini resilience fix could not find extractMenuItemsFromPhotos in server/gemini.ts');
}

// Always replace the generated helper so deployments get the latest timeout
// and fallback behavior. This keeps AI Menu Card extraction from spinning
// indefinitely when a Gemini request is slow or temporarily unavailable.
const helper = `async function generateMenuContentWithFallback(ai: GoogleGenAI, request: any) {
  // Try a small set of stable Flash models. Each individual request has a
  // hard timeout so the browser never waits indefinitely.
  const models = [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
  ];

  let lastError: any = null;

  for (const model of models) {
    try {
      const requestPromise = ai.models.generateContent({
        ...request,
        model,
      });

      const response = await Promise.race([
        requestPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(\`Gemini request timed out for model \${model}.\`)), 40000)
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

      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }

  throw new Error(
    lastError?.message ||
      'Gemini is temporarily unavailable. Please try the menu import again.'
  );
}

`;

// Remove any previous generated helper before inserting the current one.
source = source.replace(/async function generateMenuContentWithFallback\([\s\S]*?\n}\n\n(?=export async function extractMenuItemsFromPhotos)/m, '');
source = source.replace(marker, helper + marker);

// Route all extraction calls through the bounded helper.
source = source.replace(
  /const response = await (?:generateMenuContentWithFallback\(ai, \{[\s\S]*?\}\)|ai\.models\.generateContent\(\{[\s\S]*?\}\));/m,
  'const response = await generateMenuContentWithFallback(ai, {\n    contents: [\n      ...imageParts,\n      { text: promptText },\n    ],\n    config: {\n      responseMimeType: \'application/json\',\n      responseSchema: {\n        type: Type.ARRAY,\n        description: \'List of extracted food and drink items from the menu card photos\',\n        items: {\n          type: Type.OBJECT,\n          properties: {\n            name: { type: Type.STRING, description: \'The exact food or beverage item name\' },\n            categoryId: { type: Type.STRING, description: \'The category ID from the provided list\' },\n            price: { type: Type.NUMBER, description: \'Numeric price if readable, otherwise 0 or null\' },\n            isVeg: { type: Type.BOOLEAN, description: \'True if vegetarian, false if non-vegetarian\' },\n            description: { type: Type.STRING, description: \'Short 1-sentence description or empty string\' },\n          },\n          required: [\'name\', \'categoryId\', \'isVeg\'],\n        },\n      },\n    },\n  });'
);

fs.writeFileSync(file, source, 'utf8');
console.log('Gemini OCR bounded timeout and 3-model fallback enabled.');
