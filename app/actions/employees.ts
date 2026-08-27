'use server';
import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/prisma';
import { extractCategoryFromDynamicData } from '@/lib/categoryUtils';
import crypto from 'crypto';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

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
      const { photoUrl, createdAt, updatedAt, printedAt, printJobs, ...rest } = emp;
      return {
        ...rest,
        photoUrl: null,
        hasPhoto: photoUrl !== null && photoUrl !== '',
        createdAt: createdAt ? createdAt.toISOString() : null,
        updatedAt: updatedAt ? updatedAt.toISOString() : null,
        printedAt: printedAt ? printedAt.toISOString() : null,
        printJobs: (printJobs || []).map(j => ({
          ...j,
          createdAt: j.createdAt ? j.createdAt.toISOString() : null,
          printedAt: j.printedAt ? j.printedAt.toISOString() : null,
        })),
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

    function getFieldGroup(fieldKey: string): string {
      const norm = fieldKey.trim().toLowerCase();
      if (
        norm.includes("ordre") ||
        norm === "n° d'ordre" || norm === "numéro d'ordre" || norm === "numero d'ordre" ||
        norm === "n°ordre" || norm === "n° ordre" || norm === "numero ordre" ||
        norm === "no d'ordre" || norm === "no ordre" || norm === "n d'ordre" || norm === "n ordre"
      ) {
        return "ORDRE";
      }
      if (norm === "n°" || norm === "numéro" || norm === "numero" || norm === "no" || norm === "no." || norm === "num" || norm === "n") {
        return "NUMERO_SIMPLE";
      }
      if (norm.includes("matricule") || norm === "mat") {
        return "MATRICULE";
      }
      if (norm.includes("nni") || norm === "n.n.i") {
        return "NNI";
      }
      return norm;
    }

    function getFieldAliases(fieldKey: string): string[] {
      const norm = fieldKey.trim().toLowerCase();
      if (getFieldGroup(fieldKey) === "ORDRE") {
        return [
          "n° d'ordre", "numéro d'ordre", "numero d'ordre", "n°ordre", "n° ordre",
          "numero ordre", "no d'ordre", "no ordre", "n d'ordre", "n ordre", "ordre"
        ];
      }
      if (getFieldGroup(fieldKey) === "NUMERO_SIMPLE") {
        return ["n°", "numéro", "numero", "no", "no.", "num"];
      }
      if (getFieldGroup(fieldKey) === "MATRICULE") {
        return ["matricule", "mat", "n° matricule", "numéro matricule", "numero matricule"];
      }
      if (getFieldGroup(fieldKey) === "NNI") {
        return ["nni", "n.n.i", "n° nni", "numéro nni", "numero nni"];
      }
      return [norm];
    }

    // Build smart lookup index maps for exact matching by uniqueIdentifier and target dynamicData fields
    const lookupMap = new Map<string, typeof existingEmployees[0]>();
    existingEmployees.forEach(emp => {
      // 1. Index by emp.uniqueIdentifier
      if (emp.uniqueIdentifier) {
        const uidTrim = String(emp.uniqueIdentifier).trim().toLowerCase();
        if (uidTrim) {
          lookupMap.set(`uid::${uidTrim}`, emp);
        }
      }

      // 2. Index by emp.enrollmentNumber if present
      if (emp.enrollmentNumber) {
        const enrTrim = String(emp.enrollmentNumber).trim().toLowerCase();
        if (enrTrim) {
          lookupMap.set(`enr::${enrTrim}`, emp);
        }
      }

      // 3. Index dynamicData fields strictly under their explicit key (e.g. "matricule::123", "n°::179")
      const dyn = (emp.dynamicData && typeof emp.dynamicData === 'object' && !Array.isArray(emp.dynamicData))
        ? (emp.dynamicData as Record<string, any>)
        : {};

      Object.entries(dyn).forEach(([k, v]) => {
        if (v !== undefined && v !== null && String(v).trim()) {
          const valTrim = String(v).trim().toLowerCase();
          const keyTrim = k.trim().toLowerCase();
          const valKey = `${keyTrim}::${valTrim}`;
          if (!lookupMap.has(valKey)) {
            lookupMap.set(valKey, emp);
          }
        }
      });
    });

    const findExistingEmployee = (fieldKey: string, fieldVal: string) => {
      const valTrim = String(fieldVal).trim().toLowerCase();
      if (!valTrim) return undefined;

      // 1. Check direct match on emp.uniqueIdentifier
      if (lookupMap.has(`uid::${valTrim}`)) {
        return lookupMap.get(`uid::${valTrim}`);
      }

      // 2. Check direct match on emp.enrollmentNumber
      if (lookupMap.has(`enr::${valTrim}`)) {
        return lookupMap.get(`enr::${valTrim}`);
      }

      // 3. Check match by exact fieldKey in dynamicData (e.g. "n°::179" or "matricule::contractuel")
      const fieldKeyTrim = fieldKey.trim().toLowerCase();
      const exactKey = `${fieldKeyTrim}::${valTrim}`;
      if (lookupMap.has(exactKey)) {
        return lookupMap.get(exactKey);
      }

      // 4. Check match by field aliases in dynamicData (e.g., if fieldKey is "N°", check "numéro::179", "n°::179", etc.)
      const aliases = getFieldAliases(fieldKey);
      for (const alias of aliases) {
        const aliasKey = `${alias}::${valTrim}`;
        if (lookupMap.has(aliasKey)) {
          return lookupMap.get(aliasKey);
        }
      }

      return undefined;
    };

    let addedCount = 0;
    let updatedCount = 0;
    let skippedProtectedCount = 0;
    let skippedDuplicateCount = 0;

    // Helper for robust identifier extraction from row data (no random fallback to 1st column)
    const getCleanedRowVal = (r: Record<string, any>, targetKey: string) => {
      if (r[targetKey] !== undefined && r[targetKey] !== null && String(r[targetKey]).trim() !== '') {
        return r[targetKey];
      }
      const trimmedTarget = targetKey.trim().toLowerCase();
      const foundKey = Object.keys(r).find(k => k.trim().toLowerCase() === trimmedTarget);
      if (foundKey && r[foundKey] !== undefined && r[foundKey] !== null && String(r[foundKey]).trim() !== '') {
        return r[foundKey];
      }
      return undefined;
    };

    // 3. Process rows sequentially
    for (const row of rows) {
      try {
        // Extract photo if present and remove it from row data to prevent DB JSON bloat
        const { _photoBase64, ...cleanedRow } = row;

        const uniqueVal = getCleanedRowVal(cleanedRow, uniqueField);
        if (uniqueVal === undefined || uniqueVal === null || String(uniqueVal).trim() === '') {
          continue; // skip rows without unique identifiers
        }

        const uniqueIdentifier = String(uniqueVal).trim();
        const existingEmployee = findExistingEmployee(uniqueField, uniqueIdentifier);

        if (existingEmployee) {
          // Standard import mode (isModificationOnly = false):
          // DO NOT modify existing employees. Skip duplicates to preserve existing data!
          if (!isModificationOnly) {
            skippedDuplicateCount++;
            continue;
          }

          // Guard: check if the employee was modified in the app and is protected
          if (shouldProtect && existingEmployee.appModified) {
            skippedProtectedCount++;
            continue;
          }

          // Process photo if present for modification mode
          let photoData: any = {};
          if (_photoBase64) {
            const hash = await computePhotoHash(_photoBase64);
            const duplicate = await prisma.employee.findFirst({
              where: {
                photoHash: hash,
                id: { not: existingEmployee.id },
              },
            });

            photoData = {
              photoUrl: _photoBase64,
              photoHash: hash,
            };

            if (duplicate) {
              photoData.photoConflict = true;
              photoData.status = 'A_VERIFIER';
              
              await prisma.employee.updateMany({
                where: { photoHash: hash },
                data: {
                  photoConflict: true,
                  status: 'A_VERIFIER',
                },
              });
            } else {
              photoData.photoConflict = false;
              photoData.status = 'PHOTO_VALIDEE';
            }

            if (photoData.status === 'PHOTO_VALIDEE') {
              const hasEnrollment = !!existingEmployee.enrollmentNumber;
              if (!hasEnrollment) {
                photoData.enrollmentNumber = await generateEnrollmentNumber(companyId);
              }
              const hasEnrolledBy = !!existingEmployee.enrolledBy;
              if (!hasEnrolledBy) {
                photoData.enrolledBy = operatorName;
              }
            }
          }

          // Compare dynamicData and update modified or new fields for modification mode
          const oldData = (existingEmployee.dynamicData && typeof existingEmployee.dynamicData === 'object' && !Array.isArray(existingEmployee.dynamicData))
            ? (existingEmployee.dynamicData as Record<string, any>)
            : {};
          const newData = { ...oldData };
          let hasChanges = false;

          const parseDateForComp = (dStr: string) => {
            if (!dStr) return '';
            if (dStr.includes('/')) {
              const parts = dStr.split('/');
              if (parts.length === 3) {
                return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
              }
            }
            if (dStr.includes('T')) {
              const dateObj = new Date(dStr);
              if (!isNaN(dateObj.getTime())) {
                const day = String(dateObj.getUTCDate()).padStart(2, '0');
                const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
                const year = dateObj.getUTCFullYear();
                return `${day}/${month}/${year}`;
              }
            }
            return dStr;
          };

          Object.entries(cleanedRow).forEach(([key, value]) => {
            const trimmedKey = key.trim().toLowerCase();
            const existingOldKey = Object.keys(oldData).find(k => k.trim().toLowerCase() === trimmedKey) || key;
            const rawOldVal = oldData[existingOldKey];

            const oldValStr = rawOldVal !== undefined && rawOldVal !== null ? String(rawOldVal).trim() : '';
            const newValStr = value !== undefined && value !== null ? String(value).trim() : '';

            const isDateKey = trimmedKey.includes('date') || trimmedKey.includes('naiss');
            const compOld = isDateKey ? parseDateForComp(oldValStr) : oldValStr;
            const compNew = isDateKey ? parseDateForComp(newValStr) : newValStr;

            if (compOld !== compNew) {
              if (existingOldKey !== key && existingOldKey in newData) {
                delete newData[existingOldKey];
              }
              newData[key] = value;
              hasChanges = true;
            }
          });

          if (hasChanges || _photoBase64) {
            await prisma.employee.update({
              where: { id: existingEmployee.id },
              data: {
                dynamicData: newData,
                updatedAt: new Date(),
                ...photoData,
              },
            });
            updatedCount++;
          } else {
            skippedDuplicateCount++;
          }
        } else {
          // If not found and we are not in modifications-only mode, create the employee
          if (!isModificationOnly) {
            let photoData: any = {};
            if (_photoBase64) {
              const hash = await computePhotoHash(_photoBase64);
              const duplicate = await prisma.employee.findFirst({
                where: { photoHash: hash },
              });

              photoData = {
                photoUrl: _photoBase64,
                photoHash: hash,
              };

              if (duplicate) {
                photoData.photoConflict = true;
                photoData.status = 'A_VERIFIER';
                
                await prisma.employee.updateMany({
                  where: { photoHash: hash },
                  data: {
                    photoConflict: true,
                    status: 'A_VERIFIER',
                  },
                });
              } else {
                photoData.photoConflict = false;
                photoData.status = 'PHOTO_VALIDEE';
              }

              if (photoData.status === 'PHOTO_VALIDEE') {
                photoData.enrollmentNumber = await generateEnrollmentNumber(companyId);
                photoData.enrolledBy = operatorName;
              }
            }

            await prisma.employee.create({
              data: {
                companyId,
                uniqueIdentifier,
                dynamicData: cleanedRow,
                status: _photoBase64 ? (photoData.status || 'A_ENROLER') : 'A_ENROLER',
                enrolledBy: _photoBase64 ? (photoData.enrolledBy || operatorName) : operatorName,
                ...photoData,
              },
            });
            addedCount++;
          }
        }
      } catch (rowErr: any) {
        console.error("Erreur lors du traitement d'une ligne d'importation :", rowErr);
      }
    }

    return {
      success: true,
      count: addedCount + updatedCount,
      addedCount,
      updatedCount,
      skippedProtectedCount,
      skippedDuplicateCount
    };
  } catch (error: any) {
    console.warn('Error importing employees:', error);
    return {
      success: false,
      error: error?.message || "Erreur lors de l'importation des employés",
      count: 0,
      addedCount: 0,
      updatedCount: 0,
      skippedProtectedCount: 0,
      skippedDuplicateCount: 0,
    };
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

    const result = await prisma.employee.update({
      where: { id: employeeId },
      data,
    });
    revalidatePath('/dashboard', 'layout');
    return result;
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

    const result = await prisma.employee.update({
      where: { id: employeeId },
      data: {
        uniqueIdentifier,
        dynamicData,
        appModified: appModified !== undefined ? appModified : true,
        updatedAt: new Date(),
      },
    });
    revalidatePath('/dashboard', 'layout');
    return result;
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

export async function deleteEmployeesBulk({
  companyId,
  uniqueField,
  rows,
}: {
  companyId: string;
  uniqueField: string;
  rows: any[];
}) {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { isLocked: true, protectAppModified: true },
    });

    if (!company) {
      throw new Error("Entreprise introuvable");
    }

    if (company.isLocked) {
      throw new Error("L'entreprise est verrouillée. Impossible de supprimer ses employés.");
    }

    const shouldProtect = company.protectAppModified ?? true;

    // Extract unique identifier values from rows
    const uniqueVals = rows
      .map((row) => {
        const val = row[uniqueField];
        return val !== undefined && val !== null ? String(val).trim() : null;
      })
      .filter((val): val is string => val !== null && val !== '');

    if (uniqueVals.length === 0) {
      return { success: true, count: 0, skippedProtectedCount: 0, deletedEmployees: [] };
    }

    // Find employees that match
    const employees = await prisma.employee.findMany({
      where: {
        companyId,
        uniqueIdentifier: { in: uniqueVals },
      },
    });

    let deleteIds: string[] = [];
    let skippedProtectedCount = 0;
    let deletedEmployees: any[] = [];

    for (const emp of employees) {
      if (shouldProtect && emp.appModified) {
        skippedProtectedCount++;
        continue;
      }
      deleteIds.push(emp.id);
      deletedEmployees.push(emp);
    }

    if (deleteIds.length > 0) {
      await prisma.employee.deleteMany({
        where: {
          id: { in: deleteIds },
        },
      });
    }

    return {
      success: true,
      count: deleteIds.length,
      skippedProtectedCount,
      deletedEmployees,
    };
  } catch (error: any) {
    console.warn('Error bulk deleting employees:', error);
    throw new Error(error.message || 'Impossible d\'effectuer la suppression groupée');
  }
}

