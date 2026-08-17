export const EGKN_CANONICAL = /^\d{2}:\d{3}:\d{7}:\d{1,4}$/;
export const MULK_CADASTRE = /^KZ-[A-Z0-9]+(?:-[A-Z0-9]+)+$/i;

export interface CadastreValidation {
  ok: boolean;
  canonical: string;
  error?: string;
}

/**
 * Accepts ЕГКН canonical `NN:NNN:NNNNNNN:N` or the platform identifier `KZ-…`.
 * Backend additionally requires length ≥ 3; this form is stricter for issuer UX.
 */
export function validateCadastralNumber(raw: string): CadastreValidation {
  const canonical = raw.trim();
  if (canonical.length < 3) {
    return { ok: false, canonical, error: "Cadastral number is too short" };
  }
  if (EGKN_CANONICAL.test(canonical)) {
    return { ok: true, canonical };
  }
  if (MULK_CADASTRE.test(canonical) && canonical.length >= 8) {
    return { ok: true, canonical: canonical.toUpperCase() };
  }
  return {
    ok: false,
    canonical,
    error: "Expected EGKN format NN:NNN:NNNNNNN:N or platform id KZ-…",
  };
}

export function isValidEthereumAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}
