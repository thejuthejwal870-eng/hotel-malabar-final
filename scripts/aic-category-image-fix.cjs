const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server.ts');
if (!fs.existsSync(file)) process.exit(0);
let s = fs.readFileSync(file, 'utf8');

const oldBlock = `const { name, icon } = req.body;\n    if (!name) return res.status(400).json({ error: 'Category name is required' });\n    const cat = db.addCategory({\n      name,\n      icon: icon || 'Utensils',`;
const newBlock = `const { name, icon, imageUrl } = req.body;\n    if (!name) return res.status(400).json({ error: 'Category name is required' });\n    const cat = db.addCategory({\n      name,\n      icon: icon || 'Utensils',\n      imageUrl: String(imageUrl || '').trim(),`;

if (s.includes(oldBlock) && !s.includes('const { name, icon, imageUrl } = req.body')) {
  s = s.replace(oldBlock, newBlock);
  fs.writeFileSync(file, s, 'utf8');
}
