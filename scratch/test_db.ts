import * as dotenv from 'dotenv';
import path from 'path';
// Load environment variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { prisma } from '../lib/prisma';

async function main() {
  try {
    const companies = await prisma.company.findMany({ take: 1 });
    if (companies.length === 0) {
      console.log('No companies found.');
      return;
    }
    const target = companies[0];
    console.log('Found company:', target.name, target.id);
    
    console.log('Attempting update...');
    const updated = await prisma.company.update({
      where: { id: target.id },
      data: {
        protectAppModified: true
      }
    });
    console.log('Success!', updated);
  } catch (error) {
    console.error('Prisma Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
