export const dynamic = "force-dynamic";

import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";
import { DEFAULT_PARENT_FEE_BPS } from "@/lib/fee";
import {
  updateEducationLevels,
  updatePricingPolicy,
  updateWhatsAppSettings,
  submitSchoolVerification,
} from "@/app/actions/settings";
import { LogoUploadForm } from "./LogoUploadForm";
import { CloseSchoolForm } from "./CloseSchoolForm";
import {
  VerificationDocumentsForm,
} from "./VerificationDocumentsForm";
import { getVerificationDocuments } from "@/lib/verification-documents";
import { LocalizedLink } from "@/lib/i18n/LocalizedLink";
import {
  EDUCATION_LEVELS,
  EDUCATION_LEVEL_LABELS,
} from "@/lib/congo-education";
import { getRequestLocale } from "@/lib/i18n/server";
import {
  getSchoolReadinessItems,
  getVerificationLabel,
  getWhatsAppBlockers,
} from "@/lib/school-readiness";
import { OnboardingChecklist } from "../OnboardingChecklist";

export default async function SettingsPage() {
  const locale = await getRequestLocale();
  const fr = locale === "fr";
  const { school, membership, plan } = await getTenantContext();
  const canManage = ["owner", "admin"].includes(membership.role);
  const admin = getAdminClient();

  const { data: policy } = await admin
    .from("school_pricing_policies")
    .select("parent_fee_bps, fee_display_mode")
    .eq("school_id", school.id)
    .single();

  const [{ data: logoRow }, { data: whatsappSettings }, verificationDocuments] = await Promise.all([
    admin
    .from("schools")
    .select("logo_url")
    .eq("id", school.id)
    .single(),
    admin
      .from("school_whatsapp_settings")
      .select("automatic_reminders_enabled, local_send_hour, max_reminders")
      .eq("school_id", school.id)
      .maybeSingle(),
    getVerificationDocuments(admin, school.id),
  ]);
  const currentLogoUrl = (logoRow as { logo_url?: string | null } | null)?.logo_url ?? null;
  const whatsappStatuses = ["queued", "accepted", "sent", "delivered", "read", "failed", "cancelled"] as const;
  const [
    statusCountResults,
    optedOutResult,
    studentCountResult,
    guardianCountResult,
    balanceCountResult,
  ] = await Promise.all([
    Promise.all(
      whatsappStatuses.map((status) =>
        admin
          .from("whatsapp_messages")
          .select("id", { count: "exact", head: true })
          .eq("school_id", school.id)
          .eq("status", status)
      )
    ),
    admin
      .from("guardians")
      .select("id", { count: "exact", head: true })
      .eq("school_id", school.id)
      .not("whatsapp_opted_out_at", "is", null),
    admin.from("students").select("id", { count: "exact", head: true }).eq("school_id", school.id),
    admin
      .from("guardians")
      .select("id", { count: "exact", head: true })
      .eq("school_id", school.id)
      .not("whatsapp_opt_in_at", "is", null)
      .is("whatsapp_opted_out_at", null),
    admin
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", school.id)
      .gt("amount_due", 0)
      .not("balance_due_at", "is", null),
  ]);
  const whatsappCounts = Object.fromEntries(
    whatsappStatuses.map((status, index) => [status, statusCountResults[index].count ?? 0])
  ) as Record<(typeof whatsappStatuses)[number], number>;
  const readinessCounts = {
    students: studentCountResult.count ?? 0,
    guardians: guardianCountResult.count ?? 0,
    balancesWithDueDate: balanceCountResult.count ?? 0,
  };
  const readinessSettings = {
    automaticRemindersEnabled: whatsappSettings?.automatic_reminders_enabled ?? true,
  };
  const readinessItems = getSchoolReadinessItems(
    school,
    readinessCounts,
    readinessSettings,
    locale
  );
  const whatsappBlockers = getWhatsAppBlockers(
    school,
    readinessCounts,
    readinessSettings,
    locale
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
          {fr ? "Paramètres" : "Settings"}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {fr ? "Gérez la configuration de votre établissement" : "Manage your school configuration"}
        </p>
      </div>

      <OnboardingChecklist locale={locale} items={readinessItems} />

      {/* School info */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">
            {fr ? "Informations de l’établissement" : "School information"}
          </h2>
        </div>
        <div className="px-6 py-5 divide-y divide-zinc-50">
          {[
            { label: fr ? "Nom" : "Name", value: school.name, mono: false },
            { label: "Code", value: school.code, mono: true },
            { label: fr ? "Devise" : "Currency", value: school.currency, mono: false },
            { label: fr ? "Fuseau" : "Timezone", value: school.timezone, mono: false },
          ].map(({ label, value, mono }) => (
            <div key={label} className="flex items-center gap-6 py-3 first:pt-0 last:pb-0">
              <span className="text-sm text-zinc-500 w-24 shrink-0">{label}</span>
              <span className={`text-sm text-zinc-900 ${mono ? "font-mono" : ""}`}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      <section id="verification" className="scroll-mt-24 rounded-xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">
              {fr ? "Vérification interne" : "Internal verification"}
            </h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              {fr
                ? "Ce contrôle protège les familles et doit être approuvé avant l’envoi des rappels WhatsApp."
                : "This review protects families and must be approved before WhatsApp reminders can be sent."}
            </p>
          </div>
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
            school.verification_status === "verified"
              ? "bg-emerald-100 text-emerald-800"
              : school.verification_status === "pending"
                ? "bg-blue-100 text-blue-800"
                : "bg-amber-100 text-amber-800"
          }`}>
            {getVerificationLabel(school.verification_status, locale)}
          </span>
        </div>
        {school.verification_rejection_reason && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <strong>{fr ? "Correction demandée :" : "Changes requested:"}</strong>{" "}
            {school.verification_rejection_reason}
          </p>
        )}
        {school.verification_status === "verified" && school.verification_reviewed_at && (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <strong>{fr ? "Dossier approuvé." : "Application approved."}</strong>{" "}
            {fr ? "Validation effectuée le" : "Approved on"}{" "}
            {new Date(school.verification_reviewed_at).toLocaleString(fr ? "fr-FR" : "en-US")}.
          </p>
        )}
        {school.verification_status === "pending" && (
          <p className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            {fr
              ? "Votre dossier a été transmis à Minerval. Vous verrez ici l’approbation ou les corrections demandées."
              : "Your application has been sent to Minerval. Approval or requested changes will appear here."}
          </p>
        )}
        <VerificationDocumentsForm
          documents={verificationDocuments}
          canManage={canManage}
          locale={locale}
        />
        <form
          action={async (fd: FormData) => { "use server"; await submitSchoolVerification(undefined, fd); }}
          className="mt-5 grid gap-4 sm:grid-cols-2"
        >
          <input type="hidden" name="locale" value={locale} />
          {[
            ["legalName", fr ? "Raison sociale" : "Legal name", school.legal_name, true],
            ["registrationNumber", fr ? "Numéro d’immatriculation" : "Registration number", school.registration_number, false],
            ["directorName", fr ? "Responsable légal" : "Legal representative", school.director_name, true],
            ["directorPhone", fr ? "Téléphone du responsable (facultatif)" : "Representative phone (optional)", school.director_phone, false],
            ["payoutAccountName", fr ? "Titulaire du compte de versement (facultatif)" : "Payout account holder (optional)", school.payout_account_name, false],
            ["payoutAccountPhone", fr ? "Téléphone mobile money RDC (facultatif)" : "DRC mobile-money phone (optional)", school.payout_account_phone, false],
          ].map(([name, label, value, required]) => (
            <label key={String(name)} className="text-xs font-medium text-zinc-600">
              {label}
              <input
                name={String(name)}
                defaultValue={String(value ?? "")}
                required={Boolean(required)}
                disabled={membership.role !== "owner"}
                className="mt-1 block w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 disabled:bg-zinc-50"
              />
            </label>
          ))}
          <label className="text-xs font-medium text-zinc-600 sm:col-span-2">
            {fr ? "Adresse de l’établissement" : "School address"}
            <textarea
              name="schoolAddress"
              rows={2}
              required
              defaultValue={school.school_address ?? ""}
              disabled={membership.role !== "owner"}
              className="mt-1 block w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 disabled:bg-zinc-50"
            />
          </label>
          <label className="text-xs font-medium text-zinc-600">
            {fr ? "Devise des frais scolaires" : "School-fee currency"}
            <select
              name="currency"
              defaultValue={school.currency}
              disabled={membership.role !== "owner"}
              className="mt-1 block w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              <option value="FC">{fr ? "FC — Franc congolais" : "FC — Congolese franc"}</option>
              <option value="USD">{fr ? "USD — Dollar américain" : "USD — US dollar"}</option>
            </select>
            <span className="mt-1 block text-xs font-normal leading-5 text-zinc-400">
              {fr
                ? "La devise reste propre à cet établissement : aucun solde FC ou USD n’est fusionné ou converti."
                : "Currency remains school-specific: FC and USD balances are never merged or converted."}
            </span>
          </label>
          {membership.role === "owner" && (
            <div className="flex items-end">
              <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
                {school.verification_status === "verified"
                  ? fr ? "Soumettre les modifications" : "Submit changes"
                  : fr ? "Soumettre pour vérification" : "Submit for verification"}
              </button>
            </div>
          )}
        </form>
      </section>

      <div id="whatsapp" className="scroll-mt-24 bg-white rounded-xl border border-zinc-200 p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">
            {fr ? "Rappels automatiques WhatsApp" : "Automatic WhatsApp reminders"}
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            {fr
              ? "Les soldes impayés admissibles sont inscrits automatiquement. Aucune campagne ni sélection d’élèves n’est nécessaire."
              : "Eligible unpaid balances are enrolled automatically. No campaign or student selection is required."}
          </p>
        </div>
        {whatsappBlockers.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">
              {fr ? "Les rappels ne peuvent pas encore être envoyés." : "Reminders cannot be sent yet."}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {whatsappBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
            </ul>
          </div>
        ) : (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
            {fr ? "WhatsApp est prêt à envoyer les rappels admissibles." : "WhatsApp is ready to send eligible reminders."}
          </p>
        )}
        <form
          action={async (fd: FormData) => { "use server"; await updateWhatsAppSettings(undefined, fd); }}
          className="space-y-4"
        >
          <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 text-sm text-zinc-700">
            <input
              type="checkbox"
              name="automaticRemindersEnabled"
              defaultChecked={whatsappSettings?.automatic_reminders_enabled ?? true}
              disabled={!canManage}
              className="mt-0.5"
            />
            <span>
              <strong className="block text-zinc-900">
                {fr ? "Activer les rappels automatiques" : "Enable automatic reminders"}
              </strong>
              {fr
                ? "Minerval contacte le responsable enregistré selon l’échéance et s’arrête dès que le paiement est confirmé."
                : "Minerval contacts the registered guardian according to the due date and stops as soon as payment is confirmed."}
            </span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                {fr ? "Heure locale d’envoi" : "Local send time"}
              </label>
              <select
                name="localSendHour"
                defaultValue={whatsappSettings?.local_send_hour ?? 9}
                disabled={!canManage}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white"
              >
                {Array.from({ length: 13 }, (_, index) => index + 7).map((hour) => (
                  <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                {fr ? "Nombre maximal" : "Maximum reminders"}
              </label>
              <select
                name="maxReminders"
                defaultValue={whatsappSettings?.max_reminders ?? 6}
                disabled={!canManage}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white"
              >
                {[1, 2, 3, 4, 5, 6].map((count) => (
                  <option key={count} value={count}>
                    {count} {fr ? `rappel${count > 1 ? "s" : ""}` : `reminder${count > 1 ? "s" : ""}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {canManage && (
            <button type="submit" className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800">
              {fr ? "Enregistrer les rappels" : "Save reminder settings"}
            </button>
          )}
        </form>
        <div className="border-t border-zinc-100 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {fr ? "Suivi des messages" : "Message tracking"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {whatsappStatuses.map((status) => (
              <span key={status} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700">
                {status}: {whatsappCounts[status]}
              </span>
            ))}
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs text-amber-800">
              {fr ? "désabonnés" : "opted out"}: {optedOutResult.count ?? 0}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">
            {fr ? "Système d’enseignement" : "Education system"}
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            {fr
              ? "Adaptez les classes et le vocabulaire au contexte congolais de votre établissement."
              : "Adapt grades and terminology to your school’s Congolese context."}
          </p>
        </div>
        <form
          action={async (fd: FormData) => { "use server"; await updateEducationLevels(undefined, fd); }}
          className="space-y-4"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {EDUCATION_LEVELS.map((level) => (
              <label
                key={level}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
              >
                <input
                  type="checkbox"
                  name="educationLevels"
                  value={level}
                  defaultChecked={school.education_levels.includes(level)}
                  disabled={!canManage}
                />
                {EDUCATION_LEVEL_LABELS[level]}
              </label>
            ))}
          </div>
          {canManage && (
            <button
              type="submit"
              className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800"
            >
              {fr ? "Enregistrer les niveaux" : "Save education levels"}
            </button>
          )}
        </form>
      </div>

      {/* Pricing policy */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">
            {fr ? "Politique tarifaire" : "Fee policy"}
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            {fr
              ? "Définissez les frais payés par les parents en plus du montant scolaire."
              : "Define the fee paid by parents in addition to the school balance."}
          </p>
        </div>
        <form
          action={async (fd: FormData) => { "use server"; await updatePricingPolicy(undefined, fd); }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              {fr ? "Frais parent" : "Parent fee"}
              <span className="text-zinc-400 font-normal ml-2 normal-case">
                {fr ? "(points de base — 300 = 3 %)" : "(basis points — 300 = 3%)"}
              </span>
            </label>
            <input
              name="parentFeeBps"
              type="number"
              min="0"
              max="1000"
              defaultValue={policy?.parent_fee_bps ?? DEFAULT_PARENT_FEE_BPS}
              disabled={!canManage}
              className="w-32 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent disabled:bg-zinc-50 disabled:text-zinc-400 transition-shadow"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              {fr ? "Mode d’affichage des frais" : "Fee display mode"}
            </label>
            <select
              name="feeDisplayMode"
              defaultValue={policy?.fee_display_mode ?? "visible_line_item"}
              disabled={!canManage}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent disabled:bg-zinc-50 disabled:text-zinc-400 transition-shadow"
            >
              <option value="visible_line_item">
                {fr
                  ? "Ligne visible — affichée séparément sur la page de paiement"
                  : "Visible line item — shown separately on the payment page"}
              </option>
              <option value="hidden">
                {fr ? "Masqué — intégré au total, non affiché" : "Hidden — included in the total"}
              </option>
            </select>
          </div>

          {canManage && (
            <button
              type="submit"
              className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 active:scale-[0.98] transition-all"
            >
              {fr ? "Enregistrer les changements" : "Save changes"}
            </button>
          )}
        </form>
      </div>

      {/* Payout discount */}
      {plan.future_payout_discount_bps > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-blue-900 mb-1">
            {fr ? "Remise sur les versements" : "Payout discount"}
          </h2>
          <p className="text-sm text-blue-700">
            {fr ? "Votre plan inclut une remise de " : "Your plan includes a "}
            <strong>{(plan.future_payout_discount_bps / 100).toFixed(2)}%</strong>{" "}
            {fr
              ? "sur les futurs frais de plateforme, appliquée automatiquement aux versements réglés."
              : "discount on future platform fees, applied automatically to settled payouts."}
          </p>
        </div>
      )}

      {/* Logo upload */}
      <LogoUploadForm currentLogoUrl={currentLogoUrl} canManage={canManage} />

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">
          {fr ? "Compte personnel" : "Personal account"}
        </h2>
        <p className="mt-1 text-xs leading-5 text-zinc-500">
          {fr
            ? "Gérez la suppression de votre connexion personnelle et de vos accès."
            : "Manage your personal login and account deletion."}
        </p>
        <LocalizedLink
          href="/account"
          className="mt-4 inline-flex rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          {fr ? "Gérer mon compte" : "Manage my account"}
        </LocalizedLink>
      </div>

      {membership.role === "owner" && (
        <>
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-zinc-900">
              {fr ? "Export des données" : "Data export"}
            </h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              {fr
                ? "Téléchargez une copie JSON des informations de l’établissement, des élèves, paiements, versements, membres et journaux d’audit. Les jetons secrets ne sont pas inclus."
                : "Download a JSON copy of school, student, payment, payout, membership, and audit data. Secret tokens are excluded."}
            </p>
            <a
              href="/api/dashboard/account/export"
              className="mt-4 inline-flex rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              {fr ? "Télécharger mes données" : "Download my data"}
            </a>
          </div>
          <CloseSchoolForm schoolCode={school.code} />
        </>
      )}
    </div>
  );
}
