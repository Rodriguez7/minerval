export const dynamic = "force-dynamic";

import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";
import { updatePricingPolicy } from "@/app/actions/settings";
import { LogoUploadForm } from "./LogoUploadForm";

export default async function SettingsPage() {
  const { school, membership, plan } = await getTenantContext();
  const canManage = ["owner", "admin"].includes(membership.role);
  const admin = getAdminClient();

  const { data: policy } = await admin
    .from("school_pricing_policies")
    .select("parent_fee_bps, fee_display_mode")
    .eq("school_id", school.id)
    .single();

  const { data: logoRow } = await admin
    .from("schools")
    .select("logo_url")
    .eq("id", school.id)
    .single();
  const currentLogoUrl = (logoRow as { logo_url?: string | null } | null)?.logo_url ?? null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Parametres</h1>
        <p className="text-sm text-zinc-500 mt-1">Gerez la configuration de votre ecole</p>
      </div>

      {/* School info */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">Informations de l&apos;ecole</h2>
        </div>
        <div className="px-6 py-5 divide-y divide-zinc-50">
          {[
            { label: "Nom", value: school.name, mono: false },
            { label: "Code", value: school.code, mono: true },
            { label: "Devise", value: school.currency, mono: false },
            { label: "Fuseau", value: school.timezone, mono: false },
          ].map(({ label, value, mono }) => (
            <div key={label} className="flex items-center gap-6 py-3 first:pt-0 last:pb-0">
              <span className="text-sm text-zinc-500 w-24 shrink-0">{label}</span>
              <span className={`text-sm text-zinc-900 ${mono ? "font-mono" : ""}`}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing policy */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Politique tarifaire</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Definit les frais payes par les parents en plus du montant scolaire
          </p>
        </div>
        <form
          action={async (fd: FormData) => { "use server"; await updatePricingPolicy(undefined, fd); }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              Frais parent
              <span className="text-zinc-400 font-normal ml-2 normal-case">
                (points de base - 275 = 2.75 %)
              </span>
            </label>
            <input
              name="parentFeeBps"
              type="number"
              min="0"
              max="1000"
              defaultValue={policy?.parent_fee_bps ?? 275}
              disabled={!canManage}
              className="w-32 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent disabled:bg-zinc-50 disabled:text-zinc-400 transition-shadow"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              Mode d&apos;affichage des frais
            </label>
            <select
              name="feeDisplayMode"
              defaultValue={policy?.fee_display_mode ?? "visible_line_item"}
              disabled={!canManage}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent disabled:bg-zinc-50 disabled:text-zinc-400 transition-shadow"
            >
              <option value="visible_line_item">
                Ligne visible - affichee separement sur la page de paiement
              </option>
              <option value="hidden">Masque - integre au total, non affiche</option>
            </select>
          </div>

          {canManage && (
            <button
              type="submit"
              className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 active:scale-[0.98] transition-all"
            >
              Enregistrer les changements
            </button>
          )}
        </form>
      </div>

      {/* Payout discount */}
      {plan.future_payout_discount_bps > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-blue-900 mb-1">Remise sur les versements</h2>
          <p className="text-sm text-blue-700">
            Votre plan inclut une remise de{" "}
            <strong>{(plan.future_payout_discount_bps / 100).toFixed(2)}%</strong>{" "}
            sur les futurs frais plateforme, appliquee automatiquement aux versements regles.
          </p>
        </div>
      )}

      {/* Logo upload */}
      <LogoUploadForm currentLogoUrl={currentLogoUrl} canManage={canManage} />
    </div>
  );
}
