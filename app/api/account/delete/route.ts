import { NextResponse } from "next/server";
import { createSSRClient, getAdminClient } from "@/lib/supabase";
import { consumeRateLimit } from "@/lib/rate-limit";
import { deletePersonalAccount } from "@/lib/user-account-deletion";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authenticated = await createSSRClient();
  const { data: { user } } = await authenticated.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
  }

  const confirmation = getString(body, "confirmation");
  const password = getString(body, "password") ?? "";
  if (confirmation !== user.email) {
    return NextResponse.json(
      { error: "Saisissez exactement votre adresse email pour confirmer." },
      { status: 400 }
    );
  }
  if (password.length < 6 || password.length > 200) {
    return NextResponse.json({ error: "Mot de passe invalide." }, { status: 400 });
  }

  const rateLimit = await consumeRateLimit({
    key: `user-account-deletion:${user.id}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Trop de tentatives. Reessayez dans ${rateLimit.retryAfterSeconds} secondes.` },
      { status: 429 }
    );
  }

  const result = await deletePersonalAccount({
    userId: user.id,
    email: user.email,
    password,
    authenticated,
    admin: getAdminClient(),
  });

  if (result.ok) return NextResponse.json({ deleted: true });
  if (result.kind === "active_owner") {
    return NextResponse.json(
      {
        error:
          "Transferez la propriete ou fermez chaque ecole active avant de supprimer votre compte.",
        schools: result.schools,
      },
      { status: 409 }
    );
  }
  if (result.kind === "invalid_password") {
    return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 401 });
  }
  return NextResponse.json(
    { error: "La suppression n'a pas abouti. Votre compte reste accessible." },
    { status: 500 }
  );
}

function getString(value: unknown, key: string) {
  if (!value || typeof value !== "object") return null;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : null;
}
