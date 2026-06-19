import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import SettingsClient from "./SettingsClient";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    console.error("Session decryption error:", error);
    redirect("/api/auth/clear-session");
  }

  if (!session) {
    redirect("/api/auth/clear-session");
  }
  let dbUser = null;

  if (session?.user?.email) {
    try {
      dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: {
          name: true,
          firstName: true,
          phone: true,
          email: true,
          login: true,
          role: true,
        },
      });
    } catch (error) {
      console.warn("Error loading settings user:", error);
    }
  }

  return (
    <div className="max-w-5xl mx-auto py-2">
      <SettingsClient initialUser={dbUser} />
    </div>
  );
}
