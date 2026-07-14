import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { createSSRClient, getAdminClient } from "@/lib/supabase";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getStripe } from "@/lib/stripe";
import { closeSchoolSafely } from "@/lib/school-closure";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { user, school, membership } = await getTenantContext();
  if (membership.role !== "owner") {
    return NextResponse.json(
      { error: "Seul le proprietaire peut fermer l'ecole." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
  }

  const confirmation = getString(body, "confirmation");
  const rawReason = getString(body, "reason")?.trim() ?? "";
  if (confirmation !== school.code) {
    return NextResponse.json(
      { error: "Saisissez exactement le code de l'ecole pour confirmer." },
      { status: 400 }
    );
  }
  if (rawReason.length > 500) {
    return NextResponse.json(
      { error: "Le motif ne peut pas depasser 500 caracteres." },
      { status: 400 }
    );
  }

  const rateLimit = await consumeRateLimit({
    key: `school-closure:${school.id}:${user.id}`,
    limit: 3,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Trop de tentatives. Reessayez dans ${rateLimit.retryAfterSeconds} secondes.` },
      { status: 429 }
    );
  }

  const authenticated = await createSSRClient();
  const result = await closeSchoolSafely({
    schoolId: school.id,
    reason: rawReason || null,
    admin: getAdminClient(),
    authenticated,
    stripeSubscriptions: getStripe().subscriptions,
  });

  if (result.ok) {
    await authenticated.auth.signOut();
    return NextResponse.json({ closed: true, already_closed: result.alreadyClosed });
  }

  if (result.kind === "pending_financial_activity") {
    return NextResponse.json(
      {
        error:
          "La fermeture est bloquee tant que des paiements ou versements sont en cours.",
        pending_payments: result.pendingPayments,
        pending_payouts: result.pendingPayouts,
      },
      { status: 409 }
    );
  }
  if (result.kind === "stripe_failure") {
    return NextResponse.json(
      { error: "Impossible d'annuler l'abonnement Stripe. Aucun compte n'a ete ferme." },
      { status: 502 }
    );
  }
  if (result.kind === "unauthorized") {
    return NextResponse.json({ error: "Fermeture non autorisee." }, { status: 403 });
  }
  if (result.kind === "not_found") {
    return NextResponse.json({ error: "Ecole introuvable." }, { status: 404 });
  }
  return NextResponse.json(
    { error: "La fermeture n'a pas abouti. Reessayez sans creer un nouveau compte." },
    { status: 500 }
  );
}

function getString(value: unknown, key: string) {
  if (!value || typeof value !== "object") return null;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : null;
}