export async function deleteEmployeesByIds(employeeIds: string[]) {
  try {
    if (employeeIds.length === 0) {
      return { success: true, count: 0, skippedProtectedCount: 0, deletedEmployees: [] };
    }

    // Fetch the employees and check their companies' lock state
    const employees = await prisma.employee.findMany({
      where: {
        id: { in: employeeIds },
      },
      include: {
        company: true,
      },
    });

    const lockedCompany = employees.find((emp) => emp.company.isLocked);
    if (lockedCompany) {
      throw new Error(`L'entreprise "${lockedCompany.company.name}" est verrouillée. Impossible de supprimer ses employés.`);
    }

    // Check if we should protect app-modified sheets
    const companyIds = Array.from(new Set(employees.map(emp => emp.companyId)));
    const companies = await prisma.company.findMany({
      where: { id: { in: companyIds } },
      select: { id: true, protectAppModified: true }
    });
    const protectMap = new Map(companies.map(c => [c.id, c.protectAppModified ?? true]));

    let deleteIds: string[] = [];
    let skippedProtectedCount = 0;
    let deletedEmployees: any[] = [];

    for (const emp of employees) {
      const shouldProtect = protectMap.get(emp.companyId) ?? true;
      if (shouldProtect && emp.appModified) {
        skippedProtectedCount++;
        continue;
      }
      deleteIds.push(emp.id);
      
      const { company, ...empRest } = emp;
      deletedEmployees.push(empRest);
    }

    if (deleteIds.length > 0) {
      await prisma.employee.deleteMany({
        where: {
          id: { in: deleteIds },
        },
      });
    }

    return {
      success: true,
      count: deleteIds.length,
      skippedProtectedCount,
      deletedEmployees,
    };
  } catch (error: any) {
    console.warn('Error deleting employees by IDs:', error);
    throw new Error(error.message || 'Impossible de supprimer les employés sélectionnés');
  }
}

