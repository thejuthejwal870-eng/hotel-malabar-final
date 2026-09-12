const fs = require('fs');

function updateFile(path, transform) {
  const source = fs.readFileSync(path, 'utf8');
  const updated = transform(source);
  if (updated !== source) {
    fs.writeFileSync(path, updated, 'utf8');
    console.log(`AIC separation fix applied: ${path}`);
  } else {
    console.log(`AIC separation fix already applied: ${path}`);
  }
}

// This script is intentionally idempotent because aic-build-fix.cjs may have
// already applied the same separation changes earlier in the build.
updateFile('src/App.tsx', (source) => {
  let s = source;

  s = s.replace(
    "const [viewMode, setViewMode] = useState<'customer' | 'admin'>('admin');",
    "const [viewMode, setViewMode] = useState<'customer' | 'admin'>(isAdminPath() ? 'admin' : 'customer');"
  );

  s = s.replace(
    /const handleLocationChange = \(\) => \{\s*\/\/ Default to admin panel unless user explicitly navigates to \/customer\s*const isCustomerExplicit =\s*window\.location\.pathname === '\/customer' \|\|\s*window\.location\.hash === '#customer' \|\|\s*window\.location\.search\.includes\('view=customer'\);\s*setViewMode\(isCustomerExplicit \? 'customer' : 'admin'\);\s*\};/m,
    "const handleLocationChange = () => {\n      // Strict separation: only /admin opens the admin application.\n      // Every other URL opens the customer website.\n      setViewMode(isAdminPath() ? 'admin' : 'customer');\n    };"
  );

  s = s.replace(
    /\n\s*const handleKeyDown = \(e: KeyboardEvent\) => \{[\s\S]*?\n\s*\};\n\s*\n\s*window\.addEventListener\('popstate', handleLocationChange\);/m,
    "\n\n    window.addEventListener('popstate', handleLocationChange);"
  );

  s = s.replace(/\s*onOpenAdmin=\{navigateToAdmin\}/g, '');

  if (s.includes("useState<'customer' | 'admin'>('admin')") || s.includes('isCustomerExplicit')) {
    throw new Error('Customer/admin routing patch did not fully apply to App.tsx');
  }

  return s;
});

updateFile('src/components/CustomerFirstScreen.tsx', (source) => {
  let s = source;
  s = s.replace(/,?\s*onOpenAdmin\??\s*:\s*\(\)\s*=>\s*void\s*[,;]?/g, '');
  s = s.replace(/,?\s*onOpenAdmin\s*[,;]?/g, '');
  s = s.replace(/\{\s*onOpenAdmin\s*&&\s*\([\s\S]*?\)\s*\}/g, '');
  s = s.replace(/onOpenAdmin\??/g, '');
  if (s.includes('onOpenAdmin')) {
    throw new Error('Customer landing screen still contains an Admin Portal entry point');
  }
  return s;
});

console.log('Hotel Malabar customer/admin separation verified before Vite build.');
