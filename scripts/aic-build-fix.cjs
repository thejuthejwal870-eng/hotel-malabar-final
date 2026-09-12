const fs = require('fs');

function replaceOnce(file, from, to) {
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes(to)) return;
  if (!source.includes(from)) {
    throw new Error(`AIC build fix could not find expected text in ${file}`);
  }
  fs.writeFileSync(file, source.replace(from, to), 'utf8');
}

// Keep the deployed admin API compatible with the current database method.
replaceOnce(
  'server.ts',
  "const admin = db.setupInitialAdmin({ phone: adminPhone, password: adminPassword });",
  "const admin = db.initialSetupAdmin(adminPhone, adminPassword);"
);
replaceOnce(
  'server.ts',
  "if (adminPassword.length < 6) {\n      return res.status(400).json({ error: 'Admin password must be at least 6 characters.' });\n    }",
  "if (adminPassword.length < 8) {\n      return res.status(400).json({ error: 'Admin password must be at least 8 characters.' });\n    }"
);

// Remove the old hardcoded admin auto-login. Use only the real login flow.
const adminFile = 'src/components/AdminDashboard.tsx';
let admin = fs.readFileSync(adminFile, 'utf8');
admin = admin.replace(
  /\n\s*const performAutoAdminLogin = \(\) => \{[\s\S]*?\n\s*\};\s*/,
  '\n\n'
);
admin = admin.replace(/\n\s*performAutoAdminLogin\(\);/g, '');
admin = admin.replace(
  /\.catch\(\(\) => \{\s*performAutoAdminLogin\(\);\s*\}\);/g,
  ".catch(() => {\n          localStorage.removeItem('hm_admin_token');\n          setAdminToken(null);\n          setIsAdminLoggedIn(false);\n        });"
);
admin = admin.replace("fetch('/api/admin/setup-status')", "fetch('/api/admin/config-status')");
admin = admin.replace("const configured = Boolean(data?.isConfigured);", "const configured = Boolean(data?.configured);");
admin = admin.replace("fetch('/api/admin/status', {", "fetch('/api/admin/me', {");
admin = admin.replace(/9567562071/g, 'REMOVED_ADMIN_PHONE');
admin = admin.replace(/admin123/g, 'REMOVED_ADMIN_PASSWORD');

// Safety guard: never allow the known legacy hardcoded admin credentials or
// auto-login function to reach a production build again.
if (/performAutoAdminLogin|9567562071|admin123/.test(admin)) {
  throw new Error('Security guard: legacy hardcoded admin auto-login remains in AdminDashboard.tsx');
}
fs.writeFileSync(adminFile, admin, 'utf8');

// Keep customer and admin as two separate URL entry points.
// Root (/) is ALWAYS customer; only /admin* enters the admin application.
const appFile = 'src/App.tsx';
let app = fs.readFileSync(appFile, 'utf8');
app = app.replace(
  "const [viewMode, setViewMode] = useState<'customer' | 'admin'>('admin');",
  "const [viewMode, setViewMode] = useState<'customer' | 'admin'>(isAdminPath() ? 'admin' : 'customer');"
);
app = app.replace(
  /const handleLocationChange = \(\) => \{\s*\/\/ Default to admin panel unless user explicitly navigates to \/customer\s*const isCustomerExplicit = \s*window\.location\.pathname === '\/customer' \|\|\s*window\.location\.hash === '#customer' \|\|\s*window\.location\.search\.includes\('view=customer'\);\s*setViewMode\(isCustomerExplicit \? 'customer' : 'admin'\);\s*\};/,
  "const handleLocationChange = () => {\n      // Strict separation: only the /admin URL family opens Admin.\n      // Every other normal site URL opens the customer website.\n      setViewMode(isAdminPath() ? 'admin' : 'customer');\n    };"
);
// Remove the keyboard shortcut that could expose the admin panel from the customer site.
app = app.replace(
  /\n\s*const handleKeyDown = \(e: KeyboardEvent\) => \{[\s\S]*?\n\s*\};\n\n\s*window\.addEventListener\('popstate', handleLocationChange\);/,
  "\n\n    window.addEventListener('popstate', handleLocationChange);"
);
// Do not render an Admin Portal entry point on the customer landing screen.
app = app.replace(/\s*onOpenAdmin=\{navigateToAdmin\}/g, '');
fs.writeFileSync(appFile, app, 'utf8');

