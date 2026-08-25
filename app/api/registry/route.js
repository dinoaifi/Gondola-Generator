import { put, list } from "@vercel/blob";
import { NextResponse } from "next/server";

const REGISTRY_PATH = "data/registry.json";

export async function GET() {
  try {
    const { blobs } = await list({ prefix: REGISTRY_PATH });
    const match = blobs.find((b) => b.pathname === REGISTRY_PATH);
    if (!match) return NextResponse.json({});
    const res = await fetch(match.url, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Registry load failed", err);
    return NextResponse.json({});
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    await put(REGISTRY_PATH, JSON.stringify(data), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Registry save failed", err);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
