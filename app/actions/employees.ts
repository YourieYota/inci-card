'use server';

import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

async function getSafeSession() {
  try {
    return await getServerSession(authOptions);
  } catch (e) {
    return null;
  }
}

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

  const docType = await prisma.cardDocumentType.findFirst({
    where: {
      companyId: companyId || null,
      cardCode: { not: "" }
    },
    orderBy: { createdAt: 'asc' },
  });

  if (docType && docType.cardCode) {
    const num = String(count + 1).padStart(4, '0');
    return `${docType.cardCode}${num}`;
  }

  const num = String(count + 1).padStart(5, '0');
  return `INCI-ENR-${new Date().getFullYear()}-${num}`;
}

export async function getEmployees(companyId: string) {
  try {
    const list = await prisma.employee.findMany({
      where: { companyId },
      include: {
        printJobs: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return list.map(emp => {
      const { photoUrl, ...rest } = emp;
      return {
        ...rest,
        photoUrl: null,
        hasPhoto: photoUrl !== null && photoUrl !== '',
      };
    });
  } catch (error) {
    console.warn('Error fetching employees:', error);
    throw new Error('Impossible de récupérer les employés');
  }
}

export async function getEmployeePhoto(employeeId: string) {
  try {
    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { photoUrl: true },
    });
    return emp?.photoUrl || null;
  } catch (error) {
    console.warn('Error fetching employee photo:', error);
    return null;
  }
}

export async function importEmployees({
  companyId,
  uniqueField,
  rows,
  isModificationOnly = false,
}: {
  companyId: string;
  uniqueField: string;
  rows: any[];
  isModificationOnly?: boolean;
}) {
  try {
    const session = await getSafeSession();
    const operatorName = session?.user?.name || session?.user?.email || "Système";

    // 1. Fetch company protect configuration
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { protectAppModified: true },
    });
    const shouldProtect = company?.protectAppModified ?? true;

    // 2. Fetch all existing employees to do fast lookup
    const existingEmployees = await prisma.employee.findMany({
      where: { companyId },
    });
    const existingMap = new Map(existingEmployees.map(emp => [emp.uniqueIdentifier, emp]));

    let addedCount = 0;
    let updatedCount = 0;
    let skippedProtectedCount = 0;

    // 3. Process rows
    const importPromises = rows.map(async (row) => {
      const uniqueVal = row[uniqueField];
      if (uniqueVal === undefined || uniqueVal === null || uniqueVal === '') {
        return; // skip rows without unique identifiers
      }

      const uniqueIdentifier = String(uniqueVal).trim();
      const existingEmployee = existingMap.get(uniqueIdentifier);

      if (existingEmployee) {
        // Guard: check if the employee was modified in the app and is protected
        if (shouldProtect && existingEmployee.appModified) {
          skippedProtectedCount++;
          return;
        }

        if (isModificationOnly) {
          // Compare dynamicData and only update modified fields
          const oldData = (existingEmployee.dynamicData as Record<string, any>) || {};
          const newData = { ...oldData };
          let hasChanges = false;

          Object.entries(row).forEach(([key, value]) => {
            const oldValStr = oldData[key] !== undefined && oldData[key] !== null ? String(oldData[key]).trim() : '';
            const newValStr = value !== undefined && value !== null ? String(value).trim() : '';

            if (oldValStr !== newValStr) {
              newData[key] = value;
              hasChanges = true;
            }
          });

          if (hasChanges) {
            await prisma.employee.update({
              where: { id: existingEmployee.id },
              data: {
                dynamicData: newData,
                updatedAt: new Date(),
              },
            });
            updatedCount++;
          }
        } else {
          // Standard merge import (preserves other existing columns, adds or updates new ones)
          const oldData = (existingEmployee.dynamicData as Record<string, any>) || {};
          await prisma.employee.update({
            where: { id: existingEmployee.id },
            data: {
              dynamicData: { ...oldData, ...row },
              updatedAt: new Date(),
            },
          });
          updatedCount++;
        }
      } else {
        // If not found and we are not in modifications-only mode, create the employee
        if (!isModificationOnly) {
          await prisma.employee.create({
            data: {
              companyId,
              uniqueIdentifier,
              dynamicData: row,
              status: 'A_ENROLER',
              enrolledBy: operatorName,
            },
          });
          addedCount++;
        }
      }
    });

    await Promise.all(importPromises);

    return {
      success: true,
      count: addedCount + updatedCount,
      addedCount,
      updatedCount,
      skippedProtectedCount
    };
  } catch (error) {
    console.warn('Error importing employees:', error);
    throw new Error('Erreur lors de l\'importation des employés');
  }
}

export async function updateEmployeeStatus(employeeId: string, status: string) {
  try {
    const session = await getSafeSession();
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
    const session = await getSafeSession();
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
    const session = await getSafeSession();
    const operatorName = session?.user?.name || session?.user?.email || "Système";

    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { enrollmentNumber: true, photoHash: true, companyId: true, enrolledBy: true, isLocked: true },
    });

    // Guard: reject photo changes on locked employees
    if (emp?.isLocked) {
      throw new Error("Cette fiche est verrouillée (badge imprimé). Demandez une réimpression pour modifier la photo.");
    }

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

