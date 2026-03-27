// minerval/app/invite/accept/page.tsx
import { redirect } from "next/navigation";
import { createSSRClient, getAdminClient } from "@/lib/supabase";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function AcceptInvitePage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
          <p className="text-red-600">Lien d&apos;invitation invalide.</p>
        </div>
      </main>
    );
  }

  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // encodeURIComponent is required — the second `?` in the URL would be misinterpreted
    // by the login page's URL parser without it
    redirect(`/login?redirectTo=${encodeURIComponent(`/invite/accept?token=${token}`)}`);
  }

  const admin = getAdminClient();

  // Look up the invite
  const { data: invite, error: inviteError } = await admin
    .from("school_invites")
    .select("id, school_id, email, role, accepted_at, expires_at")
    .eq("token", token)
    .single();

  if (inviteError || !invite) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
          <p className="text-red-600">Invitation introuvable ou deja utilisee.</p>
        </div>
      </main>
    );
  }

  if (invite.accepted_at) {
    redirect("/dashboard");
  }

  if (new Date(invite.expires_at) < new Date()) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
          <p className="text-red-600">Cette invitation a expire. Demandez a votre admin d&apos;en envoyer une nouvelle.</p>
        </div>
      </main>
    );
  }

  if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
          <p className="text-red-600">
            Cette invitation a ete envoyee a {invite.email}. Vous etes connecte avec {user.email}.
          </p>
        </div>
      </main>
    );
  }

  // Create or reactivate membership
  const { error: membershipError } = await admin.from("school_memberships").upsert(
    {
      user_id: user.id,
      school_id: invite.school_id,
      role: invite.role,
      status: "active",
    },
    { onConflict: "user_id,school_id" }
  );

  if (membershipError) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
          <p className="text-red-600">Impossible d&apos;accepter l&apos;invitation. Reessayez.</p>
        </div>
      </main>
    );
  }

  // Mark invite as accepted
  await admin
    .from("school_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  redirect("/dashboard");
}