export async function purgeEmployees({
  companyId,
  uniqueField,
  rows,
}: {
  companyId: string;
  uniqueField: string;
  rows: any[];
}) {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { isLocked: true, protectAppModified: true },
    });

    if (!company) {
      throw new Error("Entreprise introuvable");
    }

    if (company.isLocked) {
      throw new Error("L'entreprise est verrouillée. Impossible de purger ses employés.");
    }

    const shouldProtect = company.protectAppModified ?? true;

    // Extract unique identifier values from rows
    const uniqueValsInFile = rows
      .map((row) => {
        const val = row[uniqueField];
        return val !== undefined && val !== null ? String(val).trim() : null;
      })
      .filter((val): val is string => val !== null && val !== '');

    // Find all employees currently in database for this company
    const allDbEmployees = await prisma.employee.findMany({
      where: { companyId },
    });

    // Find database employees whose uniqueIdentifier is NOT in the file
    let deleteIds: string[] = [];
    let skippedProtectedCount = 0;
    let deletedEmployees: any[] = [];

    for (const emp of allDbEmployees) {
      const isPresentInFile = uniqueValsInFile.includes(emp.uniqueIdentifier);
      if (!isPresentInFile) {
        if (shouldProtect && emp.appModified) {
          skippedProtectedCount++;
          continue;
        }
        deleteIds.push(emp.id);
        deletedEmployees.push(emp);
      }
    }

    if (deleteIds.length > 0) {
      await prisma.employee.deleteMany({
        where: {
          id: { in: deleteIds },
        },
      });
    }

    return {
      success: true,
      count: deleteIds.length,
      skippedProtectedCount,
      deletedEmployees,
    };
  } catch (error: any) {
    console.warn('Error purging employees:', error);
    throw new Error(error.message || 'Impossible d\'effectuer la purge');
  }
}

