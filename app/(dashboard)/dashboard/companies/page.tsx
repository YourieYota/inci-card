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

  const serializedCompanies = JSON.parse(JSON.stringify(companies));
  const serializedGlobalCategories = JSON.parse(JSON.stringify(globalCategories));

  return (
    <div className="w-full max-w-[1920px] mx-auto px-2 md:px-4 py-2">
      <CompaniesClient initialCompanies={serializedCompanies} dbError={dbError} globalCategories={serializedGlobalCategories} />
    </div>
  );
}

