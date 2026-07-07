const path = require('path');

const APP_DIR = 'C:\\Program Files\\INCI-Card\\app';
process.chdir(APP_DIR);

// Force module resolution from installed app
const { PrismaClient } = require(path.join(APP_DIR, 'node_modules', '@prisma', 'client'));
const { createClient } = require(path.join(APP_DIR, 'node_modules', '@libsql', 'client'));
const { PrismaLibSql } = require(path.join(APP_DIR, 'node_modules', '@prisma', 'adapter-libsql'));

const dbPath = path.join(APP_DIR, 'data', 'inci-card.db').replace(/\\/g, '/');
const url = 'file:' + dbPath;
console.log('DB URL:', url);

const libsql = createClient({ url });
const adapter = new PrismaLibSql(libsql);

const prisma = new PrismaClient({
  adapter,
  __internal: {
    configOverride: (config) => {
      console.log('activeProvider:', config.activeProvider);
      
      // Check what the inlineSchema looks like around datasource
      const dsIdx = config.inlineSchema.indexOf('datasource');
      if (dsIdx > -1) {
        console.log('Schema around datasource (raw chars):');
        const snippet = config.inlineSchema.substring(dsIdx, dsIdx + 80);
        console.log(JSON.stringify(snippet));
      }
      
      // Try various replacement patterns
      const original = config.inlineSchema;
      
      // Pattern 1: literal \n
      config.inlineSchema = config.inlineSchema.replace(
        /datasource\s+db\s*\{\s*provider\s*=\s*"sqlite"\s*\}/,
        `datasource db {\n  provider = "sqlite"\n  url      = "${url}"\n}`
      );
      
      if (config.inlineSchema !== original) {
        console.log('Pattern matched and replaced!');
      } else {
        console.log('Pattern did NOT match. Trying alternative...');
        // Try with escaped newlines
        config.inlineSchema = config.inlineSchema.replace(
          'datasource db {\\n  provider = \\"sqlite\\"\\n}',
          `datasource db {\\n  provider = \\"sqlite\\"\\n  url      = \\"${url}\\"\\n}`
        );
        if (config.inlineSchema !== original) {
          console.log('Alternative pattern matched!');
        } else {
          console.log('NO PATTERN MATCHED');
        }
      }
      
      // Verify after patching
      const dsIdx2 = config.inlineSchema.indexOf('datasource');
      if (dsIdx2 > -1) {
        console.log('After patch:', JSON.stringify(config.inlineSchema.substring(dsIdx2, dsIdx2+120)));
      }
      
      return config;
    }
  }
});

prisma.user.findMany()
  .then(r => {
    console.log('SUCCESS:', r.map(u => ({email: u.email, login: u.login, role: u.role})));
    process.exit(0);
  })
  .catch(e => {
    console.error('ERROR:', e.message.substring(0, 500));
    process.exit(1);
  });
