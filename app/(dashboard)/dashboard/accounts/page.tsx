import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AccountsClient from "@/components/accounts/AccountsClient";

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    console.warn("Session decryption error, redirecting to clear-session:", error);
    redirect("/api/auth/clear-session");
  }

  // If no session at all, clear cookies and force re-login
  if (!session) {
    redirect("/api/auth/clear-session");
  }

  // Restrict access to ADMIN role only
  if (session.user?.role !== 'ADMIN') {
    redirect("/dashboard");
  }

  // Get current logged in user details to prevent self-deletion or self-demotion
  let currentUser = null;
  if (session.user.email) {
    try {
      currentUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: {
          id: true,
          email: true,
          name: true,
        }
      });
    } catch {
      // DB inaccessible — currentUser reste null, AccountsClient gérera l'état vide
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gestion des Comptes</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Gérez les comptes d&apos;accès du personnel de l&apos;imprimerie nationale.
        </p>
      </div>

      <AccountsClient currentUser={currentUser} />
    </div>
  );
}
