import React from 'react';
import CompaniesClient from '@/components/companies/CompaniesClient';
import { getCompaniesWithCounts } from '@/app/actions/templates';
import { getCardCategories } from '@/app/actions/cards';
import { AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CompaniesPage() {
  let companies: Awaited<ReturnType<typeof getCompaniesWithCounts>> = [];
  let globalCategories: any[] = [];
  let dbError = false;

  try {
    companies = await getCompaniesWithCounts();
    globalCategories = await getCardCategories(null);
  } catch {
    dbError = true;
  }

  const serializedCompanies = companies.map(c => ({
    ...c,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
  })) as any;

  return (
    <div className="max-w-7xl mx-auto py-2">
      <CompaniesClient initialCompanies={serializedCompanies} dbError={dbError} globalCategories={globalCategories} />
    </div>
  );
}