export async function restoreEmployees(employees: any[]) {
  try {
    if (employees.length === 0) {
      return { success: true, count: 0 };
    }

    const results = [];
    for (const emp of employees) {
      const created = await prisma.employee.upsert({
        where: {
          companyId_uniqueIdentifier: {
            companyId: emp.companyId,
            uniqueIdentifier: emp.uniqueIdentifier,
          },
        },
        update: {
          dynamicData: emp.dynamicData,
          photoUrl: emp.photoUrl,
          photoHash: emp.photoHash,
          photoConflict: emp.photoConflict || false,
          enrollmentNumber: emp.enrollmentNumber,
          cardNumber: emp.cardNumber,
          status: emp.status,
          isLocked: emp.isLocked || false,
          isBlocked: emp.isBlocked || false,
          appModified: emp.appModified || false,
          printCount: emp.printCount || 0,
          printedAt: emp.printedAt ? new Date(emp.printedAt) : null,
          enrolledBy: emp.enrolledBy,
          printedBy: emp.printedBy,
        },
        create: {
          id: emp.id,
          companyId: emp.companyId,
          dynamicData: emp.dynamicData,
          uniqueIdentifier: emp.uniqueIdentifier,
          photoUrl: emp.photoUrl,
          photoHash: emp.photoHash,
          photoConflict: emp.photoConflict || false,
          enrollmentNumber: emp.enrollmentNumber,
          cardNumber: emp.cardNumber,
          status: emp.status,
          isLocked: emp.isLocked || false,
          isBlocked: emp.isBlocked || false,
          appModified: emp.appModified || false,
          printCount: emp.printCount || 0,
          printedAt: emp.printedAt ? new Date(emp.printedAt) : null,
          enrolledBy: emp.enrolledBy,
          printedBy: emp.printedBy,
        },
      });
      results.push(created);
    }

    return { success: true, count: results.length };
  } catch (error: any) {
    console.warn('Error restoring employees:', error);
    throw new Error(error.message || 'Impossible de restaurer les employés');
  }
}


// ============================================
// WORKFLOW D'IMPRESSION
// ============================================

/**
 * Génère un numéro de carte unique basé sur le cardCode du type de document.
 * Format: {cardCode}-{séquence} (ex: BADGE-0001)
 */


/**
 * Génère un numéro de carte unique basé sur le cardCode du type de document ou de la catégorie.
 * Format: {cardCode}{séquence} (ex: BADGE0001, AGRAC0001)
 */
