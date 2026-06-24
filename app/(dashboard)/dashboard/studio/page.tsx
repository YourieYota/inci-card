import React from 'react';
import StudioClient from '@/components/studio/StudioClient';
import { getCompanies } from '@/app/actions/templates';
import { getCardCategories, getCardFormats, getCardPhysicalTypes } from '@/app/actions/cards';

export const dynamic = 'force-dynamic';

export default async function StudioPage() {
  let companies: any[] = [];
  let categories: any[] = [];
  let formats: any[] = [];
  let physicalTypes: any[] = [];
  let dbError = false;

  try {
    const [companiesData, categoriesData, formatsData, physicalTypesData] = await Promise.all([
      getCompanies(),
      getCardCategories(),
      getCardFormats(),
      getCardPhysicalTypes()
    ]);
    companies = companiesData;
    categories = categoriesData;
    formats = formatsData;
    physicalTypes = physicalTypesData;
  } catch (error) {
    dbError = true;
  }

  const serializedCompanies = companies.map(c => ({
    ...c,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : c.updatedAt,
  }));

  const serializedCategories = categories.map(c => ({
    ...c,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : c.updatedAt,
  }));

  const serializedFormats = formats.map(f => ({
    ...f,
    createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : f.createdAt,
    updatedAt: f.updatedAt instanceof Date ? f.updatedAt.toISOString() : f.updatedAt,
  }));

  const serializedPhysicalTypes = physicalTypes.map(t => ({
    ...t,
    createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
    updatedAt: t.updatedAt instanceof Date ? t.updatedAt.toISOString() : t.updatedAt,
  }));

  return (
    <div className="w-full py-1">
      <StudioClient 
        initialCompanies={serializedCompanies} 
        initialCategories={serializedCategories} 
        initialFormats={serializedFormats}
        initialPhysicalTypes={serializedPhysicalTypes}
        dbError={dbError} 
      />
    </div>
  );
}
