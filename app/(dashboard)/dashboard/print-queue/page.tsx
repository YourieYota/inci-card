import React from 'react';
import PrintQueueClient from '@/components/print-queue/PrintQueueClient';
import { getCompanies } from '@/app/actions/templates';
import { getPrintQueue } from '@/app/actions/batches';
import { Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    companyId?: string;
  }>;
}

export default async function PrintQueuePage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const companyId = resolvedSearchParams.companyId || '';

  let companies: any[] = [];
  let dbError = false;

  try {
    companies = await getCompanies();
  } catch (error) {
    console.error('Error fetching print queue data:', error);
    dbError = true;
  }

  // Serialize dates for Client Component passing
  const serializedCompanies = companies.map(c => ({
    ...c,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : c.updatedAt,
  }));

  return (
    <div className="max-w-7xl mx-auto py-2">
      <PrintQueueClient 
        initialCompanies={serializedCompanies} 
        initialCompanyId={companyId}
        dbError={dbError} 
      />
    </div>
  );
}
