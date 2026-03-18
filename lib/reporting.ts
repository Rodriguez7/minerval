import type { MaybeJoined } from "./supabase-joins";
import type { PaymentRequest, ReconciliationStatus, Student, Telecom } from "./types";

export type ReportFilters = {
  from: string;
  to: string;
  paymentStatus: "all" | PaymentRequest["status"];
  reconciliationStatus: "all" | ReconciliationStatus;
};

export type PaymentReportRow = Pick<
  PaymentRequest,
  | "id"
  | "amount"
  | "phone"
  | "telecom"
  | "status"
  | "created_at"
  | "settled_at"
  | "reconciliation_status"
  | "reconciliation_note"
  | "reconciliation_updated_at"
  | "reconciliation_updated_by"
  | "serdipay_transaction_id"
> & {
  students: MaybeJoined<Pick<Student, "full_name" | "external_id">>;
};

function isValidDate(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getDefaultReportFilters(): ReportFilters {
  const today = new Date();
  const startOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  return {
    from: formatDateInput(startOfMonth),
    to: formatDateInput(today),
    paymentStatus: "all",
    reconciliationStatus: "all",
  };
}

export function parseReportFilters(
  searchParams:
    | Record<string, string | string[] | undefined>
    | URLSearchParams
): ReportFilters {
  const defaults = getDefaultReportFilters();
  const getValue = (key: string) => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(key) ?? undefined;
    }

    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const paymentStatus = getValue("paymentStatus");
  const reconciliationStatus = getValue("reconciliationStatus");
  const from = getValue("from");
  const to = getValue("to");

  return {
    from: isValidDate(from) ? from : defaults.from,
    to: isValidDate(to) ? to : defaults.to,
    paymentStatus:
      paymentStatus === "pending" || paymentStatus === "success" || paymentStatus === "failed"
        ? paymentStatus
        : "all",
    reconciliationStatus:
      reconciliationStatus === "pending_review" ||
      reconciliationStatus === "reconciled" ||
      reconciliationStatus === "needs_review" ||
      reconciliationStatus === "manual_override"
        ? reconciliationStatus
        : "all",
  };
}

export function getDateRangeBounds(filters: ReportFilters) {
  return {
    fromIso: `${filters.from}T00:00:00.000Z`,
    toIso: `${filters.to}T23:59:59.999Z`,
  };
}

type FilterableQuery<T> = {
  eq(column: string, value: string): T;
  gte(column: string, value: string): T;
  lte(column: string, value: string): T;
};

export function buildReportQuery<T extends FilterableQuery<T>>(query: T, filters: ReportFilters) {
  const { fromIso, toIso } = getDateRangeBounds(filters);
  let nextQuery = query.gte("created_at", fromIso).lte("created_at", toIso);

  if (filters.paymentStatus !== "all") {
    nextQuery = nextQuery.eq("status", filters.paymentStatus);
  }

  if (filters.reconciliationStatus !== "all") {
    nextQuery = nextQuery.eq("reconciliation_status", filters.reconciliationStatus);
  }

  return nextQuery;
}

export function getStalePendingCutoff() {
  return new Date(Date.now() - 3_600_000).toISOString();
}

export function escapeCsv(value: string | number | null | undefined) {
  const normalized = value == null ? "" : String(value);
  const escaped = normalized.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function formatAmount(value: number) {
  return `${Number(value).toLocaleString()} FC`;
}

export function normalizeTelecom(value: Telecom | string) {
  return value;
}
