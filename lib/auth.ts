import { redirect } from "next/navigation";
import { createSSRClient, getAdminClient } from "./supabase";
import type { School } from "./types";

export async function getAuthenticatedSchool(): Promise<School> {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: school } = await getAdminClient()
    .from("schools")
    .select("*")
    .eq("admin_email", user.email!)
    .single();

  if (!school) redirect("/login");
  return school as School;
}
