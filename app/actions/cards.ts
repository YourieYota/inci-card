'use server';

import { prisma } from '@/lib/prisma';

// Ensure the default CR80 format is created if none exists
async function ensureDefaultFormat() {
  const count = await prisma.cardFormat.count({
    where: { companyId: null }
  });
  if (count === 0) {
    await prisma.cardFormat.create({
      data: {
        name: 'CR80 (Standard)',
        width: 85.60,
        height: 53.98,
        unit: 'mm',
        companyId: null,
      },
    });
  }
}

export async function getCardFormats(companyId?: string | null) {
  try {
    await ensureDefaultFormat();
    return await prisma.cardFormat.findMany({
      where: {
        OR: [
          { companyId: companyId || null },
          { companyId: null }
        ]
      },
      orderBy: { name: 'asc' },
    });
  } catch (error) {
    console.warn('Error fetching card formats:', error);
    throw new Error('Impossible de charger les formats de cartes');
  }
}

export async function createCardFormat(data: {
  name: string;
  width: number;
  height: number;
  unit: string;
  companyId?: string | null;
}) {
  try {
    return await prisma.cardFormat.create({
      data: {
        name: data.name,
        width: data.width,
        height: data.height,
        unit: data.unit,
        companyId: data.companyId || null,
      },
    });
  } catch (error) {
    console.warn('Error creating card format:', error);
    throw new Error('Impossible de créer le format de carte. Le nom existe peut-être déjà pour cette entreprise.');
  }
}

export async function deleteCardFormat(id: string) {
  try {
    const categoriesCount = await prisma.cardCategory.count({
      where: { formatId: id },
    });

    if (categoriesCount > 0) {
      throw new Error('Ce format est utilisé par une ou plusieurs catégories et ne peut pas être supprimé.');
    }

    return await prisma.cardFormat.delete({
      where: { id },
    });
  } catch (error: any) {
    console.warn('Error deleting card format:', error);
    throw new Error(error.message || 'Impossible de supprimer le format de carte.');
  }
}

export async function getCardCategories(companyId?: string | null) {
  try {
    return await prisma.cardCategory.findMany({
      where: {
        OR: [
          { companyId: companyId || null },
          { companyId: null }
        ]
      },
      include: {
        format: true,
      },
      orderBy: { name: 'asc' },
    });
  } catch (error) {
    console.warn('Error fetching card categories:', error);
    throw new Error('Impossible de charger les catégories de cartes');
  }
}

export async function createCardCategory(data: {
  name: string;
  color: string;
  description?: string;
  formatId: string;
  companyId?: string | null;
}) {
  try {
    const slug = data.name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return await prisma.cardCategory.create({
      data: {
        name: data.name,
        slug,
        color: data.color,
        description: data.description || null,
        formatId: data.formatId,
        companyId: data.companyId || null,
      },
      include: {
        format: true,
      },
    });
  } catch (error) {
    console.warn('Error creating card category:', error);
    throw new Error('Impossible de créer la catégorie. Le nom existe peut-être déjà pour cette entreprise.');
  }
}

export async function deleteCardCategory(id: string) {
  try {
    return await prisma.cardCategory.delete({
      where: { id },
    });
  } catch (error) {
    console.warn('Error deleting card category:', error);
    throw new Error('Impossible de supprimer la catégorie de carte.');
  }
}

export async function getCardPhysicalTypes(companyId?: string | null) {
  try {
    return await prisma.cardPhysicalType.findMany({
      where: {
        OR: [
          { companyId: companyId || null },
          { companyId: null }
        ]
      },
      orderBy: { name: 'asc' },
    });
  } catch (error) {
    console.warn('Error fetching card physical types:', error);
    throw new Error('Impossible de charger les types de cartes');
  }
}

export async function createCardPhysicalType(data: {
  name: string;
  description?: string;
  cardCode: string;
  companyId?: string | null;
}) {
  try {
    const slug = data.name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return await prisma.cardPhysicalType.create({
      data: {
        name: data.name,
        slug,
        description: data.description || null,
        cardCode: data.cardCode,
        companyId: data.companyId || null,
      },
    });
  } catch (error) {
    console.warn('Error creating card physical type:', error);
    throw new Error('Impossible de créer le type de carte. Le nom existe peut-être déjà pour cette entreprise.');
  }
}

export async function deleteCardPhysicalType(id: string) {
  try {
    return await prisma.cardPhysicalType.delete({
      where: { id },
    });
  } catch (error) {
    console.warn('Error deleting card physical type:', error);
    throw new Error('Impossible de supprimer le type de carte.');
  }
}