async function generateCardNumber(
  companyId: string, 
  templateType: string, 
  categoryId?: string, 
  overridePrefix?: string,
  extraExcludedNumbers?: Set<string> | string[] | Array<string>
): Promise<string> {
  let prefix = overridePrefix || '';

  if (!prefix) {
    let category: any = null;

    // 1. Try finding company-specific category first if categoryId is provided
    if (categoryId && companyId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryId);
      if (isUuid) {
        category = await prisma.cardCategory.findFirst({
          where: { id: categoryId, companyId },
        });
      }
      if (!category) {
        category = await prisma.cardCategory.findFirst({
          where: {
            companyId,
            OR: [
              { id: categoryId },
              { name: { equals: categoryId, mode: 'insensitive' } },
              { slug: { equals: categoryId, mode: 'insensitive' } },
              { cardCode: { equals: categoryId, mode: 'insensitive' } },
              { documentTypeSlug: { equals: templateType, mode: 'insensitive' } }
            ]
          }
        });
      }
    }

    // 2. If no specific category matched yet, find ANY company-specific category with a cardCode for this company
    if (!category && companyId) {
      category = await prisma.cardCategory.findFirst({
        where: {
          companyId,
          NOT: { cardCode: "" }
        },
        orderBy: { updatedAt: 'desc' }
      });
    }

    // 3. Fallback to global category (companyId = null) only if no company category exists
    if (!category && categoryId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryId);
      if (isUuid) {
        category = await prisma.cardCategory.findUnique({
          where: { id: categoryId },
        });
      } else {
        category = await prisma.cardCategory.findFirst({
          where: {
            companyId: null,
            OR: [
              { name: { equals: categoryId, mode: 'insensitive' } },
              { slug: { equals: categoryId, mode: 'insensitive' } },
              { cardCode: { equals: categoryId, mode: 'insensitive' } }
            ]
          }
        });
      }
    }

    // Extract prefix from resolved category
    if (category) {
      if (category.cardCode && category.cardCode.trim() !== '') {
        prefix = category.cardCode.trim();
      } else if (category.slug) {
        prefix = category.slug.toUpperCase().replace(/[^A-Z0-9]/g, '');
      } else if (category.name) {
        prefix = category.name.toUpperCase().replace(/[^A-Z0-9]/g, '');
      }
    }

    // 4. Fallback to Document Type if category has no code
    if (!prefix) {
      const docType = await prisma.cardDocumentType.findFirst({
        where: {
          slug: templateType,
          companyId,
        },
      });
      if (docType?.cardCode && docType.cardCode.trim() !== '') {
        prefix = docType.cardCode.trim();
      }
    }

    // 5. Ultimate fallback to templateType
    if (!prefix) {
      prefix = templateType.toUpperCase();
    }
  }

  // 3. Find all card numbers containing this prefix in Employee and PrintJob tables
  const employeeCardNumbers = await prisma.employee.findMany({
    where: { 
      companyId, 
      cardNumber: { contains: prefix } 
    },
    select: { cardNumber: true }
  });

  const printJobCardNumbers = await prisma.printJob.findMany({
    where: { 
      OR: [
        { employee: { companyId } },
        { categoryId: categoryId || undefined }
      ],
      cardNumber: { contains: prefix, not: 'REIMPRESSION_DEMANDEE' } 
    },
    select: { cardNumber: true }
  });

  const allNumbers = new Set<string>();
  employeeCardNumbers.forEach(e => {
    if (e.cardNumber) allNumbers.add(e.cardNumber.trim());
  });
  printJobCardNumbers.forEach(p => {
    if (p.cardNumber) allNumbers.add(p.cardNumber.trim());
  });
  if (extraExcludedNumbers) {
    extraExcludedNumbers.forEach(n => {
      if (n) allNumbers.add(n.trim());
    });
  }

  let maxSeq = 0;
  const prefixUpper = prefix.toUpperCase();

  allNumbers.forEach(num => {
    if (!num) return;
    const numUpper = num.toUpperCase().trim();
    const idx = numUpper.indexOf(prefixUpper);
    if (idx === -1) return;

    // Extract the portion strictly AFTER prefixUpper
    const suffix = numUpper.slice(idx + prefixUpper.length);
    const seqMatch = suffix.match(/^\d+/);
    if (seqMatch) {
      const seqVal = parseInt(seqMatch[0], 10);
      if (!isNaN(seqVal) && seqVal > maxSeq) {
        maxSeq = seqVal;
      }
    }
  });

  const nextSeq = maxSeq + 1;
  const seq = String(nextSeq).padStart(4, '0');
  const resultCardNumber = `${prefix}${seq}`;

  if (extraExcludedNumbers instanceof Set) {
    extraExcludedNumbers.add(resultCardNumber);
  }

  return resultCardNumber;
}

/**
 * Vérifie l'éligibilité à l'impression pour une liste d'employés.
 * Retourne les employés éligibles et les raisons d'inéligibilité.
 */
