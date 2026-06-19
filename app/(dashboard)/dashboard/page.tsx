import { getDashboardStats, getDashboardRecentActivities } from "@/app/actions/employees";
import DashboardClient from "@/components/dashboard/DashboardClient";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // Graceful fallback si la DB est temporairement inaccessible
  let statsData = { companiesCount: 0, totalEmployees: 0, printedCount: 0, pendingPhotoCount: 0 };
  let activities: Awaited<ReturnType<typeof getDashboardRecentActivities>> = [];
  let dbError = false;

  try {
    [statsData, activities] = await Promise.all([
      getDashboardStats(),
      getDashboardRecentActivities(),
    ]);
  } catch (error) {
    console.warn("Dashboard DB fetch error:", error);
    dbError = true;
  }

  // Convert Date objects to strings for Client Component serialization
  const serializedActivities = activities.map(act => ({
    ...act,
    date: act.date.toISOString(),
  }));

  return (
    <div className="max-w-7xl mx-auto py-2">
      <DashboardClient
        initialStats={statsData}
        initialActivities={serializedActivities}
        dbError={dbError}
      />
    </div>
  );
}
