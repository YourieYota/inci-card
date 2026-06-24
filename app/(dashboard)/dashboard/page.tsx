import { getDashboardStats, getDashboardRecentActivities } from "@/app/actions/employees";
import DashboardClient from "@/components/dashboard/DashboardClient";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // Graceful fallback si la DB est temporairement inaccessible
  let statsData = { companiesCount: 0, totalEmployees: 0, printedCount: 0, pendingPhotoCount: 0 };
  let activitiesData: Awaited<ReturnType<typeof getDashboardRecentActivities>> = { activities: [], total: 0 };
  let dbError = false;

  try {
    [statsData, activitiesData] = await Promise.all([
      getDashboardStats(),
      getDashboardRecentActivities(1, 10),
    ]);
  } catch (error) {
    console.warn("Dashboard DB fetch error:", error);
    dbError = true;
  }

  // Convert Date objects to strings for Client Component serialization
  const serializedActivities = activitiesData.activities.map(act => ({
    ...act,
    date: act.date.toISOString(),
  }));

  return (
    <div className="max-w-7xl mx-auto py-2">
      <DashboardClient
        initialStats={statsData}
        initialActivities={serializedActivities}
        initialTotalActivities={activitiesData.total}
        dbError={dbError}
      />
    </div>
  );
}
