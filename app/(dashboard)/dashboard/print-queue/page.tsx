import React from 'react';
import PrintQueueClient from '@/components/print-queue/PrintQueueClient';
import { getCompanies } from '@/app/actions/templates';
import { getPrintQueue } from '@/app/actions/batches';
import { Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PrintQueuePage() {
  let companies: any[] = [];
  let printQueue: any[] = [];
  let dbError = false;

  try {
    const [companiesData, queueData] = await Promise.all([
      getCompanies(),
      getPrintQueue()
    ]);
    companies = companiesData;
    printQueue = queueData;
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

  const serializedQueue = printQueue.map(emp => ({
    ...emp,
    createdAt: emp.createdAt instanceof Date ? emp.createdAt.toISOString() : emp.createdAt,
    updatedAt: emp.updatedAt instanceof Date ? emp.updatedAt.toISOString() : emp.updatedAt,
    printedAt: emp.printedAt instanceof Date ? emp.printedAt.toISOString() : emp.printedAt,
  }));

  return (
    <div className="max-w-7xl mx-auto py-2">
      <PrintQueueClient 
        initialCompanies={serializedCompanies} 
        initialQueue={serializedQueue} 
        dbError={dbError} 
      />
    </div>
  );
}
