"use client";

import { useRouter } from "next/navigation";
import { loadSample } from "@/lib/actions";
import { setState } from "@/lib/store";
import { Button } from "./ui";

export function SampleButton({ variant = "primary" }: { variant?: "primary" | "secondary" }) {
  const router = useRouter();
  return (
    <Button
      variant={variant}
      className={variant === "primary" ? "px-5 py-3 text-base" : ""}
      onClick={() => {
        setState(loadSample(new Date()));
        router.push("/app");
      }}
    >
      Try with a sample
    </Button>
  );
}
