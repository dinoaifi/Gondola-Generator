import sharp from "sharp";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

// Every processed image ends up on the same fixed-height canvas, so products
// from completely different source sites still look consistently sized next
// to each other on a shelf.
const CANVAS_HEIGHT = 650;
const MARGIN_TOP = 20;
const MARGIN_BOTTOM = 15;
const SIDE_MARGIN = 20;

export async function POST(request) {
  try {
    const { url } = await request.json();
    if (!url || !url.startsWith("http")) {
      return NextResponse.json({ error: "No valid url provided" }, { status: 400 });
    }

    const res = await fetch(url, {
      headers: {
        // A browser-like User-Agent helps some sites serve the image instead
        // of blocking the request; server-to-server fetches also don't carry
        // the page Referer a browser <img> tag would, which is what a lot of
        // hotlink protection actually checks.
        "User-Agent": "Mozilla/5.0 (compatible; GondolaGeneratorBot/1.0)",
      },
    });
    if (!res.ok) throw new Error(`Source responded with ${res.status}`);
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) throw new Error("URL did not return an image");

    const inputBuffer = Buffer.from(await res.arrayBuffer());

    // Trim uniform-color background/whitespace, then scale so every product
    // fills the same vertical space regardless of how it was originally cropped.
    const targetHeight = CANVAS_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;
    const trimmed = await sharp(inputBuffer).trim().toBuffer();
    const resized = await sharp(trimmed).resize({ height: targetHeight, fit: "inside" }).png().toBuffer();
    const meta = await sharp(resized).metadata();

    const canvasWidth = meta.width + SIDE_MARGIN * 2;
    const left = Math.round((canvasWidth - meta.width) / 2);
    const top = CANVAS_HEIGHT - MARGIN_BOTTOM - meta.height; // bottom-anchored, like sitting on a shelf

    const finalBuffer = await sharp({
      create: {
        width: canvasWidth,
        height: CANVAS_HEIGHT,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: resized, left, top }])
      .png()
      .toBuffer();

    const blob = await put(`products/normalized-${Date.now()}.png`, finalBuffer, {
      access: "public",
      contentType: "image/png",
    });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error("Normalize failed", err);
    return NextResponse.json({ error: "Normalize failed" }, { status: 500 });
  }
}
