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

    if (status === 'PHOTO_VALIDEE' || status === 'IMPRIME') {
      const emp = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { enrollmentNumber: true },
      });
      if (emp && !emp.enrollmentNumber) {
        const count = await prisma.employee.count({
          where: { enrollmentNumber: { not: null } },
        });
        const num = String(count + 1).padStart(5, '0');
        data.enrollmentNumber = `INCI-ENR-${new Date().getFullYear()}-${num}`;
      }
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

export async function bulkUpdateEmployeeStatus(employeeIds: string[], status: string) {
  try {
    const data: any = { status };
    if (status === 'IMPRIME') {
      data.printedAt = new Date();
    }
    
    // Process sequentially to avoid duplicate sequential enrollmentNumbers
    const updates = [];
    for (const id of employeeIds) {
      const emp = await prisma.employee.findUnique({
        where: { id },
        select: { enrollmentNumber: true },
      });
      
      const singleData = { ...data };
      if ((status === 'PHOTO_VALIDEE' || status === 'IMPRIME') && emp && !emp.enrollmentNumber) {
        const count = await prisma.employee.count({
          where: { enrollmentNumber: { not: null } },
        });
        const num = String(count + 1).padStart(5, '0');
        singleData.enrollmentNumber = `INCI-ENR-${new Date().getFullYear()}-${num}`;
      }
      
      const res = await prisma.employee.update({
        where: { id },
        data: singleData,
      });
      updates.push(res);
    }
    
    return { count: employeeIds.length };
  } catch (error) {
    console.error('Error bulk updating employee status:', error);
    throw new Error('Impossible de mettre à jour le statut des employés');
  }
}

export async function saveEmployeePhoto(employeeId: string, photoBase64: string) {
  try {
    const data: any = {
      photoUrl: photoBase64,
      status: 'PHOTO_VALIDEE',
    };

    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { enrollmentNumber: true },
    });

    if (emp && !emp.enrollmentNumber) {
      const count = await prisma.employee.count({
        where: { enrollmentNumber: { not: null } },
      });
      const num = String(count + 1).padStart(5, '0');
      data.enrollmentNumber = `INCI-ENR-${new Date().getFullYear()}-${num}`;
    }

    return await prisma.employee.update({
      where: { id: employeeId },
      data,
    });
  } catch (error) {
    console.error('Error saving employee photo:', error);
    throw new Error('Impossible d\'enregistrer la photo de l\'employé');
  }
}

export async function updateEmployeeData(employeeId: string, dynamicData: any) {
  try {
    const oldEmployee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { uniqueIdentifier: true, dynamicData: true },
    });

    if (!oldEmployee) throw new Error("Employé introuvable");

    let uniqueIdentifier = oldEmployee.uniqueIdentifier;

    const oldData = oldEmployee.dynamicData as Record<string, any>;
    if (oldData && typeof oldData === 'object') {
      const uniqueKey = Object.keys(oldData).find(
        (key) => String(oldData[key]).trim() === oldEmployee.uniqueIdentifier
      );
      if (uniqueKey && dynamicData[uniqueKey] !== undefined) {
        uniqueIdentifier = String(dynamicData[uniqueKey]).trim();
      }
    }

    return await prisma.employee.update({
      where: { id: employeeId },
      data: {
        uniqueIdentifier,
        dynamicData,
      },
    });
  } catch (error) {
    console.error('Error updating employee data:', error);
    throw new Error('Impossible de modifier les informations de l\'employé');
  }
}

export async function getDashboardStats() {
  try {
    const [companiesCount, totalEmployees, printedCount, pendingPhotoCount] = await Promise.all([
      prisma.company.count(),
      prisma.employee.count(),
      prisma.employee.count({ where: { status: 'IMPRIME' } }),
      prisma.employee.count({ where: { status: 'A_ENROLER' } }),
    ]);
    return {
      companiesCount,
      totalEmployees,
      printedCount,
      pendingPhotoCount,
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    throw new Error('Impossible de récupérer les statistiques');
  }
}

export async function getCompanyDashboardStats(companyId: string) {
  try {
    const [totalEmployees, printedCount, pendingPhotoCount, validatedPhotoCount] = await Promise.all([
      prisma.employee.count({ where: { companyId } }),
      prisma.employee.count({ where: { companyId, status: 'IMPRIME' } }),
      prisma.employee.count({ where: { companyId, status: 'A_ENROLER' } }),
      prisma.employee.count({ where: { companyId, status: 'PHOTO_VALIDEE' } }),
    ]);
    return {
      totalEmployees,
      printedCount,
      pendingPhotoCount,
      validatedPhotoCount,
    };
  } catch (error) {
    console.error('Error fetching company stats:', error);
    throw new Error('Impossible de récupérer les statistiques de l\'entreprise');
  }
}

export async function getDashboardRecentActivities() {
  try {
    const recentEnrollments = await prisma.employee.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { company: { select: { name: true } } },
    });

    const recentPrints = await prisma.employee.findMany({
      where: { status: 'IMPRIME', printedAt: { not: null } },
      take: 5,
      orderBy: { printedAt: 'desc' },
      include: { company: { select: { name: true } } },
    });

    const activities: Array<{
      id: string;
      type: 'enrollment' | 'print';
      date: Date;
      employeeName: string;
      enrollmentNumber: string | null;
      companyName: string;
    }> = [];

    recentEnrollments.forEach((emp) => {
      const data = emp.dynamicData as Record<string, any>;
      const name = data ? `${data.Prenom || data.prenom || ''} ${data.Nom || data.nom || ''}`.trim() : '';
      activities.push({
        id: `enroll-${emp.id}`,
        type: 'enrollment',
        date: emp.createdAt,
        employeeName: name || emp.uniqueIdentifier,
        enrollmentNumber: emp.enrollmentNumber,
        companyName: emp.company.name,
      });
    });

    recentPrints.forEach((emp) => {
      const data = emp.dynamicData as Record<string, any>;
      const name = data ? `${data.Prenom || data.prenom || ''} ${data.Nom || data.nom || ''}`.trim() : '';
      activities.push({
        id: `print-${emp.id}`,
        type: 'print',
        date: emp.printedAt || emp.createdAt,
        employeeName: name || emp.uniqueIdentifier,
        enrollmentNumber: emp.enrollmentNumber,
        companyName: emp.company.name,
      });
    });

    activities.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    // Return unique items up to 10
    return activities.slice(0, 10);
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    throw new Error('Impossible de récupérer les activités récentes');
  }
}
