"use client";

import { useRef, useState } from "react";
import { extractedStubSchema, extractionToForm } from "@/lib/extraction";
import type { StubForm } from "@/lib/stub-form";
import { Button } from "./ui";

const MAX_SIDE = 1600;

/** Shrinks the photo in the browser so uploads stay small and fast on a phone connection. */
async function downscale(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not read the image"))), "image/jpeg", 0.85),
  );
}

export function StubUpload({ onExtracted }: { onExtracted: (form: StubForm) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ busy: boolean; message: string | null }>({ busy: false, message: null });

  async function upload(file: File) {
    setStatus({ busy: true, message: "Reading your stub…" });
    try {
      const body = new FormData();
      body.append("image", await downscale(file), "stub.jpg");
      const response = await fetch("/api/extract-stub", { method: "POST", body });
      const json: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = (json as { error?: string } | null)?.error;
        throw new Error(message ?? "We couldn't read that photo.");
      }
      const parsed = extractedStubSchema.safeParse(json);
      if (!parsed.success) throw new Error("We couldn't read that photo.");
      onExtracted(extractionToForm(parsed.data));
      setStatus({ busy: false, message: null });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "We couldn't read that photo.";
      setStatus({ busy: false, message: `${reason} You can type the numbers in below instead.` });
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-semibold">Have a photo of your pay stub?</h2>
        <p className="text-sm text-muted">We&apos;ll fill in the form for you to review. The photo is read in memory and never stored.</p>
        {status.message && (
          <p role="status" className="mt-2 text-sm text-warn">
            {status.message}
          </p>
        )}
      </div>
      <Button variant="secondary" disabled={status.busy} onClick={() => input.current?.click()} className="shrink-0">
        {status.busy ? "Reading…" : "Upload a photo"}
      </Button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
