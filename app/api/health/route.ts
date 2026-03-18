import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    service: "minerval",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
