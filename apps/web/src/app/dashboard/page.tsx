import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const workspace = session.user.organizations[0]?.organization;
  const slug = process.env.GITHUB_APP_SLUG;
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <p className="text-sm text-emerald-400">{workspace?.name ?? "Personal Workspace"}</p>
      <h1 className="mt-2 text-3xl font-semibold">Bienvenue {session.user.name ?? "sur Aegis"}</h1>
      <p className="mt-3 max-w-xl text-zinc-400">Connectez votre GitHub App pour commencer à analyser vos dépôts.</p>
      <div className="mt-8 flex gap-3">
        <Button asChild><a href={`https://github.com/apps/${slug}/installations/new`}>Installer Aegis sur GitHub</a></Button>
        <Button asChild variant="outline"><Link href="/dashboard/installations">Voir les installations</Link></Button>
      </div>
    </main>
  );
}