export async function validatePrintEligibility(employeeIds: string[], templateType?: string) {
  try {
    const fetchedEmployees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      include: {
        company: { select: { name: true } },
        printJobs: true,
      },
    });

    // Re-order fetched employees to match the EXACT selection sequence from `employeeIds` parameter
    const empMap = new Map(fetchedEmployees.map(e => [e.id, e]));
    const employees = employeeIds.map(id => empMap.get(id)).filter(Boolean) as typeof fetchedEmployees;

    const eligible: typeof employees = [];
    const ineligible: { employee: typeof employees[0]; reasons: string[] }[] = [];

    for (const emp of employees) {
      const reasons: string[] = [];

      // 1. Photo must be present
      if (!emp.photoUrl) {
        reasons.push('Photo manquante');
      }

      // 2. Status & Lock check per templateType
      if (templateType) {
        const hasJob = emp.printJobs?.some((j: any) => 
          j.templateType === templateType && 
          j.cardNumber !== 'REIMPRESSION_DEMANDEE'
        );
        const hasReprintRequest = emp.printJobs?.some((j: any) => 
          j.templateType === templateType && 
          j.cardNumber === 'REIMPRESSION_DEMANDEE'
        );

        if (hasJob && !hasReprintRequest) {
          reasons.push(`Le document de type ${templateType} a déjà été imprimé (demandez une réimpression).`);
        }
      } else {
        if (emp.isLocked) {
          reasons.push('Fiche verrouillée');
        }
      }

      // 3. Status must not be blocked (A_ENROLER, A_VERIFIER)
      if (emp.status === 'A_ENROLER') {
        reasons.push('Fiche non validée (en attente d\'enrôlement)');
      } else if (emp.status === 'A_VERIFIER') {
        reasons.push('Fiche en attente de vérification (conflit photo)');
      }

      // 4. Badge must not be blocked
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

    // Validate eligibility for the specific templateType
    const { eligible, ineligible } = await validatePrintEligibility(employeeIds, templateType);

    if (eligible.length === 0) {
      const reasons = ineligible.map(i => {
        const data = i.employee.dynamicData as Record<string, any>;
        const name = data ? `${data.Prenom || data.prenom || ''} ${data.Nom || data.nom || ''}`.trim() : i.employee.uniqueIdentifier;
        return `${name}: ${i.reasons.join(', ')}`;
      }).join('\n');
      throw new Error(`Aucun employé éligible à l'impression.\n${reasons}`);
    }

    const results = [];
    const confirmPrintBatchNumbers = new Set<string>();

    for (const emp of eligible) {
      // Use existing card number if available, otherwise generate one
      let cardNumber = emp.cardNumber;
      if (!cardNumber) {
        // Find category from dynamicData if not provided
        const catId = categoryId || extractCategoryFromDynamicData(emp.dynamicData);
        cardNumber = await generateCardNumber(emp.companyId, templateType, catId, undefined, confirmPrintBatchNumbers);
      }
      confirmPrintBatchNumbers.add(cardNumber);

      // Determine if this is a reprint
      const hasJob = emp.printJobs?.some((j: any) => 
        j.templateType === templateType && 
        j.cardNumber !== 'REIMPRESSION_DEMANDEE'
      );
      const isReprint = hasJob || emp.status === 'REIMPRESSION' || emp.status === 'REIMPRIME';

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
        
        // Delete the reprint request placeholder job
        if (lastJob) {
          await prisma.printJob.delete({
            where: { id: lastJob.id }
          });
        }
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

      // Determine if ALL company templates are now printed for this employee
      const companyTemplates = await prisma.cardTemplate.findMany({
        where: { companyId: emp.companyId },
        select: { type: true }
      });
      const requiredTypes = Array.from(new Set(companyTemplates.map(t => t.type)));

      const printedJobs = await prisma.printJob.findMany({
        where: { 
          employeeId: emp.id, 
          cardNumber: { not: 'REIMPRESSION_DEMANDEE' } 
        },
        select: { templateType: true }
      });
      const printedTypes = new Set(printedJobs.map(j => j.templateType));
      printedTypes.add(templateType); // include the current templateType we just printed

      const allPrinted = requiredTypes.every(t => printedTypes.has(t));

      // Update employee: lock only if allPrinted is true, update cardNumber, increment printCount, reset deliveryBatchId if reprint
      const updated = await prisma.employee.update({
        where: { id: emp.id },
        data: {
          cardNumber,
          status: newStatus,
          isLocked: allPrinted,
          printCount: { increment: 1 },
          printedAt: new Date(),
          printedBy: operatorName,
          ...(isReprint ? { deliveryBatchId: null } : {}),
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
export async function requestReprint(
  employeeId: string, 
  reason: string, 
  templateType: string,
  cardNumberOption: 'KEEP' | 'GENERATE' | 'CUSTOM' = 'KEEP',
  customCardNumber?: string
) {
  try {
    if (!reason || !reason.trim()) {
      throw new Error('Un motif de réimpression est obligatoire.');
    }
    if (!templateType || !templateType.trim()) {
      throw new Error('Un type de document est obligatoire pour la réimpression.');
    }

    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { status: true, isLocked: true, isBlocked: true, companyId: true, dynamicData: true, cardNumber: true },
    });

    if (!emp) throw new Error('Employé introuvable');
    if (emp.isBlocked) throw new Error('Ce badge est bloqué. Débloquez-le avant de demander une réimpression.');
    if (emp.status !== 'IMPRIME' && emp.status !== 'REIMPRIME' && !emp.isLocked) {
      throw new Error('La réimpression ne peut être demandée que pour un badge déjà imprimé ou réimprimé.');
    }

    let targetCardNumber: string;
    const isObsoleteBadgeNumber = emp.cardNumber ? emp.cardNumber.toUpperCase().startsWith('BADGE') : false;

    if (cardNumberOption === 'CUSTOM' && customCardNumber && customCardNumber.trim() !== '') {
      targetCardNumber = customCardNumber.trim();
    } else if (cardNumberOption === 'KEEP' && emp.cardNumber && emp.cardNumber.trim() !== '' && !isObsoleteBadgeNumber) {
      targetCardNumber = emp.cardNumber.trim();
    } else {
      // Option 'GENERATE' or fallback if obsolete BADGE number: Generate a new card number
      const catId = extractCategoryFromDynamicData(emp.dynamicData);
      let overridePrefix: string | undefined = undefined;
      if (emp.cardNumber && !isObsoleteBadgeNumber) {
        const match = emp.cardNumber.match(/^(.*?)(\d{4,})$/);
        if (match && match[1]) {
          overridePrefix = match[1];
        }
      }
      targetCardNumber = await generateCardNumber(emp.companyId, templateType, catId, overridePrefix);
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

    // Unlock, set status to REIMPRESSION, set targetCardNumber, and reset deliveryBatchId
    const result = await prisma.employee.update({
      where: { id: employeeId },
      data: {
        status: 'REIMPRESSION',
        isLocked: false,
        cardNumber: targetCardNumber,
        deliveryBatchId: null,
      },
    });
    revalidatePath('/dashboard', 'layout');
    return result;
  } catch (error: any) {
    console.warn('Error requesting reprint:', error);
    throw new Error(error.message || 'Impossible de demander la réimpression');
  }
}

/**
 * Demande une réimpression en lot pour plusieurs employés avec suivi anti-doublon d'exclusion mémoire.
 */
export async function requestReprintBatch(
  employeeIds: string[],
  reason: string,
  templateType: string,
  cardNumberOption: 'KEEP' | 'GENERATE' | 'CUSTOM' = 'KEEP',
  customCardNumber?: string
) {
  try {
    if (!employeeIds || employeeIds.length === 0) return { success: true, count: 0 };
    
    if (employeeIds.length === 1) {
      const res = await requestReprint(employeeIds[0], reason, templateType, cardNumberOption, customCardNumber);
      return { success: true, count: 1, results: [res] };
    }

    const batchExcludedNumbers = new Set<string>();
    const results = [];

    for (const empId of employeeIds) {
      const emp = await prisma.employee.findUnique({
        where: { id: empId },
        select: { id: true, status: true, isLocked: true, isBlocked: true, companyId: true, dynamicData: true, cardNumber: true },
      });

      if (!emp || emp.isBlocked) continue;
      if (emp.status !== 'IMPRIME' && emp.status !== 'REIMPRIME' && !emp.isLocked) continue;

      let targetCardNumber: string;
      const isObsoleteBadgeNumber = emp.cardNumber ? emp.cardNumber.toUpperCase().startsWith('BADGE') : false;

      if (cardNumberOption === 'CUSTOM' && customCardNumber && customCardNumber.trim() !== '') {
        targetCardNumber = customCardNumber.trim();
      } else if (cardNumberOption === 'KEEP' && emp.cardNumber && emp.cardNumber.trim() !== '' && !isObsoleteBadgeNumber) {
        targetCardNumber = emp.cardNumber.trim();
      } else {
        const catId = extractCategoryFromDynamicData(emp.dynamicData);
        let overridePrefix: string | undefined = undefined;
        if (emp.cardNumber && !isObsoleteBadgeNumber) {
          const match = emp.cardNumber.match(/^(.*?)(\d{4,})$/);
          if (match && match[1]) {
            overridePrefix = match[1];
          }
        }
        targetCardNumber = await generateCardNumber(emp.companyId, templateType, catId, overridePrefix, batchExcludedNumbers);
      }

      batchExcludedNumbers.add(targetCardNumber);

      const session = await getSafeSession();
      const operatorName = session?.user?.name || session?.user?.email || "Système";

      await prisma.printJob.create({
        data: {
          employeeId: empId,
          cardNumber: 'REIMPRESSION_DEMANDEE',
          templateType: templateType,
          isReprint: true,
          reprintReason: reason.trim(),
          printedBy: operatorName,
        },
      });

      const updated = await prisma.employee.update({
        where: { id: empId },
        data: {
          status: 'REIMPRESSION',
          isLocked: false,
          cardNumber: targetCardNumber,
          deliveryBatchId: null,
        },
      });

      results.push(updated);
    }

    revalidatePath('/dashboard', 'layout');
    return { success: true, count: results.length, results };
  } catch (error: any) {
    console.warn('Error in requestReprintBatch:', error);
    throw new Error(error.message || 'Impossible d\'effectuer les demandes de réimpression en lot');
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

    const result = await prisma.employee.update({
      where: { id: employeeId },
      data: { isBlocked: true },
    });
    revalidatePath('/dashboard', 'layout');
    return result;
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

    const result = await prisma.employee.update({
      where: { id: employeeId },
      data: { isBlocked: false },
    });
    revalidatePath('/dashboard', 'layout');
    return result;
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

export async function ensureCardNumbers(employeeIds: string[], defaultTemplateType: string = 'BADGE') {
  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds }, cardNumber: null },
  });

  for (const emp of employees) {
    const catId = extractCategoryFromDynamicData(emp.dynamicData);
    const cardNumber = await generateCardNumber(emp.companyId, defaultTemplateType, catId);
    await prisma.employee.update({
      where: { id: emp.id },
      data: { cardNumber }
    });
  }
}
export async function assignCardNumbersForCategory(employeeIds: string[], categoryId?: string, templateType: string = 'BADGE') {
  try {
    console.log(`[assignCardNumbersForCategory] called with ${employeeIds.length} ids, catId=${categoryId}, type=${templateType}`);
    
    let targetPrefix: string | undefined = undefined;
    if (categoryId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryId);
      let cat = null;
      if (isUuid) {
        cat = await prisma.cardCategory.findUnique({ where: { id: categoryId } });
      }
      if (!cat) {
        cat = await prisma.cardCategory.findFirst({
          where: {
            AND: [
              { OR: [{ companyId: null }, { companyId: { not: null } }] },
              { OR: [{ id: categoryId }, { name: { equals: categoryId, mode: 'insensitive' } }, { slug: { equals: categoryId, mode: 'insensitive' } }, { cardCode: { equals: categoryId, mode: 'insensitive' } }] }
            ]
          }
        });
      }
      if (cat) {
        if (cat.cardCode && cat.cardCode.trim() !== '') {
          targetPrefix = cat.cardCode.trim();
        } else if (cat.slug) {
          targetPrefix = cat.slug.toUpperCase().replace(/[^A-Z0-9]/g, '');
        } else if (cat.name) {
          targetPrefix = cat.name.toUpperCase().replace(/[^A-Z0-9]/g, '');
        }
      }
    }

    const fetchedEmployees = await prisma.employee.findMany({
      where: {
        id: { in: employeeIds },
      },
    });
    
    // Re-order fetched employees to match the EXACT selection sequence from `employeeIds` parameter
    const empMap = new Map(fetchedEmployees.map(e => [e.id, e]));
    const employees = employeeIds.map(id => empMap.get(id)).filter(Boolean) as typeof fetchedEmployees;
    
    console.log(`[assignCardNumbersForCategory] Found ${employees.length} employees to check/assign`);
    
    const updatedNumbers: Record<string, string> = {};
    if (employees.length === 0) return updatedNumbers;

    const inBatchNumbers = new Set<string>();

    for (const emp of employees) {
      // 1. PRESERVE EXISTING CARD NUMBERS: If employee already has a card number (printed, locked, or custom assigned like 225AGR260046), NEVER overwrite it!
      if (emp.cardNumber && emp.cardNumber.trim() !== '') {
        updatedNumbers[emp.id] = emp.cardNumber;
        inBatchNumbers.add(emp.cardNumber);
        continue;
      }

      // 2. Resolve employee category if not provided
      let empCatId = categoryId;
      if (!empCatId) {
        empCatId = extractCategoryFromDynamicData(emp.dynamicData);
      }

      // 3. Generate a new guaranteed unique card number in batch
      const cardNumber = await generateCardNumber(emp.companyId, templateType, empCatId, undefined, inBatchNumbers);
      console.log(`[assignCardNumbersForCategory] Generated card number "${cardNumber}" for employee ${emp.id}`);
      
      await prisma.employee.update({
        where: { id: emp.id },
        data: { cardNumber }
      });
      updatedNumbers[emp.id] = cardNumber;
      inBatchNumbers.add(cardNumber);
    }
    
    return updatedNumbers;
  } catch (err: any) {
    console.error(`[assignCardNumbersForCategory] ERROR: ${err.message}`, err.stack);
    throw err;
  }
}

/**
 * Nettoie et ré-séquence les éventuels numéros de cartes en double dans la base de données.
 */
export async function fixDuplicateCardNumbers(companyId?: string) {
  try {
    console.log(`[fixDuplicateCardNumbers] Checking database for duplicate card numbers...`);
    const employees = await prisma.employee.findMany({
      where: companyId ? { companyId } : {},
      select: { id: true, companyId: true, cardNumber: true, status: true, isLocked: true, dynamicData: true },
      orderBy: { createdAt: 'asc' }
    });

    const seenCardNumbers = new Map<string, string>(); // key -> employeeId
    const duplicatesToFix: Array<{ employee: typeof employees[0] }> = [];

    for (const emp of employees) {
      if (!emp.cardNumber) continue;
      const key = `${emp.companyId}_${emp.cardNumber.trim()}`;
      if (seenCardNumbers.has(key)) {
        // If employee is NOT printed/locked, we fix their card number to be unique
        if (emp.status !== 'IMPRIME' && emp.status !== 'REIMPRIME' && !emp.isLocked) {
          duplicatesToFix.push({ employee: emp });
        }
      } else {
        seenCardNumbers.set(key, emp.id);
      }
    }

    console.log(`[fixDuplicateCardNumbers] Found ${duplicatesToFix.length} duplicate card numbers to re-sequence.`);

    const fixedResults: Record<string, string> = {};
    const inBatch = new Set<string>();

    for (const { employee: emp } of duplicatesToFix) {
      const catId = extractCategoryFromDynamicData(emp.dynamicData);
      const newCardNumber = await generateCardNumber(emp.companyId, 'BADGE', catId, undefined, inBatch);
      await prisma.employee.update({
        where: { id: emp.id },
        data: { cardNumber: newCardNumber }
      });
      fixedResults[emp.id] = newCardNumber;
      inBatch.add(newCardNumber);
      console.log(`[fixDuplicateCardNumbers] Re-sequenced duplicate employee ${emp.id} to new unique number "${newCardNumber}"`);
    }

    return { success: true, fixedCount: duplicatesToFix.length, fixedResults };
  } catch (err: any) {
    console.error('[fixDuplicateCardNumbers] Error:', err);
    throw err;
  }
}
