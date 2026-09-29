"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Plus, X, Copy, Snowflake, Package, ChevronDown, ChevronUp, Download } from "lucide-react";


const uid = () => Math.random().toString(36).slice(2, 10);
const SWATCHES = ["#2563EB", "#DC2626", "#F59E0B", "#16A34A", "#7C3AED", "#0891B2", "#EA580C", "#94A3B8", "#78350F", "#DB2777"];

const BOTTLE_HINTS = ["water", "spring", "juice", "tea", "sport", "gatorade", "vitamin", "kombucha", "smoothie", "frost"];
const CASE_HINTS = ["case", "pack", "12pk", "24pk", "18pk", "variety"];
function guessShape(name) {
  const n = (name || "").toLowerCase();
  if (CASE_HINTS.some((h) => n.includes(h))) return "case";
  if (BOTTLE_HINTS.some((h) => n.includes(h))) return "bottle";
  return "can";
}

const makeProduct = (overrides = {}) => ({
  id: uid(),
  name: "",
  shelf: 1,
  facings: 3,
  shape: "can",
  color: SWATCHES[0],
  upc: "",
  price: "",
  thumbnailUrl: "", // real, permanently hosted image URL
  ...overrides,
});

const makeGondola = (overrides = {}) => ({
  id: uid(),
  number: "G1",
  type: "fridge", // "fridge" | "dry"
  shelfCount: 4,
  facingsPerShelf: 5,
  products: [],
  ...overrides,
});

function parseBulkLines(text) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      const parts = line.split(",").map((p) => p.trim());
      const name = parts[0] || `Product ${i + 1}`;
      const shelf = parts[1] ? parseInt(parts[1], 10) : 1;
      const facings = parts[2] ? parseInt(parts[2], 10) : 3;
      return makeProduct({
        name,
        shelf: isNaN(shelf) ? 1 : shelf,
        facings: isNaN(facings) ? 3 : Math.max(1, facings),
        shape: guessShape(name),
        color: SWATCHES[i % SWATCHES.length],
      });
    });
}

const THUMBNAIL_PALETTE = ["#2563EB", "#DC2626", "#16A34A", "#7C3AED", "#0891B2",
