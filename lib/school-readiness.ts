import type { AppLocale } from "./i18n/config";
import type { School, SchoolVerificationStatus } from "./types";

export type SchoolReadinessCounts = {
  students: number;
  guardians: number;
  balancesWithDueDate: number;
};

export type SchoolReadinessSettings = {
  automaticRemindersEnabled: boolean;
};

export type SchoolReadinessItem = {
  key: "profile" | "verification" | "students" | "guardians" | "balances" | "automation";
  complete: boolean;
  label: string;
  description: string;
  href: string;
};

export function hasCompleteVerificationProfile(school: Pick<
  School,
  | "legal_name"
  | "school_address"
  | "director_name"
>) {
  return Boolean(
    school.legal_name?.trim() &&
      school.school_address?.trim() &&
      school.director_name?.trim()
  );
}

export function getVerificationLabel(status: SchoolVerificationStatus, locale: AppLocale) {
  const labels: Record<AppLocale, Record<SchoolVerificationStatus, string>> = {
    fr: {
      unverified: "À compléter",
      pending: "En cours de vérification",
      verified: "Vérifiée",
      rejected: "À corriger",
    },
    en: {
      unverified: "Incomplete",
      pending: "Under review",
      verified: "Verified",
      rejected: "Needs changes",
    },
  };
  return labels[locale][status];
}

export function getSchoolReadinessItems(
  school: School,
  counts: SchoolReadinessCounts,
  settings: SchoolReadinessSettings,
  locale: AppLocale
): SchoolReadinessItem[] {
  const fr = locale === "fr";
  return [
    {
      key: "profile",
      complete: hasCompleteVerificationProfile(school),
      label: fr ? "Compléter le profil légal" : "Complete the legal profile",
      description: fr
        ? "Raison sociale, adresse et responsable légal de l’établissement."
        : "The school’s legal name, address, and legal representative.",
      href: "/dashboard/settings#verification",
    },
    {
      key: "verification",
      complete: school.verification_status === "verified",
      label: fr ? "Faire vérifier l’établissement" : "Verify the school",
      description: fr
        ? getVerificationLabel(school.verification_status, "fr")
        : getVerificationLabel(school.verification_status, "en"),
      href: "/dashboard/settings#verification",
    },
    {
      key: "students",
      complete: counts.students > 0,
      label: fr ? "Ajouter les élèves" : "Add students",
      description: fr ? `${counts.students} élève(s) enregistré(s)` : `${counts.students} student(s) added`,
      href: "/dashboard/students",
    },
    {
      key: "guardians",
      complete: counts.guardians > 0,
      label: fr ? "Ajouter les responsables WhatsApp" : "Add WhatsApp guardians",
      description: fr
        ? `${counts.guardians} responsable(s) avec consentement`
        : `${counts.guardians} consenting guardian(s)`,
      href: "/dashboard/students",
    },
    {
      key: "balances",
      complete: counts.balancesWithDueDate > 0,
      label: fr ? "Définir les soldes et échéances" : "Set balances and due dates",
      description: fr
        ? `${counts.balancesWithDueDate} solde(s) impayé(s) planifié(s)`
        : `${counts.balancesWithDueDate} scheduled unpaid balance(s)`,
      href: "/dashboard/students",
    },
    {
      key: "automation",
      complete: settings.automaticRemindersEnabled,
      label: fr ? "Activer les rappels automatiques" : "Enable automatic reminders",
      description: settings.automaticRemindersEnabled
        ? fr ? "Activés" : "Enabled"
        : fr ? "Désactivés" : "Disabled",
      href: "/dashboard/settings#whatsapp",
    },
  ];
}

export function getWhatsAppBlockers(
  school: School,
  counts: SchoolReadinessCounts,
  settings: SchoolReadinessSettings,
  locale: AppLocale
) {
  const fr = locale === "fr";
  const blockers: string[] = [];
  if (school.status !== "active") {
    blockers.push(fr ? "L’établissement est fermé." : "The school is closed.");
  }
  if (school.verification_status !== "verified") {
    blockers.push(
      fr
        ? "La vérification interne de l’établissement n’est pas terminée."
        : "The school’s internal verification is not complete."
    );
  }
  if (!settings.automaticRemindersEnabled) {
    blockers.push(fr ? "Les rappels automatiques sont désactivés." : "Automatic reminders are disabled.");
  }
  if (counts.students === 0) {
    blockers.push(fr ? "Aucun élève n’est enregistré." : "No students have been added.");
  }
  if (counts.guardians === 0) {
    blockers.push(
      fr
        ? "Aucun responsable WhatsApp avec consentement n’est enregistré."
        : "No consenting WhatsApp guardian has been added."
    );
  }
  if (counts.balancesWithDueDate === 0) {
    blockers.push(
      fr
        ? "Aucun solde impayé ne possède de date d’échéance."
        : "No unpaid balance has a due date."
    );
  }
  return blockers;
}
