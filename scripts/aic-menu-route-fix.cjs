const fs = require('fs');

const file = 'server.ts';
const source = fs.readFileSync(file, 'utf8');

// Prevent the legacy API-normalization middleware from treating public
// crawlable pages such as /menu.html as the API endpoint /api/menu.html.
const from = `    (req.url.startsWith('/auth') ||
      req.url.startsWith('/menu') ||
      req.url.startsWith('/cart') ||
      req.url.startsWith('/orders') ||
      req.url.startsWith('/health') ||
      req.url.startsWith('/delivery') ||
      req.url.startsWith('/profile'))`;

const to = `    (req.url === '/auth' || req.url.startsWith('/auth/') ||
      req.url === '/menu' || req.url.startsWith('/menu/') ||
      req.url === '/cart' || req.url.startsWith('/cart/') ||
      req.url === '/orders' || req.url.startsWith('/orders/') ||
      req.url === '/health' || req.url.startsWith('/health/') ||
      req.url === '/delivery' || req.url.startsWith('/delivery/') ||
      req.url === '/profile' || req.url.startsWith('/profile/'))`;

if (source.includes(to)) {
  console.log('AIC menu route fix already applied.');
} else if (source.includes(from)) {
  fs.writeFileSync(file, source.replace(from, to), 'utf8');
  console.log('AIC menu route fix applied: /menu.html will remain a public HTML page.');
} else {
  throw new Error('AIC menu route fix could not find the expected API normalization block.');
}
