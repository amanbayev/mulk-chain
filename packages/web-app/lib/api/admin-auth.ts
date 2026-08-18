const WALLET_RE = /^0x[0-9a-fA-F]{40}$/;

function allowlist(): string[] {
  return (process.env.ADMIN_WALLETS ?? "")
    .split(/[,;\s]+/)
    .map((value) => value.trim().toLowerCase())
    .filter((value) => WALLET_RE.test(value));
}

export function isAdminWallet(wallet?: string | null): boolean {
  if (!wallet || !WALLET_RE.test(wallet)) return false;
  const listed = allowlist();
  if (listed.length > 0) return listed.includes(wallet.toLowerCase());
  if (process.env.NODE_ENV === "production") return false;
  return true;
}

export function authorizeAdmin(headers: Headers): { ok: true; wallet?: string } | { ok: false; status: number; message: string } {
  const key = process.env.ADMIN_API_KEY?.trim();
  const providedKey = headers.get("x-admin-key")?.trim();
  if (key && providedKey && providedKey === key) {
    return { ok: true };
  }
  const wallet = headers.get("x-admin-wallet");
  if (isAdminWallet(wallet)) {
    return { ok: true, wallet: wallet ?? undefined };
  }
  return { ok: false, status: 403, message: "Admin allowlist required. Connect an ADMIN_WALLETS address or send x-admin-key." };
}
