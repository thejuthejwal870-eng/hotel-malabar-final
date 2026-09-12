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

// Remove the old hardcoded admin auto-login and use the real config/me endpoints.
const adminFile = 'src/components/AdminDashboard.tsx';
let admin = fs.readFileSync(adminFile, 'utf8');
const autoStart = "    const performAutoAdminLogin = () => {";
if (admin.includes(autoStart)) {
  const start = admin.indexOf(autoStart);
  const end = admin.indexOf("    const savedToken = localStorage.getItem('hm_admin_token');", start);
  if (end < 0) throw new Error('Could not locate saved admin token block.');
  admin = admin.slice(0, start) + admin.slice(end);
}
const oldFallback = `          } else {\n            localStorage.removeItem('hm_admin_token');\n            performAutoAdminLogin();\n          }\n        })\n        .catch(() => {\n          performAutoAdminLogin();\n        });\n    } else {\n      performAutoAdminLogin();\n    }`;
const newFallback = `          } else {\n            localStorage.removeItem('hm_admin_token');\n            setAdminToken(null);\n            setIsAdminLoggedIn(false);\n          }\n        })\n        .catch(() => {\n          localStorage.removeItem('hm_admin_token');\n          setAdminToken(null);\n          setIsAdminLoggedIn(false);\n        });\n    }`;
if (admin.includes(oldFallback)) admin = admin.replace(oldFallback, newFallback);
admin = admin.replace("fetch('/api/admin/setup-status')", "fetch('/api/admin/config-status')");
admin = admin.replace("const configured = Boolean(data?.isConfigured);", "const configured = Boolean(data?.configured);");
admin = admin.replace("fetch('/api/admin/status', {", "fetch('/api/admin/me', {");
if (admin.includes('9567562071') || admin.includes('admin123')) {
  throw new Error('Hardcoded admin credentials remain in AdminDashboard.tsx');
}
fs.writeFileSync(adminFile, admin, 'utf8');

console.log('Hotel Malabar AIC build fixes applied.');
