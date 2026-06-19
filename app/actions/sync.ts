'use server';

import { prisma } from '@/lib/prisma';
import { createCompany, saveTemplate } from '@/app/actions/templates';
import { 
  importEmployees, 
  saveEmployeePhoto, 
  updateEmployeeStatus, 
  bulkUpdateEmployeeStatus, 
  updateEmployeeData 
} from '@/app/actions/employees';
import { createRole, updateRole, deleteRole } from '@/app/actions/roles';
import { adminCreateUser, adminUpdateUser, adminDeleteUser } from '@/app/actions/users';

export async function syncOfflineMutations(mutations: any[]) {
  const companyIdMap: Record<string, string> = {};
  const roleIdMap: Record<string, string> = {};
  const userIdMap: Record<string, string> = {};

  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  for (const mut of mutations) {
    const { id, type, payload } = mut;
    try {
      if (type === 'CREATE_COMPANY') {
        const newCompany = await createCompany(payload.name);
        companyIdMap[payload.tempId] = newCompany.id;
        results.push({ id, success: true });
      } 
      else if (type === 'IMPORT_EMPLOYEES') {
        const resolvedCompanyId = companyIdMap[payload.companyId] || payload.companyId;
        const res = await importEmployees({
          companyId: resolvedCompanyId,
          uniqueField: payload.uniqueField,
          rows: payload.rows,
        });
        results.push({ id, success: res.success });
      } 
      else if (type === 'SAVE_EMPLOYEE_PHOTO') {
        let resolvedEmployeeId = payload.employeeId;

        // Résoudre l'ID temporaire d'employé si nécessaire
        if (payload.tempEmployeeKey) {
          const { companyId, uniqueIdentifier } = payload.tempEmployeeKey;
          const realCoId = companyIdMap[companyId] || companyId;
          const emp = await prisma.employee.findUnique({
            where: {
              companyId_uniqueIdentifier: {
                companyId: realCoId,
                uniqueIdentifier,
              },
            },
          });
          if (emp) {
            resolvedEmployeeId = emp.id;
          }
        }

        // ── Déterminer la valeur à sauvegarder ──
        let finalPhotoValue = payload.photoBase64 || payload.photoUrl || '';

        // Si c'est un Base64 (mode offline), l'uploader d'abord vers le pont
        if (finalPhotoValue.startsWith('data:image/')) {
          try {
            const PHOTO_SERVER_URL = process.env.PHOTO_SERVER_URL || 'http://localhost:4000';
            const uploadRes = await fetch(`${PHOTO_SERVER_URL}/api/upload`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageBase64: finalPhotoValue, prefix: 'SYNC' }),
            });
            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              if (uploadData.success && uploadData.imageUrl) {
                finalPhotoValue = uploadData.imageUrl;
              }
            }
          } catch (uploadErr) {
            console.warn('Sync upload vers le pont échoué, conservation du Base64 :', uploadErr);
            // On garde le Base64 comme fallback si le pont est inaccessible
          }
        }

        await saveEmployeePhoto(resolvedEmployeeId, finalPhotoValue);
        results.push({ id, success: true });
      }
 
      else if (type === 'UPDATE_EMPLOYEE_STATUS') {
        let resolvedEmployeeId = payload.employeeId;

        if (payload.tempEmployeeKey) {
          const { companyId, uniqueIdentifier } = payload.tempEmployeeKey;
          const realCoId = companyIdMap[companyId] || companyId;
          const emp = await prisma.employee.findUnique({
            where: {
              companyId_uniqueIdentifier: {
                companyId: realCoId,
                uniqueIdentifier,
              },
            },
          });
          if (emp) {
            resolvedEmployeeId = emp.id;
          }
        }

        await updateEmployeeStatus(resolvedEmployeeId, payload.status);
        results.push({ id, success: true });
      } 
      else if (type === 'UPDATE_EMPLOYEE_DATA') {
        let resolvedEmployeeId = payload.employeeId;

        if (payload.tempEmployeeKey) {
          const { companyId, uniqueIdentifier } = payload.tempEmployeeKey;
          const realCoId = companyIdMap[companyId] || companyId;
          const emp = await prisma.employee.findUnique({
            where: {
              companyId_uniqueIdentifier: {
                companyId: realCoId,
                uniqueIdentifier,
              },
            },
          });
          if (emp) {
            resolvedEmployeeId = emp.id;
          }
        }

        await updateEmployeeData(resolvedEmployeeId, payload.dynamicData);
        results.push({ id, success: true });
      } 
      else if (type === 'BULK_UPDATE_EMPLOYEE_STATUS') {
        const resolvedEmployeeIds = [];
        
        for (let i = 0; i < payload.employeeIds.length; i++) {
          let empId = payload.employeeIds[i];
          const tempKey = payload.tempEmployeeKeys?.[i];
          
          if (tempKey) {
            const { companyId, uniqueIdentifier } = tempKey;
            const realCoId = companyIdMap[companyId] || companyId;
            const emp = await prisma.employee.findUnique({
              where: {
                companyId_uniqueIdentifier: {
                  companyId: realCoId,
                  uniqueIdentifier,
                },
              },
            });
            if (emp) empId = emp.id;
          }
          resolvedEmployeeIds.push(empId);
        }

        await bulkUpdateEmployeeStatus(resolvedEmployeeIds, payload.status);
        results.push({ id, success: true });
      } 
      else if (type === 'SAVE_TEMPLATE') {
        const resolvedCompanyId = companyIdMap[payload.companyId] || payload.companyId;
        
        // Swapping companyId in template payload's layoutConfig if present
        const layoutConfig = { ...payload.layoutConfig };
        
        await saveTemplate({
          companyId: resolvedCompanyId,
          type: payload.type,
          width: payload.width,
          height: payload.height,
          backgroundUrl: payload.backgroundUrl,
          layoutConfig,
        });
        results.push({ id, success: true });
      } 
      else if (type === 'CREATE_ROLE') {
        const newRole = await createRole(payload.data);
        results.push({ id, success: true });
      } 
      else if (type === 'UPDATE_ROLE') {
        await updateRole(payload.id, payload.data);
        results.push({ id, success: true });
      } 
      else if (type === 'DELETE_ROLE') {
        await deleteRole(payload.id);
        results.push({ id, success: true });
      } 
      else if (type === 'CREATE_USER') {
        await adminCreateUser(payload.data);
        results.push({ id, success: true });
      } 
      else if (type === 'UPDATE_USER') {
        await adminUpdateUser(payload.id, payload.data);
        results.push({ id, success: true });
      } 
      else if (type === 'DELETE_USER') {
        await adminDeleteUser(payload.id);
        results.push({ id, success: true });
      } 
      else {
        results.push({ id, success: false, error: 'Unknown mutation type' });
      }
    } catch (err: any) {
      console.warn(`Sync failed for mutation ${id} (${type}):`, err);
      results.push({ id, success: false, error: err.message || 'Action execution failed' });
    }
  }

  // Check if any sync failed
  const allSuccess = results.every(r => r.success);
  return { success: allSuccess, results };
}