export async function updateEmployeeData(employeeId: string, dynamicData: any, appModified?: boolean) {
  try {
    const oldEmployee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { uniqueIdentifier: true, dynamicData: true, isLocked: true },
    });

    if (!oldEmployee) throw new Error("Employé introuvable");

    // Guard: reject modifications on locked employees
    if (oldEmployee.isLocked) {
      throw new Error("Cette fiche est verrouillée (badge imprimé). Demandez une réimpression pour effectuer des modifications.");
    }

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
        appModified: appModified !== undefined ? appModified : true,
        updatedAt: new Date(),
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

// ============================================
// WORKFLOW D'IMPRESSION
// ============================================

/**
 * Génère un numéro de carte unique basé sur le cardCode du type de document.
 * Format: {cardCode}-{séquence} (ex: BADGE-0001)
 */
async function generateCardNumber(companyId: string, templateType: string): Promise<string> {
  // 1. Try to find the cardCode from the document type
  const docType = await prisma.cardDocumentType.findFirst({
    where: {
      slug: templateType,
      OR: [
        { companyId },
        { companyId: null }
      ]
    },
  });

  let prefix = templateType.toUpperCase();
  if (docType?.cardCode) {
    prefix = docType.cardCode;
  }

  // 2. Count existing PrintJobs for this company to generate sequential number
  const count = await prisma.printJob.count({
    where: {
      employee: {
        companyId,
      },
    },
  });

  const seq = String(count + 1).padStart(4, '0');
  return `${prefix}-${seq}`;
}

/**
 * Vérifie l'éligibilité à l'impression pour une liste d'employés.
 * Retourne les employés éligibles et les raisons d'inéligibilité.
 */
export async function validatePrintEligibility(employeeIds: string[]) {
  try {
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      include: {
        company: { select: { name: true } },
      },
    });

    const eligible: typeof employees = [];
    const ineligible: { employee: typeof employees[0]; reasons: string[] }[] = [];

    for (const emp of employees) {
      const reasons: string[] = [];

      // 1. Photo must be present
      if (!emp.photoUrl) {
        reasons.push('Photo manquante');
      }

      // 2. Status must be PHOTO_VALIDEE or REIMPRESSION
      if (emp.status !== 'PHOTO_VALIDEE' && emp.status !== 'REIMPRESSION') {
        if (emp.status === 'A_ENROLER') {
          reasons.push('Fiche non validée (en attente d\'enrôlement)');
        } else if (emp.status === 'A_VERIFIER') {
          reasons.push('Fiche en attente de vérification (conflit photo)');
        } else if (emp.status === 'IMPRIME' && emp.isLocked) {
          reasons.push('Badge déjà imprimé et verrouillé (demandez une réimpression)');
        }
      }

      // 3. Badge must not be blocked
      if (emp.isBlocked) {
        reasons.push('Badge bloqué');
      }

      if (reasons.length === 0) {
        eligible.push(emp);
      } else {
        ineligible.push({ employee: emp, reasons });
      }
    }

    return { eligible, ineligible };
  } catch (error) {
    console.warn('Error validating print eligibility:', error);
    throw new Error('Impossible de valider l\'éligibilité à l\'impression');
  }
}

/**
 * Confirme l'impression : génère un numéro de carte, verrouille la fiche,
 * crée un PrintJob pour chaque employé.
 */
export async function confirmPrint(
  employeeIds: string[],
  templateType: string,
  categoryId?: string,
  physicalTypeId?: string
) {
  try {
    const session = await getSafeSession();
    const operatorName = session?.user?.name || session?.user?.email || "Système";

    // Validate eligibility first
    const { eligible, ineligible } = await validatePrintEligibility(employeeIds);

    if (eligible.length === 0) {
      const reasons = ineligible.map(i => {
        const data = i.employee.dynamicData as Record<string, any>;
        const name = data ? `${data.Prenom || data.prenom || ''} ${data.Nom || data.nom || ''}`.trim() : i.employee.uniqueIdentifier;
        return `${name}: ${i.reasons.join(', ')}`;
      }).join('\n');
      throw new Error(`Aucun employé éligible à l'impression.\n${reasons}`);
    }

    const results = [];

    for (const emp of eligible) {
      // Generate unique card number
      const cardNumber = await generateCardNumber(emp.companyId, templateType);

      // Determine if this is a reprint
      const isReprint = emp.printCount > 0 || emp.status === 'REIMPRESSION' || emp.status === 'REIMPRIME';

      // Get reprint reason from the last reprint request if applicable
      let reprintReason: string | null = null;
      if (isReprint) {
        const lastJob = await prisma.printJob.findFirst({
          where: { 
            employeeId: emp.id,
            templateType: templateType,
            cardNumber: 'REIMPRESSION_DEMANDEE'
          },
          orderBy: { createdAt: 'desc' },
        });
        reprintReason = lastJob?.reprintReason || null;
      }

      // Create PrintJob record
      await prisma.printJob.create({
        data: {
          employeeId: emp.id,
          cardNumber,
          templateType,
          categoryId: categoryId || null,
          physicalTypeId: physicalTypeId || null,
          isReprint,
          reprintReason,
          printedBy: operatorName,
        },
      });

      const newStatus = isReprint ? 'REIMPRIME' : 'IMPRIME';

      // Update employee: lock, update cardNumber, increment printCount
      const updated = await prisma.employee.update({
        where: { id: emp.id },
        data: {
          cardNumber,
          status: newStatus,
          isLocked: true,
          printCount: { increment: 1 },
          printedAt: new Date(),
          printedBy: operatorName,
        },
      });

      results.push(updated);
    }

    return {
      printed: results,
      skipped: ineligible,
    };
  } catch (error: any) {
    console.warn('Error confirming print:', error);
    throw new Error(error.message || 'Impossible de confirmer l\'impression');
  }
}

