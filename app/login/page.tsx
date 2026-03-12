"use client";
import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import Link from "next/link";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white p-8 rounded-xl shadow">
        <h1 className="text-2xl font-bold mb-1">Minerval</h1>
        <p className="text-gray-500 text-sm mb-6">School admin login</p>
        <form action={action} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input name="email" type="email" required autoComplete="email"
              className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input name="password" type="password" required
              className="w-full border rounded-lg px-3 py-2" />
          </div>
          {state?.error && <p className="text-red-600 text-sm">{state.error}</p>}
          <button type="submit" disabled={pending}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium disabled:opacity-50">
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="text-sm text-gray-500 mt-4 text-center">
          New school? <Link href="/signup" className="text-blue-600">Register here</Link>
        </p>
      </div>
    </main>
  );
}
