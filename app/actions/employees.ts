'use server';

import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

async function computePhotoHash(photoUrl: string): Promise<string> {
  if (photoUrl.startsWith('data:image/')) {
    const base64Data = photoUrl.split(',')[1];
    if (!base64Data) return '';
    const buffer = Buffer.from(base64Data, 'base64');
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  if (photoUrl.startsWith('/image-carte/')) {
    try {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(process.cwd(), 'public', photoUrl);
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        return crypto.createHash('sha256').update(buffer).digest('hex');
      }
    } catch (err) {
      console.warn('Error reading local image for hashing:', err);
    }
  }

  if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
    try {
      const response = await fetch(photoUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image from URL: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return crypto.createHash('sha256').update(buffer).digest('hex');
    } catch (err) {
      console.warn('Error fetching image for hashing:', err);
      return crypto.createHash('sha256').update(photoUrl).digest('hex');
    }
  }

  return crypto.createHash('sha256').update(photoUrl).digest('hex');
}

async function generateEnrollmentNumber(companyId: string): Promise<string> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { identifierPrefix: true },
  });

  const count = await prisma.employee.count({
    where: { 
      companyId: companyId,
      enrollmentNumber: { not: null } 
    },
  });

  if (company?.identifierPrefix) {
    const prefix = company.identifierPrefix;
    const num = String(count + 1).padStart(3, '0');
    return `${prefix}${num}`;
  }

  const physicalType = await prisma.cardPhysicalType.findFirst({
    where: { 
      companyId: companyId || null,
      cardCode: { not: "" }
    },
    orderBy: { createdAt: 'asc' },
  });

  if (physicalType && physicalType.cardCode) {
    const num = String(count + 1).padStart(4, '0');
    return `${physicalType.cardCode}${num}`;
  }

  const num = String(count + 1).padStart(5, '0');
  return `INCI-ENR-${new Date().getFullYear()}-${num}`;
}

export async function getEmployees(companyId: string) {
  try {
    return await prisma.employee.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    console.warn('Error fetching employees:', error);
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
    const session = await getServerSession(authOptions);
    const operatorName = session?.user?.name || session?.user?.email || "Système";

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
          enrolledBy: operatorName,
        },
      });
    });

    await Promise.all(importPromises);
    return { success: true, count: rows.length };
  } catch (error) {
    console.warn('Error importing employees:', error);
    throw new Error('Erreur lors de l\'importation des employés');
  }
}

export async function updateEmployeeStatus(employeeId: string, status: string) {
  try {
    const session = await getServerSession(authOptions);
    const operatorName = session?.user?.name || session?.user?.email || "Système";

    const data: any = { status };
    if (status === 'IMPRIME') {
      data.printedAt = new Date();
      data.printedBy = operatorName;
    }

    if (status === 'PHOTO_VALIDEE' || status === 'IMPRIME') {
      const emp = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { enrollmentNumber: true, companyId: true, enrolledBy: true },
      });
      if (emp) {
        if (!emp.enrollmentNumber) {
          data.enrollmentNumber = await generateEnrollmentNumber(emp.companyId);
        }
        if (!emp.enrolledBy) {
          data.enrolledBy = operatorName;
        }
      }
    }
    
    return await prisma.employee.update({
      where: { id: employeeId },
      data,
    });
  } catch (error) {
    console.warn('Error updating employee status:', error);
    throw new Error('Impossible de mettre à jour le statut de l\'employé');
  }
}

export async function bulkUpdateEmployeeStatus(employeeIds: string[], status: string) {
  try {
    const session = await getServerSession(authOptions);
    const operatorName = session?.user?.name || session?.user?.email || "Système";

    const data: any = { status };
    if (status === 'IMPRIME') {
      data.printedAt = new Date();
      data.printedBy = operatorName;
    }
    
    // Process sequentially to avoid duplicate sequential enrollmentNumbers
    const updates = [];
    for (const id of employeeIds) {
      const emp = await prisma.employee.findUnique({
        where: { id },
        select: { enrollmentNumber: true, companyId: true, enrolledBy: true },
      });
      
      const singleData = { ...data };
      if (emp) {
        if ((status === 'PHOTO_VALIDEE' || status === 'IMPRIME') && !emp.enrollmentNumber) {
          singleData.enrollmentNumber = await generateEnrollmentNumber(emp.companyId);
        }
        if ((status === 'PHOTO_VALIDEE' || status === 'IMPRIME') && !emp.enrolledBy) {
          singleData.enrolledBy = operatorName;
        }
      }
      
      const res = await prisma.employee.update({
        where: { id },
        data: singleData,
      });
      updates.push(res);
    }
    
    return { count: employeeIds.length };
  } catch (error) {
    console.warn('Error bulk updating employee status:', error);
    throw new Error('Impossible de mettre à jour le statut des employés');
  }
}

/**
 * Enregistre la photo d'un employé en base de données.
 * @param employeeId  - ID de l'employé
 * @param photoUrl    - URL publique de la photo (ex: http://localhost:4000/photos/WEBCAM_xxx.jpg)
 *                      ou Base64 en mode hors-ligne (commençant par "data:image/")
 */
