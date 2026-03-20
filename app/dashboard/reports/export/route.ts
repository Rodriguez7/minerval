import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";
import {
  buildReportQuery,
  escapeCsv,
  parseReportFilters,
  type PaymentReportRow,
} from "@/lib/reporting";
import { takeJoined } from "@/lib/supabase-joins";
import { RECONCILIATION_LABELS, TELECOM_LABELS } from "@/lib/types";
import type { Telecom } from "@/lib/types";

export async function GET(req: Request) {
  const { school, plan } = await getTenantContext();

  if (!plan.can_accounting_export) {
    return NextResponse.json(
      { error: "CSV export is not available on your current plan." },
      { status: 403 }
    );
  }

  const admin = getAdminClient();

  const url = new URL(req.url);
  const filters = parseReportFilters(url.searchParams);

  const baseQuery = admin
    .from("payment_requests")
    .select(
      "id, amount, phone, telecom, status, created_at, settled_at, reconciliation_status, reconciliation_note, reconciliation_updated_at, reconciliation_updated_by, serdipay_transaction_id, students(full_name, external_id)"
    )
    .eq("school_id", school.id)
    .order("created_at", { ascending: false });

  const { data } = await buildReportQuery(baseQuery, filters);
  const rows = (data ?? []) as PaymentReportRow[];

  const header = [
    "reference",
    "requested_at",
    "student_id",
    "student_name",
    "amount_fc",
    "phone",
    "provider",
    "payment_status",
    "reconciliation_status",
    "reconciliation_note",
    "reconciliation_updated_at",
    "reconciliation_updated_by",
    "settled_at",
    "serdipay_transaction_id",
  ];

  const csvRows = rows.map((row) => {
    const student = takeJoined(row.students);
    return [
      row.id,
      row.created_at,
      student?.external_id ?? "",
      student?.full_name ?? "",
      row.amount,
      row.phone,
      TELECOM_LABELS[row.telecom as Telecom] ?? row.telecom,
      row.status,
      RECONCILIATION_LABELS[row.reconciliation_status],
      row.reconciliation_note ?? "",
      row.reconciliation_updated_at ?? "",
      row.reconciliation_updated_by ?? "",
      row.settled_at ?? "",
      row.serdipay_transaction_id ?? "",
    ]
      .map((value) => escapeCsv(value))
      .join(",");
  });

  const csv = [header.join(","), ...csvRows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${school.code}-payments-report.csv"`,
      "cache-control": "no-store",
    },
  });
}
