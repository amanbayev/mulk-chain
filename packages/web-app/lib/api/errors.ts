export interface DemoError extends Error {
  status: number;
  code: string;
}

export function fail(status: number, code: string, message: string): never {
  const error = new Error(message) as DemoError;
  error.status = status;
  error.code = code;
  throw error;
}

export function isDemoError(error: unknown): error is DemoError {
  return Boolean(error && typeof error === "object" && "status" in error && "code" in error);
}
