"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, type LoginState } from "@/server/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {
    step: "email",
  });

  if (state.step === "code") {
    return (
      <form action={action} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Wenn <strong>{state.email}</strong> zu unserer Familie gehört, ist
          jetzt eine Mail unterwegs. Tippe auf den Link darin oder gib hier den
          Code ein.
        </p>
        <div className="space-y-2">
          <Label htmlFor="code">Code aus der Mail</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
          />
        </div>
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        <Button
          type="submit"
          name="intent"
          value="code"
          className="w-full"
          disabled={pending}
        >
          Anmelden
        </Button>
        <Button
          type="submit"
          name="intent"
          value="restart"
          variant="link"
          className="w-full"
          formNoValidate
        >
          Andere E-Mail-Adresse
        </Button>
      </form>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-Mail-Adresse</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
        />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button
        type="submit"
        name="intent"
        value="email"
        className="w-full"
        disabled={pending}
      >
        Anmeldelink schicken
      </Button>
    </form>
  );
}
