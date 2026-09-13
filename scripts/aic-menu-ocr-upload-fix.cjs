const fs = require('fs');

const componentFile = 'src/components/MenuCardImportModal.tsx';
let component = fs.readFileSync(componentFile, 'utf8');

// OCR-only preprocessing: smaller images reduce proxy/body pressure and Gemini latency.
component = component.replace('const MAX_DIM = 1800;', 'const MAX_DIM = 1200;');
component = component.replace("canvas.toDataURL('image/jpeg', 0.88)", "canvas.toDataURL('image/jpeg', 0.72)");

const startMarker = '      // 2. Call server endpoint';
const endMarker = '      // 3. Map extracted items to draft state';
const start = component.indexOf(startMarker);
const end = component.indexOf(endMarker, start);

if (start === -1 || end === -1) {
  throw new Error('Could not locate AI menu extraction request block in MenuCardImportModal.tsx');
}

const replacement = `      // 2. Send one OCR photo per request with limited concurrency.
      // This avoids large requests and prevents a long serial queue from
      // making the browser report only "Failed to fetch".
      const token =
        adminToken ||
        (typeof window !== 'undefined' ? localStorage.getItem('hm_admin_token') : null);

      if (!token) {
        throw new Error('Admin session expired. Please login to the Admin Panel again.');
      }

      const allExtractedItems: any[] = [];
      const BATCH_SIZE = 1;
      const MAX_CONCURRENT = 3;
      let nextIndex = 0;

      const extractOne = async (batchIndex: number, imageBatch: any[]) => {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 60000);

        try {
          const res = await fetch('/api/admin/menu/extract-photos', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: \`Bearer \${token}\`,
            },
            body: JSON.stringify({ images: imageBatch }),
            signal: controller.signal,
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.error || \`AI extraction failed for photo \${batchIndex + 1}.\`);
          }

          if (Array.isArray(data.items)) {
            allExtractedItems.push(...data.items);
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') {
            throw new Error(\`AI extraction timed out on photo \${batchIndex + 1}. Please try again.\`);
          }
          throw err;
        } finally {
          window.clearTimeout(timeoutId);
        }
      };

      const worker = async () => {
        while (true) {
          const index = nextIndex++;
          if (index >= preparedImages.length) return;
          await extractOne(index, preparedImages.slice(index, index + BATCH_SIZE));
        }
      };

      await Promise.all(
        Array.from(
          { length: Math.min(MAX_CONCURRENT, preparedImages.length) },
          () => worker()
        )
      );

      const data = { items: allExtractedItems };

`;

component = component.slice(0, start) + replacement + component.slice(end);
fs.writeFileSync(componentFile, component, 'utf8');
console.log('AIC menu OCR fixed: 1200px/0.72 JPEG, one photo per request, max 3 concurrent requests, 60s timeout.');

// Keep the current primary model selection controlled by the Gemini resilience
// script. Do not rewrite model IDs here.
