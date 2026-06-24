import React from 'react';
import CompaniesClient from '@/components/companies/CompaniesClient';
import { getCompaniesWithCounts } from '@/app/actions/templates';
import { AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CompaniesPage() {
  let companies: Awaited<ReturnType<typeof getCompaniesWithCounts>> = [];
  let dbError = false;

  try {
    companies = await getCompaniesWithCounts();
  } catch {
    dbError = true;
  }

  const serializedCompanies = companies.map(c => ({
    ...c,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
  })) as any;

  return (
    <div className="max-w-7xl mx-auto py-2">
      <CompaniesClient initialCompanies={serializedCompanies} dbError={dbError} />
    </div>
  );
}

