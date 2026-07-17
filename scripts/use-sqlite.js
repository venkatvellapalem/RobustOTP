const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
if (!fs.existsSync(schemaPath)) {
  console.error('[error] schema.prisma not found!');
  process.exit(1);
}

let schema = fs.readFileSync(schemaPath, 'utf8');

// Replace provider
schema = schema.replace(/provider\s*=\s*"postgresql"/g, 'provider = "sqlite"');

// Replace URL
schema = schema.replace(/url\s*=\s*env\("DATABASE_URL"\)/g, 'url = "file:./dev.db"');

// Remove @db.Uuid annotations
schema = schema.replace(/\s*@db\.Uuid/g, '');

fs.writeFileSync(schemaPath, schema, 'utf8');
console.log('[info] Local schema transformed successfully to SQLite.');

// Update .env file
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  let env = fs.readFileSync(envPath, 'utf8');
  if (env.match(/DATABASE_URL=.*/)) {
    env = env.replace(/DATABASE_URL=.*/g, 'DATABASE_URL="file:./dev.db"');
  } else {
    env += '\nDATABASE_URL="file:./dev.db"\n';
  }
  fs.writeFileSync(envPath, env, 'utf8');
  console.log('[info] Local .env configured to use SQLite.');
}
