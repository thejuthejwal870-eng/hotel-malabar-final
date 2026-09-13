const fs = require('fs');

const file = 'server.ts';
let source = fs.readFileSync(file, 'utf8');

const marker = "// ==========================================\n// CUSTOMER ORDERS\n// ==========================================";

if (!source.includes(marker)) {
  throw new Error('AIC menu extraction fix could not find the CUSTOMER ORDERS marker in server.ts');
}

const routes = [];

if (!source.includes("app.post('/api/admin/menu/extract-photos'")) {
  routes.push(`// AI Menu Card Photo OCR / Auto-Categorization
app.post('/api/admin/menu/extract-photos', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const images = Array.isArray(req.body?.images) ? req.body.images : [];
    if (images.length === 0) {
      return res.status(400).json({ error: 'No menu photos provided for extraction.' });
    }

    const menuPayload = db.getMenuPayload();
    const categories = (menuPayload.categories || []).map((category: any) => ({
      id: category.id,
      name: category.name,
    }));

    const items = await extractMenuItemsFromPhotos(images, categories);
    return res.json({ items });
  } catch (err: any) {
    console.error('AI menu photo extraction error:', err);
    return res.status(500).json({
      error: err?.message || 'Failed to extract menu items from photos.',
    });
  }
});

`);
}

if (!source.includes("app.post('/api/admin/menu/items/batch'")) {
  routes.push(`// AI Menu Card Import: batch-save selected OCR items
app.post('/api/admin/menu/items/batch', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ error: 'No menu items provided.' });
    }

    const createdItems = items.map((item: any) => {
      const name = String(item?.name || '').trim();
      if (!name) {
        throw new Error('Each menu item must have a name.');
      }

      return db.addMenuItem({
        ...item,
        name,
        categoryId: String(item?.categoryId || '').trim(),
        price: Number.isFinite(Number(item?.price)) && Number(item.price) >= 0 ? Number(item.price) : 0,
        description: typeof item?.description === 'string' ? item.description.trim() : '',
        imageUrl: '',
        isAvailable: item?.isAvailable !== false,
      });
    });

    return res.status(201).json({
      success: true,
      items: createdItems,
      message: `${createdItems.length} menu item(s) added successfully.`,
    });
  } catch (err: any) {
    console.error('AI menu batch-save error:', err);
    return res.status(400).json({
      error: err?.message || 'Failed to add menu items.',
    });
  }
});

`);
}

if (routes.length > 0) {
  source = source.replace(marker, routes.join('') + marker);
  fs.writeFileSync(file, source, 'utf8');
  console.log(`AIC menu API fixes added: ${routes.length} route(s).`);
} else {
  console.log('AIC menu API routes already present.');
}
