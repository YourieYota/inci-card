'use server';

import { prisma } from '@/lib/prisma';
import { CardType } from '@prisma/client';

export async function getCompanies() {
  try {
    return await prisma.company.findMany({
      orderBy: { name: 'asc' },
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    throw new Error('Impossible de récupérer les entreprises');
  }
}

export async function getCompaniesWithCounts() {
  try {
    return await prisma.company.findMany({
      include: {
        _count: {
          select: {
            employees: true,
            templates: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  } catch (error) {
    console.error('Error fetching companies with counts:', error);
    throw new Error('Impossible de récupérer les entreprises');
  }
}

export async function createCompany(name: string) {
  try {
    return await prisma.company.create({
      data: { name },
    });
  } catch (error) {
    console.error('Error creating company:', error);
    throw new Error('Impossible de créer l\'entreprise (ce nom existe peut-être déjà)');
  }
}

export async function getTemplate(companyId: string, type: CardType) {
  try {
    return await prisma.cardTemplate.findUnique({
      where: {
        companyId_type: {
          companyId,
          type,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    throw new Error('Impossible de récupérer le modèle de carte');
  }
}

export async function saveTemplate({
  companyId,
  type,
  width,
  height,
  backgroundUrl,
  layoutConfig,
}: {
  companyId: string;
  type: CardType;
  width: number;
  height: number;
  backgroundUrl?: string;
  layoutConfig: any;
}) {
  try {
    const template = await prisma.cardTemplate.upsert({
      where: {
        companyId_type: {
          companyId,
          type,
        },
      },
      update: {
        width,
        height,
        backgroundUrl: backgroundUrl || null,
        layoutConfig,
      },
      create: {
        companyId,
        type,
        width,
        height,
        backgroundUrl: backgroundUrl || null,
        layoutConfig,
      },
    });
    return template;
  } catch (error) {
    console.error('Error saving template:', error);
    throw new Error('Impossible de sauvegarder le modèle de carte');
  }
}