export async function saveEmployeePhoto(employeeId: string, photoUrl: string) {
  try {
    const session = await getServerSession(authOptions);
    const operatorName = session?.user?.name || session?.user?.email || "Système";

    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { enrollmentNumber: true, photoHash: true, companyId: true, enrolledBy: true },
    });

    const oldHash = emp?.photoHash;
    const hash = await computePhotoHash(photoUrl);

    // Vérifier si un autre employé utilise déjà cette même photo
    const duplicate = await prisma.employee.findFirst({
      where: {
        photoHash: hash,
        id: { not: employeeId },
      },
    });

    const data: any = {
      photoUrl,
      photoHash: hash,
    };

    if (duplicate) {
      data.photoConflict = true;
      data.status = 'A_VERIFIER';

      // Marquer également le doublon existant comme en conflit
      await prisma.employee.updateMany({
        where: { photoHash: hash },
        data: {
          photoConflict: true,
          status: 'A_VERIFIER',
        },
      });
    } else {
      data.photoConflict = false;
      data.status = 'PHOTO_VALIDEE';
    }

    if (emp && !emp.enrollmentNumber) {
      data.enrollmentNumber = await generateEnrollmentNumber(emp.companyId);
    }

    if (emp && !emp.enrolledBy) {
      data.enrolledBy = operatorName;
    }

    const updatedEmployee = await prisma.employee.update({
      where: { id: employeeId },
      data,
    });

    // Si l'ancien hash est libéré et n'a plus qu'un seul utilisateur restant, on résout le conflit de cet utilisateur restant
    if (oldHash && oldHash !== hash) {
      const remainingWithOldHash = await prisma.employee.findMany({
        where: { photoHash: oldHash },
      });

      if (remainingWithOldHash.length === 1) {
        await prisma.employee.update({
          where: { id: remainingWithOldHash[0].id },
          data: {
            photoConflict: false,
            status: 'PHOTO_VALIDEE',
          },
        });
      }
    }

    return updatedEmployee;
  } catch (error) {
    console.warn('Error saving employee photo:', error);
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
    console.warn('Error updating employee data:', error);
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
    console.warn('Error fetching dashboard stats:', error);
    throw new Error('Impossible de récupérer les statistiques');
  }
}

export async function getCompanyDashboardStats(companyId: string) {
  try {
    const [totalEmployees, printedCount, pendingPhotoCount, validatedPhotoCount, toVerifyCount] = await Promise.all([
      prisma.employee.count({ where: { companyId } }),
      prisma.employee.count({ where: { companyId, status: 'IMPRIME' } }),
      prisma.employee.count({ where: { companyId, status: 'A_ENROLER' } }),
      prisma.employee.count({ where: { companyId, status: 'PHOTO_VALIDEE' } }),
      prisma.employee.count({ where: { companyId, status: 'A_VERIFIER' } }),
    ]);
    return {
      totalEmployees,
      printedCount,
      pendingPhotoCount,
      validatedPhotoCount,
      toVerifyCount,
    };
  } catch (error) {
    console.warn('Error fetching company stats:', error);
    throw new Error('Impossible de récupérer les statistiques de l\'entreprise');
  }
}

export async function getDashboardRecentActivities(page: number = 1, limit: number = 10) {
  try {
    const fetchLimit = page * limit;

    const [recentEnrollments, recentPrints, totalEnrollments, totalPrints] = await Promise.all([
      prisma.employee.findMany({
        take: fetchLimit,
        orderBy: { createdAt: 'desc' },
        include: { company: { select: { name: true } } },
      }),
      prisma.employee.findMany({
        where: { status: 'IMPRIME', printedAt: { not: null } },
        take: fetchLimit,
        orderBy: { printedAt: 'desc' },
        include: { company: { select: { name: true } } },
      }),
      prisma.employee.count(),
      prisma.employee.count({
        where: { status: 'IMPRIME', printedAt: { not: null } },
      }),
    ]);

    const activities: Array<{
      id: string;
      type: 'enrollment' | 'print';
      date: Date;
      employeeName: string;
      enrollmentNumber: string | null;
      companyName: string;
      enrolledBy?: string | null;
      printedBy?: string | null;
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
        enrolledBy: emp.enrolledBy,
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
        printedBy: emp.printedBy,
      });
    });

    activities.sort((a, b) => b.date.getTime() - a.date.getTime());

    const total = totalEnrollments + totalPrints;
    const start = (page - 1) * limit;
    const paginated = activities.slice(start, start + limit);

    return {
      activities: paginated,
      total,
    };
  } catch (error) {
    console.warn('Error fetching recent activities:', error);
    throw new Error('Impossible de récupérer les activités récentes');
  }
}

export async function deleteEmployee(employeeId: string) {
  try {
    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { company: true },
    });

    if (!emp) {
      throw new Error("Employé introuvable");
    }

    if (emp.company.isLocked) {
      throw new Error("L'entreprise de cet employé est verrouillée. Impossible de le supprimer.");
    }

    await prisma.employee.delete({
      where: { id: employeeId },
    });

    return { success: true };
  } catch (error: any) {
    console.warn('Error deleting employee:', error);
    throw new Error(error.message || 'Impossible de supprimer l\'employé');
  }
}