// Also remove the Admin Portal button itself from the customer first screen.
const firstScreenFile = 'src/components/CustomerFirstScreen.tsx';
let firstScreen = fs.readFileSync(firstScreenFile, 'utf8');
firstScreen = firstScreen.replace(/,\s*onOpenAdmin\?: \(\) => void/, '');
firstScreen = firstScreen.replace(/,\s*onOpenAdmin\s*\}\)\s*=>/, ' }) =>');
firstScreen = firstScreen.replace(/\n\s*\{onOpenAdmin && \([\s\S]*?\n\s*\)\}/, '');
fs.writeFileSync(firstScreenFile, firstScreen, 'utf8');

// AIC App Hosting may start dist/server.cjs directly instead of using our wrapper.
// Patch the actual server build so customer orders are written to Supabase and
// admin order reads refresh from Supabase before querying the local database.
replaceOnce(
  'server.ts',
  "import { db } from './server/db.ts';",
  "import { db } from './server/db.ts';\nimport { syncFromSupabase, syncToSupabase } from './server/supabase-sync.ts';"
);
replaceOnce(
  'server.ts',
  "app.post('/api/orders', requireCustomerAuth, (req: AuthenticatedRequest, res: Response) => {",
  "app.post('/api/orders', requireCustomerAuth, async (req: AuthenticatedRequest, res: Response) => {"
);
replaceOnce(
  'server.ts',
  "    const order = db.createOrder({\n      customerId: user.id,\n      customerName: `${user.firstName} ${user.lastName}`.trim(),\n      customerPhone: user.phone,\n      deliveryAddress,\n      deliveryArea,\n      items,\n      specialInstructions,\n      customerLatitude: lat,\n      customerLongitude: lng,\n    });\n\n    res.status(201).json({",
  "    // Refresh the shared database immediately before creating the order so this\n    // instance does not overwrite a newer order/customer change from another instance.\n    await syncFromSupabase();\n    db.reloadFromDisk();\n\n    const order = db.createOrder({\n      customerId: user.id,\n      customerName: `${user.firstName} ${user.lastName}`.trim(),\n      customerPhone: user.phone,\n      deliveryAddress,\n      deliveryArea,\n      items,\n      specialInstructions,\n      customerLatitude: lat,\n      customerLongitude: lng,\n    });\n\n    await syncToSupabase();\n\n    res.status(201).json({"
);
replaceOnce(
  'server.ts',
  "app.get('/api/admin/orders', requireAdminAuth, (req: Request, res: Response) => {\n  try {\n    const date = req.query.date ? String(req.query.date) : undefined;\n    const status = req.query.status ? String(req.query.status) : undefined;\n    res.json(db.getAdminOrders({ date, status }));\n  } catch (err: any) {",
  "app.get('/api/admin/orders', requireAdminAuth, async (req: Request, res: Response) => {\n  try {\n    // Always refresh the shared database before an admin order read.\n    await syncFromSupabase();\n    db.reloadFromDisk();\n\n    // Return the complete order list. The Admin Dashboard already applies\n    // the New / Accepted / Rejected / History filters on the client.\n    res.json(db.getAllOrders());\n  } catch (err: any) {"
);

// Add a small database reload hook so an admin process can see orders written by another AIC instance.
replaceOnce(
  'server/db.ts',
  "  public getVersion(): number {\n    return this.version;\n  }",
  "  public reloadFromDisk(): void {\n    try {\n      if (!fs.existsSync(DATA_FILE)) return;\n      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));\n      if (!parsed || !Array.isArray(parsed.users) || !Array.isArray(parsed.orders)) return;\n      this.data = parsed as DatabaseData;\n      this.menuCache = null;\n      this.version++;\n    } catch (error) {\n      console.error('Failed to reload database from disk:', error);\n    }\n  }\n\n  public getVersion(): number {\n    return this.version;\n  }"
);

console.log('Hotel Malabar AIC build fixes, Supabase order sync, admin security guard, and customer/admin separation applied.');
