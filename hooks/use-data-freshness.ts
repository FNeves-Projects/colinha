"use client";

import { useEffect, useState } from "react";
import type { DataFreshness } from "@/lib/data-freshness";

export function useDataFreshness() {
  const [freshness, setFreshness] = useState<DataFreshness | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/data-status", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { freshness?: DataFreshness | null } | null) => {
        if (!cancelled) setFreshness(payload?.freshness ?? null);
      })
      .catch(() => {
        if (!cancelled) setFreshness(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return freshness;
}
