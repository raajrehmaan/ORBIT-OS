import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <Card>
      <CardContent className="grid gap-3 py-8 text-center">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
        </div>
        {action ? <div className="flex justify-center">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
