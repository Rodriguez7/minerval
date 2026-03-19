"use client";
import { useActionState } from "react";
import { sendInvite } from "./actions";

type State = { error?: string; inviteLink?: string } | undefined;

async function inviteAction(_: State, formData: FormData): Promise<State> {
  const email = formData.get("email") as string;
  const role = formData.get("role") as string;
  return await sendInvite(email, role);
}

export function InviteForm() {
  const [state, action, isPending] = useActionState(inviteAction, undefined);

  return (
    <form action={action} className="flex flex-wrap gap-3 items-end">
      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input
          name="email"
          type="email"
          required
          placeholder="colleague@school.com"
          className="border rounded-lg px-3 py-2 text-sm w-64"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Role</label>
        <select name="role" className="border rounded-lg px-3 py-2 text-sm bg-white">
          <option value="admin">Admin</option>
          <option value="finance">Finance</option>
          <option value="viewer">Viewer</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Send invite"}
      </button>

      {state?.error && (
        <p className="w-full text-sm text-red-600">{state.error}</p>
      )}
      {state?.inviteLink && (
        <div className="w-full text-sm">
          <p className="text-green-700 font-medium">Invite sent!</p>
          <p className="text-gray-500 mt-1">
            Share this link if email doesn&apos;t arrive:{" "}
            <a href={state.inviteLink} className="text-blue-600 hover:underline break-all">
              {state.inviteLink}
            </a>
          </p>
        </div>
      )}
    </form>
  );
}
