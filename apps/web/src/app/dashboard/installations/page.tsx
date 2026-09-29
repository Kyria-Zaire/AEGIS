import { redirect } from "next/navigation";

import { prisma } from "@aegis/db";
import { auth } from "@/lib/auth";

export default async function InstallationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const organizationIds = session.user.organizations.map(({ organization }) => organization.id);
  const installations = await prisma().githubInstallation.findMany({
    where: { organizationId: { in: organizationIds }, deletedAt: null },
    include: { _count: { select: { repositories: { where: { deletedAt: null } } } } },
  });
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Installations GitHub</h1>
      {installations.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-zinc-700 p-10 text-center text-zinc-400">Aucune installation connectée.</div>
      ) : (
        <ul className="mt-8 grid gap-3">
          {installations.map((installation) => (
            <li key={installation.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <strong>{installation.accountLogin}</strong>
              <span className="ml-3 text-sm text-zinc-400">{installation._count.repositories} dépôts</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
