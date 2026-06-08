export type ActionResult = {
  success: boolean;
  message: string;
  recoveryCodes?: string[];
};

export function ok(message: string, extra?: Omit<ActionResult, "success" | "message">): ActionResult {
  return { success: true, message, ...extra };
}

export function fail(message: string): ActionResult {
  return { success: false, message };
}
