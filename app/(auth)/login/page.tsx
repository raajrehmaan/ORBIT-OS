import { signInWithClinicPassword } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const params = await searchParams;
  const user = await getCurrentUserProfile();

  if (user) {
    const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/dashboard";
    redirect(next);
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-primary font-bold text-primary-foreground">O</div>
            <div>
              <h1 className="text-lg font-semibold">Sign in to OrbitOS</h1>
              <p className="text-sm text-muted-foreground">Use your organisation account</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form action={signInWithClinicPassword} className="grid gap-4">
            <input type="hidden" name="next" value={params.next ?? "/dashboard"} />
            <Field label="Username">
              <Input name="username" autoComplete="username" required />
            </Field>
            <Field label="Password">
              <Input name="password" type="password" autoComplete="current-password" required />
            </Field>
            {params.error ? <p className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">{params.error}</p> : null}
            <Button type="submit">Sign in</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
