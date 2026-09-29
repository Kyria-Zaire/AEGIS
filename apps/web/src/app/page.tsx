import { SEVERITIES } from "@aegis/core";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-6">
      <div className="space-y-3">
        <p className="font-mono text-sm text-muted-foreground">aegis</p>
        <h1 className="text-4xl font-semibold tracking-tight">AI security scanning for dev teams.</h1>
        <p className="text-muted-foreground">
          Severity levels: <span className="font-mono">{SEVERITIES.join(" · ")}</span>
        </p>
      </div>
      <div>
        <Button disabled>Connect a repository</Button>
      </div>
    </main>
  );
}
