import generated from "./party-logos.generated.json";
import { partyStyleForAcronym } from "./party-styles";

const LOGO_BY_SIGLA = generated as Record<string, string>;

const SIGLA_ALIASES: Record<string, string> = {
  UNIAO: "UNIÃO",
  PODEM: "PODE",
};

export function partyLogoUrl(acronym: string | null | undefined) {
  const key = acronym?.trim().toUpperCase() ?? "";
  if (!key) return null;
  const resolved = SIGLA_ALIASES[key] ?? key;
  return LOGO_BY_SIGLA[resolved] ?? LOGO_BY_SIGLA[key] ?? null;
}

export function partyBadgeFallback(acronym: string | null | undefined) {
  return partyStyleForAcronym(acronym);
}
