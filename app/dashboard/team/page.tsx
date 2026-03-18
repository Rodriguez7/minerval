import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";
import { deactivateMember } from "./actions";
import { RoleSelect } from "./RoleSelect";
import type { MembershipRole } from "@/lib/types";

async function loadTeamData() {
  const { school, membership: currentMembership, user } = await getTenantContext();
  const admin = getAdminClient();

  const { data: members } = await admin
    .from("school_memberships")
    .select("id, user_id, role, status, created_at")
    .eq("school_id", school.id)
    .order("created_at");

  // NOTE: listUsers() defaults to perPage:50 and caps at 1,000. For Phase 1b (small teams)
  // this is fine, but will silently show "(unknown)" for emails beyond page 1 at scale.
  // Phase 1b-SSR plan should track adding pagination or a per-user lookup.
  const { data: { users } } = await admin.auth.admin.listUsers();
  const emailMap = new Map(users.map((u) => [u.id, u.email ?? ""]));

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

const ROLE_LABELS: Record<MembershipRole, string> = {
  owner: "Owner",
  admin: "Admin",
  finance: "Finance",
  viewer: "Viewer",
};

export default async function TeamPage() {
  const { members, currentMembership, currentUserId } = await loadTeamData();
  const canManage = ["owner", "admin"].includes(currentMembership.role);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Team</h1>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              {["Email", "Role", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-gray-500 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {members.map((m) => {
              const isSelf = m.user_id === currentUserId;
              return (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {m.email}
                    {isSelf && (
                      <span className="ml-2 text-xs text-gray-400">(you)</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canManage && !isSelf ? (
                      <RoleSelect memberId={m.id} currentRole={m.role} />
                    ) : (
                      <span>{ROLE_LABELS[m.role as MembershipRole] ?? m.role}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        m.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 space-x-3">
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
                          className="text-xs text-red-600 hover:underline"
                        >
                          Deactivate
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
