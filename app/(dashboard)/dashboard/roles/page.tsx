import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import RolesClient from "@/components/roles/RolesClient";

export const dynamic = 'force-dynamic';

export default async function RolesPage() {
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    redirect("/api/auth/clear-session");
  }

  if (!session) redirect("/api/auth/clear-session");
  if (session.user?.role !== 'ADMIN') redirect("/dashboard");

  const currentUserSlug = session.user?.role || 'OPERATEUR';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Rôles &amp; Permissions
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Créez des rôles personnalisés et définissez précisément leurs niveaux d&apos;accès.
        </p>
      </div>

      <RolesClient currentUserSlug={currentUserSlug} />
    </div>
  );
}
