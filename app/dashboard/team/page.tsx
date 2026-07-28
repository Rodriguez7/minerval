import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";
import { deactivateMember } from "./actions";
import { RoleSelect } from "./RoleSelect";
import { InviteForm } from "./InviteForm";
import type { MembershipRole } from "@/lib/types";
import { getRequestLocale } from "@/lib/i18n/server";

async function loadTeamData() {
  const { school, membership: currentMembership, user } = await getTenantContext();
  const admin = getAdminClient();

  const { data: members } = await admin
    .from("school_memberships")
    .select("id, user_id, role, status, created_at")
    .eq("school_id", school.id)
    .order("created_at");

  const { data: listData } = await admin.auth.admin.listUsers();
  const emailMap = new Map(
    (listData?.users ?? []).map((u) => [u.id, u.email ?? ""])
  );

  return {
    school,
    currentMembership,
    currentUserId: user.id,
    members: (members ?? []).map((m) => ({
      ...m,
      email: emailMap.get(m.user_id) ?? "(unknown)",
    })),
  };
}

export default async function TeamPage() {
  const locale = await getRequestLocale();
  const fr = locale === "fr";
  const roleLabels: Record<MembershipRole, string> = {
    owner: fr ? "Propriétaire" : "Owner",
    admin: "Admin",
    finance: "Finance",
    viewer: fr ? "Lecture" : "Viewer",
  };
  const { members, currentMembership, currentUserId } = await loadTeamData();
  const canManage = ["owner", "admin"].includes(currentMembership.role);

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{fr ? "Équipe" : "Team"}</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {fr ? "Gérez les membres et les rôles d’accès" : "Manage members and access roles"}
        </p>
      </div>

      {canManage && (
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">
            {fr ? "Inviter un membre" : "Invite a member"}
          </h2>
          <InviteForm />
        </div>
      )}

      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">
            {fr ? "Membres" : "Members"}
            <span className="ml-2 text-xs font-normal text-zinc-400">{members.length}</span>
          </h2>
        </div>
        <div className="overflow-x-auto"><table>
          <thead>
            <tr className="border-b border-zinc-100">
              {(fr ? ["E-mail", "Rôle", "Statut", ""] : ["Email", "Role", "Status", ""]).map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {members.map((m) => {
              const isSelf = m.user_id === currentUserId;
              return (
                <tr key={m.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-zinc-900">
                    {m.email}
                    {isSelf && (
                      <span className="ml-2 text-xs text-zinc-400">({fr ? "vous" : "you"})</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600">
                    {canManage && !isSelf ? (
                      <RoleSelect memberId={m.id} currentRole={m.role} />
                    ) : (
                      <span>{roleLabels[m.role as MembershipRole] ?? m.role}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        m.status === "active"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-zinc-100 text-zinc-500 border border-zinc-200"
                      }`}
                    >
                      {m.status === "active" ? fr ? "actif" : "active" : fr ? "inactif" : "inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {canManage && !isSelf && m.status === "active" && (
                      <form
                        action={async () => {
                          "use server";
                          await deactivateMember(m.id);
                        }}
                        className="inline"
                      >
                        <button
                          type="submit"
                          className="text-xs text-red-600 hover:underline transition-colors"
                        >
                          {fr ? "Désactiver" : "Deactivate"}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