/**
 * Demande une réimpression : déverrouille temporairement la fiche
 * et enregistre le motif de réimpression.
 */
export async function requestReprint(employeeId: string, reason: string, templateType: string) {
  try {
    if (!reason || !reason.trim()) {
      throw new Error('Un motif de réimpression est obligatoire.');
    }
    if (!templateType || !templateType.trim()) {
      throw new Error('Un type de document est obligatoire pour la réimpression.');
    }

    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { status: true, isLocked: true, isBlocked: true },
    });

    if (!emp) throw new Error('Employé introuvable');
    if (emp.isBlocked) throw new Error('Ce badge est bloqué. Débloquez-le avant de demander une réimpression.');
    if (emp.status !== 'IMPRIME' && emp.status !== 'REIMPRIME' && !emp.isLocked) {
      throw new Error('La réimpression ne peut être demandée que pour un badge déjà imprimé ou réimprimé.');
    }

    // Create a PrintJob entry with the reprint reason (will be used during confirmPrint)
    const session = await getSafeSession();
    const operatorName = session?.user?.name || session?.user?.email || "Système";

    // Create a placeholder PrintJob to record the reprint reason
    await prisma.printJob.create({
      data: {
        employeeId,
        cardNumber: 'REIMPRESSION_DEMANDEE',
        templateType: templateType,
        isReprint: true,
        reprintReason: reason.trim(),
        printedBy: operatorName,
      },
    });

    // Unlock and set status to REIMPRESSION
    return await prisma.employee.update({
      where: { id: employeeId },
      data: {
        status: 'REIMPRESSION',
        isLocked: false,
      },
    });
  } catch (error: any) {
    console.warn('Error requesting reprint:', error);
    throw new Error(error.message || 'Impossible de demander la réimpression');
  }
}

/**
 * Bloque un badge (admin only).
 */
export async function blockBadge(employeeId: string) {
  try {
    const session = await getSafeSession();
    const user = session?.user as any;
    if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
      throw new Error('Seuls les administrateurs peuvent bloquer un badge.');
    }

    return await prisma.employee.update({
      where: { id: employeeId },
      data: { isBlocked: true },
    });
  } catch (error: any) {
    console.warn('Error blocking badge:', error);
    throw new Error(error.message || 'Impossible de bloquer le badge');
  }
}

/**
 * Débloque un badge avec un motif obligatoire (admin only).
 */
export async function unblockBadge(employeeId: string, reason: string) {
  try {
    if (!reason || !reason.trim()) {
      throw new Error('Un motif de déblocage est obligatoire.');
    }

    const session = await getSafeSession();
    const user = session?.user as any;
    if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
      throw new Error('Seuls les administrateurs peuvent débloquer un badge.');
    }

    const operatorName = session?.user?.name || session?.user?.email || "Système";

    // Record the unblock action as a PrintJob entry for audit trail
    await prisma.printJob.create({
      data: {
        employeeId,
        cardNumber: 'DEBLOCAGE',
        templateType: 'DEBLOCAGE',
        isReprint: false,
        reprintReason: `Déblocage: ${reason.trim()}`,
        printedBy: operatorName,
      },
    });

    return await prisma.employee.update({
      where: { id: employeeId },
      data: { isBlocked: false },
    });
  } catch (error: any) {
    console.warn('Error unblocking badge:', error);
    throw new Error(error.message || 'Impossible de débloquer le badge');
  }
}

/**
 * Récupère l'historique d'impression d'un employé.
 */
export async function getEmployeePrintHistory(employeeId: string) {
  try {
    return await prisma.printJob.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    console.warn('Error fetching print history:', error);
    throw new Error('Impossible de récupérer l\'historique d\'impression');
  }
}

export async function getEmployeesPhotos(employeeIds: string[]) {
  try {
    const list = await prisma.employee.findMany({
      where: {
        id: { in: employeeIds },
      },
      select: {
        id: true,
        photoUrl: true,
      },
    });
    
    const photoMap: Record<string, string | null> = {};
    list.forEach(emp => {
      photoMap[emp.id] = emp.photoUrl;
    });
    return photoMap;
  } catch (error) {
    console.warn('Error fetching employees photos:', error);
    throw new Error('Impossible de récupérer les photos des employés');
  }
}
