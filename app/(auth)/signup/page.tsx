import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export default function SignupPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-primary font-bold text-primary-foreground">
              O
            </div>

            <div>
              <h1 className="text-lg font-semibold">
                Create Clinic Account
              </h1>

              <p className="text-sm text-muted-foreground">
                OrbitOS organisation onboarding
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4">
          <Field label="Clinic Name">
            <Input placeholder="Laser Treat Esthetica" />
          </Field>

          <Field label="Owner Username">
            <Input placeholder="owner username" />
          </Field>

          <Field label="Email">
            <Input
              type="email"
              placeholder="clinic@email.com"
            />
          </Field>

          <Field label="Password">
            <Input
              type="password"
              placeholder="Create password"
            />
          </Field>

          <Button type="button">
            Create Account
          </Button>

          <Link href="/login" className="w-full">
            <Button
              type="button"
              variant="outline"
              className="w-full"
            >
              Back to Login
            </Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
