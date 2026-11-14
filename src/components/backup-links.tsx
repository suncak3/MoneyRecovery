"use client";

import { useRef, useState } from "react";
import { appStateSchema } from "@/lib/storage";
import { setState, useAppState } from "@/lib/store";

/** Data lives only in this browser, so the user can save a copy and restore it elsewhere. */
export function BackupLinks() {
  const state = useAppState();
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  function download() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `moneyrecover-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function restore(file: File) {
    try {
      const parsed = appStateSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) throw new Error("invalid");
      setState(parsed.data);
      setMessage("Backup restored.");
    } catch {
      setMessage("That file isn't a MoneyRecover backup.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted">
      <button type="button" onClick={download} className="hover:text-accent">
        Download a backup
      </button>
      <button type="button" onClick={() => input.current?.click()} className="hover:text-accent">
        Restore from backup
      </button>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void restore(file);
          e.target.value = "";
        }}
      />
      {message && <span role="status">{message}</span>}
    </div>
  );
}
