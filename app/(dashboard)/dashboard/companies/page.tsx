import React from 'react';
import CompaniesClient from '@/components/companies/CompaniesClient';
import { getCompaniesWithCounts } from '@/app/actions/templates';

export const dynamic = 'force-dynamic';

export default async function CompaniesPage() {
  const companies = await getCompaniesWithCounts();

  return (
    <div className="max-w-7xl mx-auto py-2">
      <CompaniesClient initialCompanies={companies} />
    </div>
  );
}
