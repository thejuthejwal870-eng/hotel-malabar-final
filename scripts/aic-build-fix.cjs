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

// The previous patch used an overly strict formatter-dependent removal. This regex
// removes the entire auto-login function regardless of whitespace/line formatting.
admin = admin.replace(
  /\n\s*const performAutoAdminLogin = \(\) => \{[\s\S]*?\n\s*\};\s*/,
  '\n\n'
);

// Remove every remaining invocation of the old automatic login helper.
admin = admin.replace(/\n\s*performAutoAdminLogin\(\);/g, '');

// If an old fallback branch remains, simply clear the admin token and stay logged out.
admin = admin.replace(
  /\.catch\(\(\) => \{\s*performAutoAdminLogin\(\);\s*\}\);/g,
  ".catch(() => {\n          localStorage.removeItem('hm_admin_token');\n          setAdminToken(null);\n          setIsAdminLoggedIn(false);\n        });"
);

// Use the backend's actual admin endpoints.
admin = admin.replace("fetch('/api/admin/setup-status')", "fetch('/api/admin/config-status')");
admin = admin.replace("const configured = Boolean(data?.isConfigured);", "const configured = Boolean(data?.configured);");
admin = admin.replace("fetch('/api/admin/status', {", "fetch('/api/admin/me', {");

// Never allow the old credential literals into the deployed frontend.
admin = admin.replace(/9567562071/g, 'REMOVED_ADMIN_PHONE');
admin = admin.replace(/admin123/g, 'REMOVED_ADMIN_PASSWORD');

fs.writeFileSync(adminFile, admin, 'utf8');
console.log('Hotel Malabar AIC build fixes applied.');
