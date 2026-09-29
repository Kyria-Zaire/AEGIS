import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { DashboardHeader } from "@/components/dashboard-header";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <DashboardHeader name={session.user.name ?? "Utilisateur"} image={session.user.image} />
      {children}
    </div>
  );
}
