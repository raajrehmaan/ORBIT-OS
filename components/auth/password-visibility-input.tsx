"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

export function PasswordVisibilityInput() {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        name="password"
        type={visible ? "text" : "password"}
        autoComplete="current-password"
        className="pr-11"
        required
      />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        className="focus-ring absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
