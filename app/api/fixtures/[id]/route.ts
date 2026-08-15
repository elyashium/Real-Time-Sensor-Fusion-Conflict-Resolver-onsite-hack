import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const filePath = path.join(process.cwd(), "fixtures", `${params.id}.json`);
    const raw = readFileSync(filePath, "utf-8");
    const fixture = JSON.parse(raw);
    return NextResponse.json(fixture);
  } catch {
    return NextResponse.json({ error: "Fixture not found" }, { status: 404 });
  }
}
