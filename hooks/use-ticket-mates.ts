"use client";

import { useEffect, useState } from "react";
import type { Selections } from "@/lib/ballot-selections";
import { OFFICES } from "@/lib/offices";
import { fetchTicketMateForOffice, officesWithTicketMateSelections } from "@/lib/ticket-mate-fetch";
import type { CandidateSummary } from "@/lib/types";

export function useTicketMates(selections: Selections) {
  const [mates, setMates] = useState<Record<string, CandidateSummary | null>>({});

  useEffect(() => {
    const targets = officesWithTicketMateSelections(selections);
    if (!targets.length) {
      setMates({});
      return;
    }

    const controller = new AbortController();

    void Promise.all(
      targets.map(async (office) => {
        const selection = selections[office.id];
        if (selection?.type !== "candidate") return [office.id, null] as const;
        const mate = await fetchTicketMateForOffice(office, selection.candidate, controller.signal);
        return [office.id, mate] as const;
      }),
    ).then((entries) => {
      if (controller.signal.aborted) return;
      setMates(Object.fromEntries(entries));
    }).catch(() => {
      if (!controller.signal.aborted) setMates({});
    });

    return () => controller.abort();
  }, [selections]);

  return mates;
}
