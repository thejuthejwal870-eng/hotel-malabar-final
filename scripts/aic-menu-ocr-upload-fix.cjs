const fs = require('fs');

// The AI Menu Card modal previously sent all selected photos in one large
// request. Ten menu photos can exceed the hosting/proxy body limit or make the
// browser report only "Failed to fetch". Send small batches instead, then merge
// the extracted items before showing the preview.
const componentFile = 'src/components/MenuCardImportModal.tsx';
let component = fs.readFileSync(componentFile, 'utf8');

const startMarker = '      // 2. Call server endpoint';
const endMarker = '      // 3. Map extracted items to draft state';
const start = component.indexOf(startMarker);
const end = component.indexOf(endMarker, start);

if (start === -1 || end === -1) {
  throw new Error('Could not locate AI menu extraction request block in MenuCardImportModal.tsx');
}

const replacement = `      // 2. Call server endpoint in small batches so multiple menu photos
      // never create one oversized HTTP request.
      const token =
        adminToken ||
        (typeof window !== 'undefined' ? localStorage.getItem('hm_admin_token') : null);

      const allExtractedItems: any[] = [];
      const BATCH_SIZE = 2;

      for (let batchStart = 0; batchStart < preparedImages.length; batchStart += BATCH_SIZE) {
        const imageBatch = preparedImages.slice(batchStart, batchStart + BATCH_SIZE);

        const res = await fetch('/api/admin/menu/extract-photos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: \`Bearer \${token}\`,
          },
          body: JSON.stringify({ images: imageBatch }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || \`AI extraction failed for photo batch \${Math.floor(batchStart / BATCH_SIZE) + 1}.\`);
        }

        if (Array.isArray(data.items)) {
          allExtractedItems.push(...data.items);
        }
      }

      const data = { items: allExtractedItems };

`;

component = component.slice(0, start) + replacement + component.slice(end);
fs.writeFileSync(componentFile, component, 'utf8');
console.log('AIC menu OCR upload batching enabled (2 photos per request) with admin token preserved.');

// Keep Gemini 3.8 Flash as the primary production model. The resilience
// helper already provides automatic fallback to other stable Gemini 3 models.
const geminiFixFile = 'scripts/aic-menu-extract-fix.cjs';
let geminiFix = fs.readFileSync(geminiFixFile, 'utf8');
geminiFix = geminiFix.replace(/gemini-2\.5-flash/g, 'gemini-3.8-flash');
fs.writeFileSync(geminiFixFile, geminiFix, 'utf8');
console.log('AIC menu OCR primary model restored to gemini-3.8-flash.');
