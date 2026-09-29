import Link from "next/link";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";

export function DashboardHeader({ name, image }: { name: string; image?: string | null }) {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/dashboard" className="font-semibold tracking-[0.2em] text-emerald-400">AEGIS</Link>
        <div className="flex items-center gap-3">
          {image ? (
            // GitHub avatar URL is supplied by the authenticated profile.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="size-8 rounded-full" />
          ) : <span className="grid size-8 place-items-center rounded-full bg-zinc-800 text-xs">{name[0]}</span>}
          <span className="hidden text-sm text-zinc-300 sm:inline">{name}</span>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
            <Button variant="ghost" size="sm" type="submit">Déconnexion</Button>
          </form>
        </div>
      </div>
    </header>
  );
}
