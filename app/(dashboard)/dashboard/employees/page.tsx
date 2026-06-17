import React from 'react';
import EmployeesClient from '@/components/employees/EmployeesClient';
import { getCompanies } from '@/app/actions/templates';
import { getEmployees } from '@/app/actions/employees';
import { Employee } from '@prisma/client';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    companyId?: string;
  }>;
}

export default async function EmployeesPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const companyId = resolvedSearchParams.companyId || '';

  const companies = await getCompanies();
  let initialEmployees: Employee[] = [];

  if (companyId) {
    try {
      initialEmployees = await getEmployees(companyId);
    } catch (error) {
      console.error('Error fetching initial employees:', error);
    }
  }

  return (
    <div className="max-w-7xl mx-auto py-2">
      <EmployeesClient
        companies={companies}
        initialCompanyId={companyId}
        initialEmployees={initialEmployees}
      />
    </div>
  );
}
