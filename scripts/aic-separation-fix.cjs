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

// Idempotent build-time separation fix. It is safe when aic-build-fix.cjs has
// already made the same changes earlier in the build.
updateFile('src/App.tsx', (source) => {
  let s = source;

  s = s.replace(
    /const \[viewMode, setViewMode\] = useState<'customer' \| 'admin'>\([^;]+\);/,
    "const [viewMode, setViewMode] = useState<'customer' | 'admin'>(isAdminPath() ? 'admin' : 'customer');"
  );

  // Replace the complete navigation effect so no stale handleKeyDown reference
  // can survive an older partial patch.
  const start = s.indexOf('  // Listen for browser navigation changes');
  const end = s.indexOf('\n\n  const navigateToCustomer', start);
  if (start !== -1 && end !== -1) {
    const effect = `  // Listen for browser navigation changes. Admin is reachable only via /admin*.\n  useEffect(() => {\n    const handleLocationChange = () => {\n      setViewMode(isAdminPath() ? 'admin' : 'customer');\n    };\n\n    const originalPushState = window.history.pushState;\n    const originalReplaceState = window.history.replaceState;\n\n    window.history.pushState = function (...args) {\n      const res = originalPushState.apply(this, args);\n      handleLocationChange();\n      return res;\n    };\n\n    window.history.replaceState = function (...args) {\n      const res = originalReplaceState.apply(this, args);\n      handleLocationChange();\n      return res;\n    };\n\n    window.addEventListener('popstate', handleLocationChange);\n    window.addEventListener('hashchange', handleLocationChange);\n\n    return () => {\n      window.history.pushState = originalPushState;\n      window.history.replaceState = originalReplaceState;\n      window.removeEventListener('popstate', handleLocationChange);\n      window.removeEventListener('hashchange', handleLocationChange);\n    };\n  }, []);`;
    s = s.slice(0, start) + effect + s.slice(end);
  }

  // Remove any legacy shortcut code/references anywhere in App.tsx.
  s = s.replace(/\n\s*const handleKeyDown = \(e: KeyboardEvent\) => \{[\s\S]*?\n\s*\};/g, '');
  s = s.replace(/\n\s*window\.addEventListener\('keydown', handleKeyDown\);/g, '');
  s = s.replace(/\n\s*window\.removeEventListener\('keydown', handleKeyDown\);/g, '');
  s = s.replace(/\s*onOpenAdmin=\{navigateToAdmin\}/g, '');

  if (s.includes('handleKeyDown')) throw new Error('Customer/admin routing guard: stale handleKeyDown reference remains in App.tsx');
  if (/useState<'customer' \| 'admin'>\('admin'\)/.test(s)) throw new Error('Customer/admin routing guard: App.tsx still defaults to admin');
  return s;
});

updateFile('src/components/CustomerFirstScreen.tsx', (source) => {
  let s = source;
  s = s.replace(/\n\s*onOpenAdmin\??\s*:\s*\(\)\s*=>\s*void\s*[,;]?/g, '');
  s = s.replace(/\n\s*onOpenAdmin\s*[,;]?/g, '');
  s = s.replace(/\s*\{\s*onOpenAdmin\s*&&\s*\([\s\S]*?\)\s*\}/g, '');
  s = s.replace(/\bonOpenAdmin\??/g, '');
  return s;
});

console.log('Hotel Malabar customer/admin separation verified before Vite build.');
