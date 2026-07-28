import { createSSRClient } from "@/lib/supabase";

export async function getPlatformAdmin() {
  const ssr = await createSSRClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  const configuredEmail = process.env.SUPER_ADMIN_EMAIL;

  if (!user || !configuredEmail || user.email !== configuredEmail) {
    return null;
  }

  return { id: user.id, email: user.email };
}
