import { NextResponse } from "next/server";

// Endpoint de salud consumido por el kit de despliegue (01-testing.sh).
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
