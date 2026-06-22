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
  const resolvedSearchParams = await searchParams;
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

  // Serialize Date objects for React 19 / Next.js client component compatibility
  const serializedCompanies = companies.map(c => ({
    ...c,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : c.updatedAt,
  }));

  const serializedEmployees = initialEmployees.map(emp => ({
    ...emp,
    createdAt: emp.createdAt instanceof Date ? emp.createdAt.toISOString() : emp.createdAt,
    updatedAt: emp.updatedAt instanceof Date ? emp.updatedAt.toISOString() : emp.updatedAt,
    printedAt: emp.printedAt instanceof Date ? emp.printedAt.toISOString() : emp.printedAt,
    photoValidatedAt: emp.photoValidatedAt instanceof Date ? emp.photoValidatedAt.toISOString() : emp.photoValidatedAt,
  }));

  return (
    <div className="max-w-7xl mx-auto py-2">
      <EmployeesClient
        companies={serializedCompanies as any}
        initialCompanyId={companyId}
        initialEmployees={serializedEmployees as any}
        dbError={dbError}
      />
    </div>
  );
}
