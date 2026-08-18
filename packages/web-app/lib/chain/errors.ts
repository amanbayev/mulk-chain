export function walletErrorMessage(error: unknown): string {
  if (!error) return "Transaction failed";
  if (typeof error === "object" && error !== null) {
    const record = error as { shortMessage?: string; message?: string };
    if (typeof record.shortMessage === "string" && record.shortMessage.length > 0) {
      return record.shortMessage;
    }
    if (typeof record.message === "string" && record.message.length > 0) {
      return record.message;
    }
  }
  return "Transaction failed";
}
