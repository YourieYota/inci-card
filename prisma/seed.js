require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const DB_PROVIDER = process.env.DB_PROVIDER || 'postgresql';
let prisma;
let pool = null;

if (DB_PROVIDER === 'sqlite') {
  const { createClient: createLibSQLClient } = require('@libsql/client');
  const { PrismaLibSql } = require('@prisma/adapter-libsql');
  // Utiliser la même URL de DB que pour Next
  const connectionString = process.env.DATABASE_URL || 'file:./data/inci-card.db';
  const libsql = createLibSQLClient({ url: connectionString });
  const adapter = new PrismaLibSql(libsql);
  prisma = new PrismaClient({ adapter });
} else {
  const { PrismaPg } = require('@prisma/adapter-pg')
  const pg = require('pg')
  
  const connectionString = process.env.DATABASE_URL;
  pool = new pg.Pool({
    connectionString: connectionString,
    ssl: connectionString && connectionString.includes('neon.tech') ? { rejectUnauthorized: false } : undefined
  })
  const adapter = new PrismaPg(pool)
  prisma = new PrismaClient({ adapter })
}

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@imprimerie.fr' },
    update: {
      login: 'admin'
    },
    create: {
      email: 'admin@imprimerie.fr',
      login: 'admin',
      name: 'Administrateur',
      passwordHash: passwordHash,
      role: 'ADMIN',
    },
  })

  console.log('Utilisateur admin créé:', admin.email)
}

main()
  .then(async () => {
    await prisma.$disconnect()
    if (pool) await pool.end()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    if (pool) await pool.end()
    process.exit(1)
  })
