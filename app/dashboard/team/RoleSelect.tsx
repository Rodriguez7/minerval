"use client";
import { useTransition, useState } from "react";
import { changeMemberRole } from "./actions";
import type { MembershipRole } from "@/lib/types";

export function RoleSelect({ memberId, currentRole }: { memberId: string; currentRole: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <select
        value={currentRole}
        disabled={isPending}
        onChange={(e) => {
          setError(null);
          const newRole = e.target.value;
          startTransition(async () => {
            const result = await changeMemberRole(memberId, newRole);
            if (result?.error) setError(result.error);
          });
        }}
        className="border rounded px-2 py-1 text-sm disabled:opacity-50"
      >
        {(["owner", "admin", "finance", "viewer"] as MembershipRole[]).map((r) => (
          <option key={r} value={r}>
            {r === "owner"
              ? "Proprietaire"
              : r === "viewer"
                ? "Lecture"
                : r.charAt(0).toUpperCase() + r.slice(1)}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
