import React from 'react';
import StudioClient from '@/components/studio/StudioClient';
import { getCompanies } from '@/app/actions/templates';
import { getCardCategories } from '@/app/actions/cards';

export const dynamic = 'force-dynamic';

export default async function StudioPage() {
  let companies: any[] = [];
  let categories: any[] = [];
  let dbError = false;

  try {
    const [companiesData, categoriesData] = await Promise.all([
      getCompanies(),
      getCardCategories()
    ]);
    companies = companiesData;
    categories = categoriesData;
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

  return (
    <div className="w-full py-1">
      <StudioClient initialCompanies={serializedCompanies} initialCategories={serializedCategories} dbError={dbError} />
    </div>
  );
}
