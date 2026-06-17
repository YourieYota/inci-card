const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@imprimerie.fr' },
    update: {},
    create: {
      email: 'admin@imprimerie.fr',
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
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
