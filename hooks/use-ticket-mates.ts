"use client";

import { useEffect, useState } from "react";
import type { Selections } from "@/lib/ballot-selections";
import { fetchTicketSlateForOffice, officesWithTicketSlateSelections } from "@/lib/ticket-mate-fetch";
import type { CandidateSummary } from "@/lib/types";

export function useTicketSlates(selections: Selections) {
  const [slates, setSlates] = useState<Record<string, CandidateSummary[]>>({});

  useEffect(() => {
    const targets = officesWithTicketSlateSelections(selections);
    if (!targets.length) {
      setSlates({});
      return;
    }

    const controller = new AbortController();

    void Promise.all(
      targets.map(async (office) => {
        const selection = selections[office.id];
        if (selection?.type !== "candidate") return [office.id, []] as const;
        const slate = await fetchTicketSlateForOffice(office, selection.candidate, controller.signal);
        return [office.id, slate] as const;
      }),
    ).then((entries) => {
      if (controller.signal.aborted) return;
      setSlates(Object.fromEntries(entries));
    }).catch(() => {
      if (!controller.signal.aborted) setSlates({});
    });

    return () => controller.abort();
  }, [selections]);

  return slates;
}

/** @deprecated use useTicketSlates */
export function useTicketMates(selections: Selections) {
  const slates = useTicketSlates(selections);
  return Object.fromEntries(
    Object.entries(slates).map(([officeId, slate]) => [officeId, slate[0] ?? null]),
  );
}
