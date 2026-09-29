import { put, list } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

function workspacePathForUser(userId) {
  return `data/workspace-${userId}.json`;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const WORKSPACE_PATH = workspacePathForUser(userId);
  try {
    const { blobs } = await list({ prefix: WORKSPACE_PATH });
    const match = blobs.find((b) => b.pathname === WORKSPACE_PATH);
    if (!match) return NextResponse.json({ gondolas: null });
    const res = await fetch(match.url, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Workspace load failed", err);
    return NextResponse.json({ gondolas: null });
  }
}

export async function POST(request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const WORKSPACE_PATH = workspacePathForUser(userId);
  try {
    const { gondolas } = await request.json();
    await put(WORKSPACE_PATH, JSON.stringify({ gondolas, savedAt: Date.now() }), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Workspace save failed", err);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
