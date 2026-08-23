import type { Country } from "react-phone-number-input";

// Sri Lanka plus its verified spice export markets (EDB, National Export
// Strategy, OEC trade data). LK is default and listed first. This list is the
// product control for who can enter a number — the backend and DB stay generic
// E.164 on purpose, so trimming or extending this list can never lock a
// registered user out of their account. Change only on manager instruction.
export const PHONE_COUNTRIES: Country[] = [
  "LK",
  // South Asia
  "IN", "PK", "BD",
  // East & Southeast Asia
  "CN", "JP", "KR", "SG", "MY",
  // Middle East
  "AE", "SA", "QA", "KW", "OM", "TR",
  // Europe
  "DE", "GB", "NL", "FR", "IT", "ES", "BE", "PL",
  // Americas (cinnamon belt + North America)
  "US", "CA", "MX", "PE", "CO", "EC", "GT", "SV", "CL", "BR",
  // Oceania
  "AU", "NZ",
];
