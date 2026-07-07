/**
 * patch-prisma-client.js
 * 
 * Patches the installed Prisma client's index.js to inject the SQLite datasource URL
 * into the inlineSchema. This fixes the URL_INVALID error from the WASM query compiler.
 * 
 * Must be run with admin privileges (because the file is in C:\Program Files)
 */

const fs = require('fs');
const path = require('path');

const INSTALL_DIR = 'C:\\Program Files\\INCI-Card\\app';
const PRISMA_INDEX = path.join(INSTALL_DIR, 'node_modules', '.prisma', 'client', 'index.js');
const DB_URL = 'file:./data/inci-card.db';

console.log('[1/3] Reading generated Prisma client...');
let content = fs.readFileSync(PRISMA_INDEX, 'utf8');

// Check if already patched
if (content.includes('url') && content.includes(DB_URL)) {
  console.log('    Already patched! Skipping.');
  process.exit(0);
}

console.log('[2/3] Patching inlineSchema to add datasource URL...');

// The inlineSchema contains escaped newlines and quotes
// We need to find: datasource db {\n  provider = \"sqlite\"\n}
// And replace with: datasource db {\n  provider = \"sqlite\"\n  url      = \"file:./data/inci-card.db\"\n}

const searchPattern = 'datasource db {\\n  provider = \\"sqlite\\"\\n}';
const replacePattern = 'datasource db {\\n  provider = \\"sqlite\\"\\n  url      = \\"' + DB_URL + '\\"\\n}';

if (content.includes(searchPattern)) {
  content = content.replace(searchPattern, replacePattern);
  console.log('    Pattern found and replaced.');
} else {
  console.error('    ERROR: Could not find datasource pattern in inlineSchema!');
  // Try to show what's around datasource
  const idx = content.indexOf('datasource');
  if (idx > -1) {
    console.log('    Found "datasource" at index', idx);
    console.log('    Context:', content.substring(idx, idx + 100));
  }
  process.exit(1);
}

// Also patch the schema.prisma file for consistency
const SCHEMA_FILE = path.join(INSTALL_DIR, 'node_modules', '.prisma', 'client', 'schema.prisma');
try {
  let schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
  const schemaSearch = 'datasource db {\n  provider = "sqlite"\n}';
  const schemaReplace = 'datasource db {\n  provider = "sqlite"\n  url      = "' + DB_URL + '"\n}';
  if (schema.includes(schemaSearch)) {
    schema = schema.replace(schemaSearch, schemaReplace);
    fs.writeFileSync(SCHEMA_FILE, schema, 'utf8');
    console.log('    Also patched schema.prisma');
  }
} catch (e) {
  // Non-critical
}

console.log('[3/3] Writing patched file...');
fs.writeFileSync(PRISMA_INDEX, content, 'utf8');
console.log('    Done!');
console.log('');
console.log('Prisma client patched successfully.');
console.log('The datasource URL has been set to:', DB_URL);
