import React from 'react';
import DeliveryBatchesClient from '@/components/delivery-batches/DeliveryBatchesClient';
import { getCompanies } from '@/app/actions/templates';
import { getDeliveryBatches } from '@/app/actions/batches';

export const dynamic = 'force-dynamic';

export default async function DeliveryBatchesPage() {
  let companies: any[] = [];
  let batches: any[] = [];
  let dbError = false;

  try {
    const [companiesData, batchesData] = await Promise.all([
      getCompanies(),
      getDeliveryBatches()
    ]);
    companies = companiesData;
    batches = batchesData;
  } catch (error) {
    console.error('Error fetching delivery batches data:', error);
    dbError = true;
  }

  // Serialize dates for Client Component passing
  const serializedCompanies = companies.map(c => ({
    ...c,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : c.updatedAt,
  }));

  const serializedBatches = batches.map(b => ({
    ...b,
    createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : b.createdAt,
    updatedAt: b.updatedAt instanceof Date ? b.updatedAt.toISOString() : b.updatedAt,
    shippedAt: b.shippedAt instanceof Date ? b.shippedAt.toISOString() : b.shippedAt,
    deliveredAt: b.deliveredAt instanceof Date ? b.deliveredAt.toISOString() : b.deliveredAt,
  }));

  return (
    <div className="max-w-7xl mx-auto py-2">
      <DeliveryBatchesClient 
        initialCompanies={serializedCompanies} 
        initialBatches={serializedBatches} 
        dbError={dbError} 
      />
    </div>
  );
}
