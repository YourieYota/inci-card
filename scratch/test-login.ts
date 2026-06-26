import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const { prisma } = await import('../lib/prisma');
  const bcrypt = await import('bcrypt');

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'admin@imprimerie.fr' },
          { login: 'admin' }
        ]
      }
    });
    console.log("User found in database:", user ? user.email : "NOT FOUND");
    if (user) {
      const isPasswordValid = await bcrypt.compare('admin123', user.passwordHash);
      console.log("Password check outcome:", isPasswordValid ? "SUCCESS" : "FAILED");
    }
  } catch (error) {
    console.error("DATABASE CONNECTION ERROR IN APP CONTEXT:", error);
  }
}

main();
