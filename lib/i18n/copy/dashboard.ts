import type { AppLocale } from "../config";

type DashboardShellCopy = {
  nav: {
    overview: string;
    students: string;
    fees: string;
    reconciliation: string;
    reports: string;
    payouts: string;
    analytics: string;
    team: string;
    billing: string;
    settings: string;
  };
  logout: string;
  openMenu: string;
  closeMenu: string;
};

export const DASHBOARD_SHELL_COPY: Record<AppLocale, DashboardShellCopy> = {
  fr: {
    nav: {
      overview: "Vue d'ensemble",
      students: "Eleves",
      fees: "Frais",
      reconciliation: "Rapprochement",
      reports: "Rapports",
      payouts: "Versements",
      analytics: "Analytique",
      team: "Equipe",
      billing: "Facturation",
      settings: "Parametres",
    },
    logout: "Se deconnecter",
    openMenu: "Ouvrir le menu",
    closeMenu: "Fermer le menu",
  },
  en: {
    nav: {
      overview: "Overview",
      students: "Students",
      fees: "Fees",
      reconciliation: "Reconciliation",
      reports: "Reports",
      payouts: "Payouts",
      analytics: "Analytics",
      team: "Team",
      billing: "Billing",
      settings: "Settings",
    },
    logout: "Log out",
    openMenu: "Open menu",
    closeMenu: "Close menu",
  },
};

export function getDashboardShellCopy(locale: AppLocale) {
  return DASHBOARD_SHELL_COPY[locale];
}
