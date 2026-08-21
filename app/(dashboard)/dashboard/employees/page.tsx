import React from 'react';
import EmployeesClient from '@/components/employees/EmployeesClient';
import { getCompanies } from '@/app/actions/templates';
import { getEmployees } from '@/app/actions/employees';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    companyId?: string;
  }>;
}

export default async function EmployeesPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const companyId = resolvedSearchParams.companyId || '';

  let companies: Awaited<ReturnType<typeof getCompanies>> = [];
  let initialEmployees: any[] = [];
  let dbError = false;

  try {
    companies = await getCompanies();
  } catch (error) {
    console.warn('Error fetching companies:', error);
    dbError = true;
  }

  if (companyId && !dbError) {
    try {
      initialEmployees = await getEmployees(companyId);
    } catch (error) {
      console.warn('Error fetching initial employees:', error);
      dbError = true;
    }
  }

  // Deeply serialize Date objects and complex properties for React 19 / Next.js client component compatibility
  const serializedCompanies = JSON.parse(JSON.stringify(companies));
  const serializedEmployees = JSON.parse(JSON.stringify(initialEmployees));

  return (
    <div className="w-full max-w-[1920px] mx-auto px-2 md:px-4 py-2">
      <EmployeesClient
        companies={serializedCompanies as any}
        initialCompanyId={companyId}
        initialEmployees={serializedEmployees as any}
        dbError={dbError}
      />
    </div>
  );
}
