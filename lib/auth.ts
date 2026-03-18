// minerval/lib/auth.ts
import { getTenantContext } from "./tenant";
import type { School } from "./types";

/**
 * Backward-compat shim. Returns the authenticated user's school.
 * For new code, prefer getTenantContext() to get membership + plan too.
 */
export async function getAuthenticatedSchool(): Promise<School> {
  const { school } = await getTenantContext();
  return school;
}
