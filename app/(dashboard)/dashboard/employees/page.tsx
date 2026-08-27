import React from 'react';
import EmployeesClient from '@/components/employees/EmployeesClient';
import { getCompanies } from '@/app/actions/templates';
import { getEmployees } from '@/app/actions/employees';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams?: Promise<{
    companyId?: string;
  }> | {
    companyId?: string;
  };
}

export default async function EmployeesPage({ searchParams }: PageProps) {
  let resolvedSearchParams: { companyId?: string } = {};
  if (searchParams) {
    try {
      resolvedSearchParams = typeof (searchParams as any).then === 'function' 
        ? await searchParams 
        : (searchParams as any);
    } catch (e) {
      resolvedSearchParams = {};
    }
  }

  const companyId = resolvedSearchParams?.companyId || '';

  let companies: Awaited<ReturnType<typeof getCompanies>> = [];
  let initialEmployees: any[] = [];
  let dbError = false;

  try {
    const res = await getCompanies();
    companies = Array.isArray(res) ? res : [];
  } catch (error) {
    console.warn('Error fetching companies:', error);
    dbError = true;
    companies = [];
  }

  if (companyId && !dbError) {
    try {
      const res = await getEmployees(companyId);
      initialEmployees = Array.isArray(res) ? res : [];
    } catch (error) {
      console.warn('Error fetching initial employees:', error);
      dbError = true;
      initialEmployees = [];
    }
  }

  // Deeply serialize Date objects and complex properties for React 19 / Next.js client component compatibility
  const serializedCompanies = companies && companies.length > 0 ? JSON.parse(JSON.stringify(companies)) : [];
  const serializedEmployees = initialEmployees && initialEmployees.length > 0 ? JSON.parse(JSON.stringify(initialEmployees)) : [];

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
