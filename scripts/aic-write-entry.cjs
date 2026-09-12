const fs = require('fs');
const path = require('path');

const distDir = path.resolve('dist');
fs.mkdirSync(distDir, { recursive: true });

const entry = "require('../server/aic-start.cjs');\n";
fs.writeFileSync(path.join(distDir, 'server.cjs'), entry, 'utf8');
console.log('Hotel Malabar AIC runtime entry created.');
