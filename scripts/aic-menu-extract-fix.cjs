const fs = require('fs');

const file = 'server.ts';
const source = fs.readFileSync(file, 'utf8');

const marker = "// ==========================================\n// CUSTOMER ORDERS\n// ==========================================";

if (source.includes("app.post('/api/admin/menu/extract-photos'")) {
  console.log('AIC menu extraction route already present.');
  process.exit(0);
}

if (!source.includes(marker)) {
  throw new Error('AIC menu extraction fix could not find the CUSTOMER ORDERS marker in server.ts');
}

const route = `// AI Menu Card Photo OCR / Auto-Categorization\napp.post('/api/admin/menu/extract-photos', requireAdminAuth, async (req: Request, res: Response) => {\n  try {\n    const images = Array.isArray(req.body?.images) ? req.body.images : [];\n    if (images.length === 0) {\n      return res.status(400).json({ error: 'No menu photos provided for extraction.' });\n    }\n\n    const menuPayload = db.getMenuPayload();\n    const categories = (menuPayload.categories || []).map((category: any) => ({\n      id: category.id,\n      name: category.name,\n    }));\n\n    const items = await extractMenuItemsFromPhotos(images, categories);\n    return res.json({ items });\n  } catch (err: any) {\n    console.error('AI menu photo extraction error:', err);\n    return res.status(500).json({\n      error: err?.message || 'Failed to extract menu items from photos.',\n    });\n  }\n});\n\n`;

fs.writeFileSync(file, source.replace(marker, route + marker), 'utf8');
console.log('AIC menu extraction API route added to server.ts.');
