'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function saveExternalQrCodesBatch(
  entries: { employeeId: string; qrBase64: string }[]
) {
  try {
    await Promise.all(
      entries.map(({ employeeId, qrBase64 }) =>
        prisma.employee.update({
          where: { id: employeeId },
          data: { externalQrUrl: qrBase64 },
        })
      )
    );
    revalidatePath('/dashboard/qr-codes');
  } catch (error) {
    console.warn('Error saving external QR codes batch:', error);
    throw new Error('Impossible de sauvegarder les QR codes externes');
  }
}

export async function deleteExternalQrCode(employeeId: string) {
  try {
    await prisma.employee.update({
      where: { id: employeeId },
      data: { externalQrUrl: null },
    });
    revalidatePath('/dashboard/qr-codes');
  } catch (error) {
    console.warn('Error deleting external QR code:', error);
    throw new Error('Impossible de supprimer le QR code externe');
  }
}

export async function getEmployeesQrStatus(companyId: string) {
  try {
    const employees = await prisma.employee.findMany({
      where: { companyId },
      select: {
        id: true,
        uniqueIdentifier: true,
        dynamicData: true,
        externalQrUrl: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return employees.map(e => ({
      id: e.id,
      uniqueIdentifier: e.uniqueIdentifier,
      dynamicData: e.dynamicData as Record<string, unknown>,
      hasExternalQr: !!e.externalQrUrl,
    }));
  } catch (error) {
    console.warn('Error fetching employees QR status:', error);
    throw new Error('Impossible de charger les employes');
  }
}
