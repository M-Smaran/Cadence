"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveApiKeys } from "@/app/actions/settings";
import { useRef, useTransition } from "react";

interface ApiKeysFormProps {
  hasOpenaiKey: boolean;
  hasCalcomKey: boolean;
}

export function ApiKeysForm({ hasOpenaiKey, hasCalcomKey }: ApiKeysFormProps) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await saveApiKeys(formData);
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          OpenAI API Key
        </label>
        <Input
          name="openaiApiKey"
          type="password"
          placeholder={hasOpenaiKey ? "••••••••••••••••" : "sk-..."}
          autoComplete="off"
        />
        {hasOpenaiKey && (
          <p className="text-xs text-muted-foreground">
            A key is already saved. Enter a new one to replace it.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          Cal.com API Key
        </label>
        <Input
          name="calcomApiKey"
          type="password"
          placeholder={hasCalcomKey ? "••••••••••••••••" : "cal_live_..."}
          autoComplete="off"
        />
        {hasCalcomKey && (
          <p className="text-xs text-muted-foreground">
            A key is already saved. Enter a new one to replace it.
          </p>
        )}
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save Keys"}
      </Button>
    </form>
  );
}
