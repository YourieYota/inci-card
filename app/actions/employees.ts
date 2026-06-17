'use server';

import { prisma } from '@/lib/prisma';

export async function getEmployees(companyId: string) {
  try {
    return await prisma.employee.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    throw new Error('Impossible de récupérer les employés');
  }
}

export async function importEmployees({
  companyId,
  uniqueField,
  rows,
}: {
  companyId: string;
  uniqueField: string;
  rows: any[];
}) {
  try {
    const importPromises = rows.map(async (row) => {
      const uniqueVal = row[uniqueField];
      if (uniqueVal === undefined || uniqueVal === null || uniqueVal === '') {
        return; // skip rows without unique identifiers
      }

      const uniqueIdentifier = String(uniqueVal).trim();

      return prisma.employee.upsert({
        where: {
          companyId_uniqueIdentifier: {
            companyId,
            uniqueIdentifier,
          },
        },
        update: {
          dynamicData: row,
        },
        create: {
          companyId,
          uniqueIdentifier,
          dynamicData: row,
          status: 'A_ENROLER',
        },
      });
    });

    await Promise.all(importPromises);
    return { success: true, count: rows.length };
  } catch (error) {
    console.error('Error importing employees:', error);
    throw new Error('Erreur lors de l\'importation des employés');
  }
}

export async function updateEmployeeStatus(employeeId: string, status: string) {
  try {
    const data: any = { status };
    if (status === 'IMPRIME') {
      data.printedAt = new Date();
    }
    
    return await prisma.employee.update({
      where: { id: employeeId },
      data,
    });
  } catch (error) {
    console.error('Error updating employee status:', error);
    throw new Error('Impossible de mettre à jour le statut de l\'employé');
  }
}

export async function saveEmployeePhoto(employeeId: string, photoBase64: string) {
  try {
    return await prisma.employee.update({
      where: { id: employeeId },
      data: {
        photoUrl: photoBase64,
        status: 'PHOTO_VALIDEE', // Auto transition to photo validated
      },
    });
  } catch (error) {
    console.error('Error saving employee photo:', error);
    throw new Error('Impossible d\'enregistrer la photo de l\'employé');
  }
}
