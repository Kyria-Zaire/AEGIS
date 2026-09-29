import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { auth, signIn } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await auth()) redirect("/dashboard");
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">
      <section className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center shadow-2xl">
        <div className="mb-3 text-xs font-semibold tracking-[0.3em] text-emerald-400">AEGIS</div>
        <h1 className="text-2xl font-semibold text-white">Sécurisez votre code</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">Connectez-vous pour relier vos dépôts GitHub.</p>
        <form
          className="mt-8"
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: "/dashboard" });
          }}
        >
          <Button className="w-full" size="lg" type="submit">
            Se connecter avec GitHub
          </Button>
        </form>
      </section>
    </main>
  );
}
