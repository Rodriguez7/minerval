"use client";
import { useActionState } from "react";
import { signup } from "@/app/actions/auth";
import Link from "next/link";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, null);
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white p-8 rounded-xl shadow">
        <h1 className="text-2xl font-bold mb-1">Minerval</h1>
        <p className="text-gray-500 text-sm mb-6">Register your school</p>
        <form action={action} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">School Name</label>
            <input name="schoolName" type="text" required placeholder="e.g. École Sainte Marie"
              className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">School Code</label>
            <input name="schoolCode" type="text" required placeholder="e.g. sainte-marie"
              className="w-full border rounded-lg px-3 py-2" />
            <p className="text-xs text-gray-400 mt-1">Lowercase letters, numbers, hyphens. Used in payment URLs.</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Admin Email</label>
            <input name="email" type="email" required
              className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input name="password" type="password" required minLength={8}
              className="w-full border rounded-lg px-3 py-2" />
          </div>
          {state?.error && <p className="text-red-600 text-sm">{state.error}</p>}
          <button type="submit" disabled={pending}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium disabled:opacity-50">
            {pending ? "Creating…" : "Create School"}
          </button>
        </form>
        <p className="text-sm text-gray-500 mt-4 text-center">
          Already registered? <Link href="/login" className="text-blue-600">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
