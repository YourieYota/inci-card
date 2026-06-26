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
  } catch (error: any) {
    console.warn('Error creating card format:', error);
    if (error.code === 'P2002' || error.code === '23505' || error.message?.includes('unique constraint')) {
      throw new Error('Impossible de créer le format de carte. Le nom existe déjà pour cette entreprise.');
    }
    throw new Error(`Impossible de créer le format de carte: ${error.message || error}`);
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
  validityValue?: number | null;
  validityUnit?: string | null;
  companyId?: string | null;
  documentTypeSlug?: string | null;
}) {
  try {
    const slug = data.name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // 1. Verify format existence first to prevent database constraints errors from bubbling directly
    const format = await prisma.cardFormat.findUnique({
      where: { id: data.formatId },
    });
    if (!format) throw new Error("Format de carte introuvable");

    // 2. Map validity fields to support permanent cards (no validity / NONE)
    const isPermanent = data.validityUnit === 'NONE' || data.validityUnit === null || data.validityValue === null;
    const validityValue = isPermanent ? null : (data.validityValue !== undefined ? data.validityValue : 1);
    const validityUnit = isPermanent ? null : (data.validityUnit || 'YEAR');

    const category = await prisma.cardCategory.create({
      data: {
        name: data.name,
        slug,
        color: data.color,
        description: data.description || null,
        validityValue,
        validityUnit,
        formatId: data.formatId,
        companyId: data.companyId || null,
        documentTypeSlug: data.documentTypeSlug || null,
      },
    });

    return {
      ...category,
      format,
    };
  } catch (error: any) {
    console.warn('Error creating card category:', error);
    if (error.code === 'P2002' || error.code === '23505' || error.message?.includes('unique constraint')) {
      throw new Error('Impossible de créer la catégorie. Le nom existe déjà pour cette entreprise.');
    }
    throw new Error(`Impossible de créer la catégorie: ${error.message || error}`);
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
  } catch (error: any) {
    console.warn('Error creating card physical type:', error);
    if (error.code === 'P2002' || error.code === '23505' || error.message?.includes('unique constraint')) {
      throw new Error('Impossible de créer le type de carte. Le nom existe déjà pour cette entreprise.');
    }
    throw new Error(`Impossible de créer le type de carte: ${error.message || error}`);
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

export async function getCardDocumentTypes(companyId?: string | null) {
  try {
    const customTypes = await prisma.cardDocumentType.findMany({
      where: {
        OR: [
          { companyId: companyId || null },
          { companyId: null }
        ]
      },
      orderBy: { name: 'asc' },
    });

    const systemTypes = [
      {
        id: 'SYSTEM_BADGE',
        name: 'Badge',
        slug: 'BADGE',
        description: 'Badge standard',
        cardCode: 'BADGE',
        isSystem: true,
        companyId: null,
      },
      {
        id: 'SYSTEM_CARTE_PRO',
        name: 'Carte Professionnelle',
        slug: 'CARTE_PRO',
        description: 'Carte professionnelle standard',
        cardCode: 'CPRO',
        isSystem: true,
        companyId: null,
      },
      {
        id: 'SYSTEM_RECU',
        name: "Reçu d'enrôlement",
        slug: 'RECU',
        description: "Reçu d'enrôlement standard",
        cardCode: 'RECU',
        isSystem: true,
        companyId: null,
      }
    ];

    return [...systemTypes, ...customTypes.map(t => ({ ...t, isSystem: false }))];
  } catch (error) {
    console.warn('Error fetching card document types:', error);
    throw new Error('Impossible de charger les types de documents');
  }
}

export async function createCardDocumentType(data: {
  name: string;
  description?: string;
  cardCode?: string;
  companyId?: string | null;
}) {
  try {
    const slug = data.name
      .toUpperCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '_')
      .replace(/^-+|-+$/g, '');

    const systemSlugs = ['BADGE', 'CARTE_PRO', 'RECU'];
    if (systemSlugs.includes(slug)) {
      throw new Error('Ce nom de type de document est réservé par le système.');
    }

    return await prisma.cardDocumentType.create({
      data: {
        name: data.name,
        slug,
        description: data.description || null,
        cardCode: data.cardCode || slug,
        companyId: data.companyId || null,
      },
    });
  } catch (error: any) {
    console.warn('Error creating card document type:', error);
    if (error.code === 'P2002' || error.code === '23505' || error.message?.includes('unique constraint')) {
      throw new Error('Impossible de créer le type de document. Le nom existe déjà pour cette entreprise.');
    }
    throw new Error(error.message || `Impossible de créer le type de document`);
  }
}

export async function deleteCardDocumentType(id: string) {
  try {
    if (id.startsWith('SYSTEM_')) {
      throw new Error('Les types de documents système ne peuvent pas être supprimés.');
    }

    const docType = await prisma.cardDocumentType.findUnique({
      where: { id },
    });

    if (!docType) {
      throw new Error('Type de document introuvable.');
    }

    const templatesCount = await prisma.cardTemplate.count({
      where: { type: docType.slug },
    });

    if (templatesCount > 0) {
      throw new Error('Ce type de document est utilisé par un ou plusieurs modèles de carte et ne peut pas être supprimé.');
    }

    return await prisma.cardDocumentType.delete({
      where: { id },
    });
  } catch (error: any) {
    console.warn('Error deleting card document type:', error);
    throw new Error(error.message || 'Impossible de supprimer le type de document.');
  }
}
