'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function getDeliveryBatches(companyId?: string) {
  try {
    const where = companyId ? { companyId } : {};
    return await prisma.deliveryBatch.findMany({
      where,
      include: {
        company: {
          select: { name: true }
        },
        _count: {
          select: { employees: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  } catch (error) {
    console.warn('Error fetching delivery batches:', error);
    throw new Error("Impossible de récupérer les lots d'expédition");
  }
}

export async function createDeliveryBatch({ companyId, employeeIds }: { companyId: string, employeeIds: string[] }) {
  if (!employeeIds.length) throw new Error('Aucun employé sélectionné');
  
  try {
    const timestamp = Date.now().toString().slice(-6);
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new Error('Entreprise introuvable');
    
    // Create a readable batch number like LOT-ACME-123456
    const batchNumber = `LOT-${company.name.substring(0, 4).toUpperCase()}-${timestamp}`;

    const batch = await prisma.deliveryBatch.create({
      data: {
        batchNumber,
        companyId,
        status: 'PREPARE'
      }
    });

    await prisma.$executeRawUnsafe(
      `UPDATE "Employee" SET "deliveryBatchId" = $1 WHERE id = ANY($2)`,
      batch.id,
      employeeIds
    );
    
    revalidatePath('/dashboard/delivery-batches');
    return batch;
  } catch (error) {
    console.warn('Error creating delivery batch:', error);
    throw new Error("Impossible de créer le lot d'expédition");
  }
}

export async function updateBatchStatus(batchId: string, status: string) {
  try {
    const data: any = { status };
    if (status === 'EN_TRANSIT') {
      data.shippedAt = new Date();
    } else if (status === 'LIVRE') {
      data.deliveredAt = new Date();
    }
    
    const batch = await prisma.deliveryBatch.update({
      where: { id: batchId },
      data
    });
    
    revalidatePath('/dashboard/delivery-batches');
    return batch;
  } catch (error) {
    console.warn('Error updating batch status:', error);
    throw new Error('Impossible de mettre à jour le statut du lot');
  }
}

export async function getPrintQueue(companyId?: string) {
  try {
    // A card is ready to print if it has a photo, status is PHOTO_VALIDEE or REIMPRESSION,
    // and the badge is not blocked
    const where: any = {
      photoUrl: { not: null },
      isBlocked: false,
      status: { in: ['PHOTO_VALIDEE', 'REIMPRESSION'] },
    };
    if (companyId) {
      where.companyId = companyId;
    }
    
    return await prisma.employee.findMany({
      where,
      include: {
        company: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
  } catch (error) {
    console.warn('Error fetching print queue:', error);
    throw new Error('Impossible de récupérer la file d\'impression');
  }
}

export async function markAsPrinted(employeeIds: string[], templateType?: string, categoryId?: string, physicalTypeId?: string) {
  if (!employeeIds.length) return;
  try {
    // Use the new confirmPrint workflow if available
    const { confirmPrint } = await import('@/app/actions/employees');
    const result = await confirmPrint(
      employeeIds,
      templateType || 'BADGE',
      categoryId,
      physicalTypeId
    );
    revalidatePath('/dashboard/print-queue');
    revalidatePath('/dashboard/delivery-batches');
    return result;
  } catch (error) {
    console.warn('Error marking as printed:', error);
    throw new Error('Impossible de marquer les cartes comme imprimées');
  }
}

export async function getUnassignedPrintedEmployees(companyId: string) {
  try {
    return await prisma.employee.findMany({
      where: {
        companyId,
        status: 'IMPRIME',
        deliveryBatchId: null
      },
      orderBy: { printedAt: 'desc' }
    });
  } catch (error) {
    console.warn('Error fetching unassigned printed employees:', error);
    throw new Error('Impossible de récupérer les employés imprimés non assignés');
  }
}

export async function getBatchEmployees(batchId: string) {
  try {
    return await prisma.employee.findMany({
      where: { deliveryBatchId: batchId },
      include: {
        company: {
          select: { name: true }
        }
      },
      orderBy: { uniqueIdentifier: 'asc' }
    });
  } catch (error) {
    console.warn('Error fetching batch employees:', error);
    throw new Error('Impossible de récupérer les employés du lot');
  }
}

export async function deleteDeliveryBatch(batchId: string) {
  try {
    await prisma.deliveryBatch.delete({
      where: { id: batchId }
    });
    revalidatePath('/dashboard/delivery-batches');
  } catch (error) {
    console.warn('Error deleting delivery batch:', error);
    throw new Error("Impossible de supprimer le lot d'expédition");
  }
}

export async function updateDeliveryBatch(batchId: string, customBatchNumber: string, employeeIds: string[]) {
  if (!employeeIds.length) throw new Error('Aucun employé sélectionné');
  
  try {
    // We update the batch number, and set the new list of employees
    // 'set' will connect the provided IDs and disconnect any previous ones not in the list
    const batch = await prisma.deliveryBatch.update({
      where: { id: batchId },
      data: {
        batchNumber: customBatchNumber
      }
    });
    
    // Break previous employee connections using raw SQL to bypass transactions
    await prisma.$executeRawUnsafe(
      `UPDATE "Employee" SET "deliveryBatchId" = NULL WHERE "deliveryBatchId" = $1`,
      batchId
    );
    
    // Establish new employee connections using raw SQL to bypass transactions
    await prisma.$executeRawUnsafe(
      `UPDATE "Employee" SET "deliveryBatchId" = $1 WHERE id = ANY($2)`,
      batchId,
      employeeIds
    );
    
    revalidatePath('/dashboard/delivery-batches');
    return batch;
  } catch (error) {
    console.warn('Error updating delivery batch:', error);
    throw new Error("Impossible de mettre à jour le lot d'expédition");
  }
}

