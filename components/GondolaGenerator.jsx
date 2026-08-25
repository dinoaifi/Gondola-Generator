"use client";

import React, { useState, useEffect, useRef } from "react";
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

const THUMBNAIL_PALETTE = ["#2563EB", "#DC2626", "#16A34A", "#7C3AED", "#0891B2", "#EA580C", "#DB2777", "#65A30D", "#0D9488", "#9333EA", "#CA8A04", "#4F46E5"];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Deterministic "thumbnail" for products with no real photo: same name always
// produces the same color + initials, so Poland Spring looks identical everywhere.
// Domains known to block their images from loading anywhere but their own
// site. Catches the mistake before the person has to guess why it didn't work.
const BLOCKED_IMAGE_DOMAINS = [
  { match: "gstatic.com", label: "a Google Images search thumbnail" },
  { match: "google.com/imgres", label: "a Google Images search result" },
  { match: "pinterest.com", label: "a Pinterest page" },
  { match: "pinimg.com/originals", label: "a Pinterest image" },
  { match: "instagram.com", label: "an Instagram page" },
  { match: "amazon.com", label: "an Amazon product page" },
  { match: "facebook.com", label: "a Facebook page" },
];

function detectBlockedUrl(url) {
  if (!url) return null;
  const lower = url.toLowerCase();
  const hit = BLOCKED_IMAGE_DOMAINS.find((d) => lower.includes(d.match));
  return hit ? hit.label : null;
}

function thumbnailForName(name) {
  const clean = (name || "").trim();
  if (!clean) return { color: "#b8b4a8", initials: "?" };
  const hash = hashString(clean.toLowerCase());
  const color = THUMBNAIL_PALETTE[hash % THUMBNAIL_PALETTE.length];
  const words = clean.split(/\s+/).filter(Boolean);
  const initials = words.length === 1 ? words[0].slice(0, 2).toUpperCase() : (words[0][0] + words[1][0]).toUpperCase();
  return { color, initials };
}

function ProductImage({ p }) {
  const rawWidth = p.shape === "case" ? 30 + Math.min(p.facings, 12) * 24 : 26 + Math.min(p.facings, 12) * 18;
  const perFacingWidth = Math.max(rawWidth / Math.max(p.facings, 1), 34);
  const height = 78; // same box height for every shape so all products share one baseline
  const clip =
    p.shape === "bottle"
      ? "polygon(38% 0%,62% 0%,62% 10%,78% 22%,78% 100%,22% 100%,22% 22%,38% 10%)"
      : "none";
  const radius = p.shape === "can" ? "4px 4px 0 0" : p.shape === "case" ? "2px" : "0";

  const rawSrc = p.thumbnailUrl || null;
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => {
    setImgFailed(false); // reset whenever the source itself changes (e.g. URL edited)
  }, [rawSrc]);

  const displaySrc = imgFailed ? null : rawSrc;
  const thumb = displaySrc ? null : thumbnailForName(p.name);

  return (
    <div
      className="relative overflow-hidden shrink-0 flex items-end justify-center"
      style={{
        width: perFacingWidth,
        height,
        clipPath: clip !== "none" ? clip : undefined,
        borderRadius: radius,
        backgroundColor: displaySrc ? "transparent" : thumb.color,
      }}
    >
      {displaySrc ? (
        <img
          src={displaySrc}
          alt={p.name}
          onError={() => setImgFailed(true)}
          className="w-full h-full object-contain object-bottom"
        />
      ) : (
        <div className="flex items-center justify-center w-full h-full">
          <span className="text-white font-bold" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: Math.min(perFacingWidth * 0.32, 15) }}>
            {thumb.initials}
          </span>
        </div>
      )}
    </div>
  );
}

function ProductGroup({ p, bin, isFridge }) {
  return (
    <div className="flex flex-col items-center shrink-0">
      <span
        className="text-[9px] font-bold mb-1 rounded px-1.5 py-0.5"
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          background: isFridge ? "#274454" : "#d8d4c8",
          color: isFridge ? "#8fd6ee" : "#4a4640",
        }}
      >
        Bin {bin}
      </span>
      <div className="flex items-end gap-[2px]">
        {Array.from({ length: p.facings }, (_, i) => (
          <ProductImage key={i} p={p} />
        ))}
      </div>
    </div>
  );
}

function GondolaFixture({ gondola }) {
  const isFridge = gondola.type === "fridge";
  const shelfNums = Array.from({ length: gondola.shelfCount }, (_, i) => gondola.shelfCount - i); // top..bottom, S{n} at top down to S1 at bottom

  const frameStyle = isFridge
    ? { background: "linear-gradient(180deg, #0e1216, #080c10)", border: "3px solid #3c3c40" }
    : { background: "#ebe8e0", border: "3px solid #5a5852" };

  return (
    <div className="rounded-xl overflow-hidden shrink-0" style={{ width: 300, ...frameStyle }}>
      <div
        className="px-3 py-2 flex items-center gap-2"
        style={{ background: isFridge ? "#0f0f11" : "#3c3a34" }}
      >
        {isFridge ? <Snowflake size={14} className="text-cyan-300" /> : <Package size={14} className="text-amber-100" />}
        <span
          className="text-sm font-bold tracking-wide"
          style={{ fontFamily: "'Oswald', sans-serif", color: isFridge ? "#8fd6ee" : "#f0eee6" }}
        >
          {gondola.number || "G?"}
        </span>
        <span className="text-[10px] ml-auto uppercase tracking-wide" style={{ color: isFridge ? "#5c7a8a" : "#a8a496" }}>
          {isFridge ? "Fridge" : "Dry Goods"}
        </span>
      </div>

      <div className="flex flex-col">
        {shelfNums.map((shelfNum) => {
          const shelfProducts = gondola.products.filter((p) => p.shelf === shelfNum);
          return (
            <div key={shelfNum} className="relative px-3 pt-3">
              <span
                className="absolute top-2 left-3 text-[10px] font-bold rounded px-1.5 py-0.5"
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  background: isFridge ? "#5a96b4" : "#5a5850",
                  color: isFridge ? "#0c1216" : "#f0eee6",
                }}
              >
                S{shelfNum}
              </span>
              <div className="flex items-end gap-3 overflow-x-auto pt-6 pb-2 min-h-[100px]">
                {shelfProducts.length === 0 ? (
                  <span className="text-[11px] italic" style={{ color: isFridge ? "#4a5560" : "#a8a496" }}>
                    Empty
                  </span>
                ) : (
                  shelfProducts.map((p, idx) => <ProductGroup key={p.id} p={p} bin={idx + 1} isFridge={isFridge} />)
                )}
              </div>
              <div
                className="h-[6px] rounded-sm mt-1"
                style={{ background: isFridge ? "linear-gradient(180deg,#7a7c80,#3a3a3e)" : "#cbc6ba" }}
              />
              {!isFridge && <div className="h-[5px]" style={{ background: "#2a2a28" }} />}
            </div>
          );
        })}
      </div>
      <div className="h-4" style={{ background: isFridge ? "#0a0a0c" : "#5a5852" }} />
    </div>
  );
}

function ThumbnailUrlField({ product, onSharedFieldChange }) {
  const [localValue, setLocalValue] = useState(product.thumbnailUrl);
  const [normalizing, setNormalizing] = useState(false);
  const [failedNote, setFailedNote] = useState(false);

  useEffect(() => {
    setLocalValue(product.thumbnailUrl);
  }, [product.thumbnailUrl]);

  const handleBlur = async () => {
    const url = (localValue || "").trim();
    if (!url || !url.startsWith("http")) return;
    if (url.includes(".blob.vercel-storage.com")) return; // already a normalized copy
    if (url === product.thumbnailUrl && product._normalized) return;

    setNormalizing(true);
    setFailedNote(false);
    try {
      const res = await fetch("/api/normalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.url) {
        onSharedFieldChange(product.id, { thumbnailUrl: data.url, _normalized: true });
      } else {
        setFailedNote(true);
        onSharedFieldChange(product.id, { thumbnailUrl: url });
      }
    } catch (err) {
      console.error("Normalize failed", err);
      setFailedNote(true);
      onSharedFieldChange(product.id, { thumbnailUrl: url });
    } finally {
      setNormalizing(false);
    }
  };

  const blockedLabel = detectBlockedUrl(localValue);

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="relative w-full">
        <input
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          placeholder="Thumbnail URL (paste a link \u2014 sized automatically)"
          title="Applies to this product everywhere it's used"
          className="bg-neutral-50 border border-neutral-200 text-neutral-800 text-xs rounded px-2 py-1 outline-none focus:ring-1 focus:ring-cyan-500 w-full pr-16"
        />
        {normalizing && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-cyan-600">Sizing...</span>}
      </div>
      {blockedLabel && !normalizing && (
        <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          This looks like {blockedLabel} \u2014 trying to fetch it anyway, but if it fails, try a different source link.
        </div>
      )}
      {failedNote && !normalizing && (
        <div className="text-[11px] text-neutral-500">Couldn't auto-size this one, using the link as-is.</div>
      )}
    </div>
  );
}

function ShelfEditor({ products, shelfCount, onAddToShelf, onNameChange, onSharedFieldChange, onUpdate, onRemove }) {
  const shelfNums = Array.from({ length: shelfCount }, (_, i) => shelfCount - i); // top..bottom display
  const [collapsed, setCollapsed] = useState({});
  const toggle = (shelfNum) => setCollapsed((prev) => ({ ...prev, [shelfNum]: !prev[shelfNum] }));

  return (
    <div className="flex flex-col gap-3">
      {shelfNums.map((shelfNum) => {
        const shelfProducts = products.filter((p) => p.shelf === shelfNum);
        const isCollapsed = !!collapsed[shelfNum];
        return (
          <div key={shelfNum} className="border border-neutral-300 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between bg-neutral-100 px-3 py-1.5">
              <button
                onClick={() => toggle(shelfNum)}
                className="flex items-center gap-1.5 text-xs font-bold"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              >
                {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                S{shelfNum} <span className="font-normal text-neutral-500">— {shelfProducts.length} product{shelfProducts.length === 1 ? "" : "s"}</span>
              </button>
              <button
                onClick={() => onAddToShelf(shelfNum)}
                className="flex items-center gap-1 text-[11px] font-semibold text-cyan-700 hover:text-cyan-900"
              >
                <Plus size={12} /> Add product to S{shelfNum}
              </button>
            </div>
            {!isCollapsed && (
              <div className="divide-y divide-neutral-100 bg-white">
                {shelfProducts.length === 0 && <div className="text-[11px] text-neutral-400 italic px-3 py-2">Empty shelf</div>}
                {shelfProducts.map((p, idx) => (
                  <div key={p.id} className="px-3 py-2 flex flex-col gap-1.5">
                    <div className="grid grid-cols-[44px_1fr_60px_30px] gap-2 items-center">
                      <span
                        className="text-[10px] font-bold text-center rounded px-1 py-1 bg-neutral-100 text-neutral-600"
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                      >
                        Bin {idx + 1}
                      </span>
                      <input
                        value={p.name}
                        onChange={(e) => onNameChange(p.id, e.target.value)}
                        placeholder="Product Name"
                        className="bg-neutral-50 border border-neutral-200 text-neutral-800 text-xs rounded px-2 py-1 outline-none focus:ring-1 focus:ring-cyan-500 w-full"
                      />
                      <input
                        type="number"
                        min={1}
                        value={p.facings}
                        onChange={(e) => onUpdate(p.id, { facings: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                        title="Facings"
                        className="bg-neutral-50 border border-neutral-200 text-neutral-800 text-xs rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-cyan-500 w-full"
                      />
                      <button onClick={() => onRemove(p.id)} className="text-neutral-400 hover:text-red-500 justify-self-center">
                        <X size={13} />
                      </button>
                    </div>
                    <div className="grid grid-cols-[44px_1fr_60px_30px] gap-2 items-center">
                      <span />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={p.upc}
                          onChange={(e) => onSharedFieldChange(p.id, { upc: e.target.value })}
                          placeholder="UPC / Barcode"
                          title="Applies to this product everywhere it's used"
                          className="bg-neutral-50 border border-neutral-200 text-neutral-800 text-xs rounded px-2 py-1 outline-none focus:ring-1 focus:ring-cyan-500 w-full"
                          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                        />
                        <input
                          value={p.price}
                          onChange={(e) => onSharedFieldChange(p.id, { price: e.target.value })}
                          placeholder="Price"
                          title="Applies to this product everywhere it's used"
                          className="bg-neutral-50 border border-neutral-200 text-neutral-800 text-xs rounded px-2 py-1 outline-none focus:ring-1 focus:ring-cyan-500 w-full"
                        />
                      </div>
                      <span />
                      <span />
                    </div>
                    <div className="grid grid-cols-[44px_1fr_60px_30px] gap-2 items-start">
                      <span />
                      <ThumbnailUrlField product={p} onSharedFieldChange={onSharedFieldChange} />
                      <span />
                      <span />
                    </div>
                    {p.thumbnailUrl && (
                      <div className="grid grid-cols-[44px_1fr_60px_30px] gap-2 items-center">
                        <span />

                        <div className="flex items-center gap-2">
                          <img src={p.thumbnailUrl} alt="" className="w-8 h-8 object-contain rounded border border-neutral-200 bg-white" />
                          <span className="text-[11px] text-neutral-500">Photo saved \u2014 real URL ready for export</span>
                          <button
                            onClick={() => onSharedFieldChange(p.id, { thumbnailUrl: "" })}
                            className="text-[11px] text-neutral-400 hover:text-red-500"
                          >
                            Remove
                          </button>
                        </div>
                        <span />
                        <span />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}



export default function GondolaGenerator() {
  const [gondolas, setGondolas] = useState([makeGondola({ number: "G1" })]);
  const [activeId, setActiveId] = useState(gondolas[0].id);
  const active = gondolas.find((g) => g.id === activeId) || gondolas[0];

  // Persistent, shared product registry -- once a product's info (upc, price,
  // thumbnail url) is entered anywhere, ever, it's remembered automatically
  // for every future session, not just within the current one.
  const [registry, setRegistry] = useState({});
  const [registryLoaded, setRegistryLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/registry");
        const data = await res.json();
        setRegistry(data || {});
      } catch (e) {
        // no registry saved yet -- normal on first use
      }
      setRegistryLoaded(true);
    })();
  }, []);

  const saveRegistryEntry = (name, entry) => {
    const key = (name || "").trim().toLowerCase();
    if (!key) return;
    setRegistry((prev) => {
      const next = { ...prev, [key]: { ...prev[key], ...entry } };
      fetch("/api/registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch(() => {});
      return next;
    });
  };

  const updateGondola = (patch) => setGondolas((prev) => prev.map((g) => (g.id === activeId ? { ...g, ...patch } : g)));
  const updateProducts = (mutator) => setGondolas((prev) => prev.map((g) => (g.id === activeId ? { ...g, products: mutator(g.products) } : g)));

  const exportProductsImportCSV = () => {
    const escape = (v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    // Products Import columns: ID, Name, Price, Weight, Thumbnail URL, Barcode, External ID, Tax code, Restricted
    const rows = [["ID", "Name", "Price", "Weight", "Thumbnail URL", "Barcode", "External ID", "Tax code", "Restricted"]];

    const seenNames = new Set();
    gondolas.forEach((g) => {
      g.products.forEach((p) => {
        const name = (p.name || "Unnamed").trim();
        const key = name.toLowerCase();
        if (seenNames.has(key)) return;
        seenNames.add(key);
        // Weight is left blank -- this tool doesn't collect a shippable weight
        rows.push(["", name, p.price || "", "", p.thumbnailUrl || "", p.upc || "", "", "", ""]);
      });
    });

    const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products_import_export.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportPlanogramCSV = () => {
    const escape = (v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = [["Gondola Index", "Shelf Index", "Bin Index", "UPC", "Product Name"]];

    gondolas.forEach((g) => {
      const gondolaIndexMatch = g.number.match(/\d+/);
      const gondolaIndex = gondolaIndexMatch ? gondolaIndexMatch[0] : g.number;
      const shelfNums = [...new Set(g.products.map((p) => p.shelf))].sort((a, b) => a - b);
      shelfNums.forEach((shelfNum) => {
        const shelfProducts = g.products.filter((p) => p.shelf === shelfNum); // same order used in the live preview
        shelfProducts.forEach((p, idx) => {
          rows.push([gondolaIndex, shelfNum, idx + 1, p.upc || "", p.name || "Unnamed"]);
        });
      });
    });

    const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "planogram_export.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const addGondola = () => {
    const g = makeGondola({ number: `G${gondolas.length + 1}` });
    setGondolas((prev) => [...prev, g]);
    setActiveId(g.id);
  };
  const duplicateGondola = (id) => {
    const src = gondolas.find((g) => g.id === id);
    const copy = { ...src, id: uid(), number: src.number + " copy", products: src.products.map((p) => ({ ...p, id: uid() })) };
    setGondolas((prev) => [...prev, copy]);
    setActiveId(copy.id);
  };
  const removeGondola = (id) => {
    if (gondolas.length === 1) return;
    const idx = gondolas.findIndex((g) => g.id === id);
    const next = gondolas.filter((g) => g.id !== id);
    setGondolas(next);
    if (activeId === id) setActiveId(next[Math.max(0, idx - 1)].id);
  };

  const addProduct = () => updateProducts((products) => [...products, makeProduct({ color: SWATCHES[products.length % SWATCHES.length] })]);
  const updateProduct = (id, patch) => updateProducts((products) => products.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const removeProduct = (id) => updateProducts((products) => products.filter((p) => p.id !== id));

  const normalizeName = (n) => (n || "").trim().toLowerCase();

  // Finds another product anywhere (any gondola, any shelf) with the same
  // name as `name`, excluding the product being edited. Used to pull already-
  // entered info (upc, price, image, shape) instead of leaving fields blank.
  const findMatchingProduct = (productId, name) => {
    const key = normalizeName(name);
    if (!key) return null;
    for (const g of gondolas) {
      for (const p of g.products) {
        if (p.id === productId) continue;
        if (normalizeName(p.name) === key) return p;
      }
    }
    return null;
  };

  // Called when a product's name changes. If another product anywhere already
  // has this name, pull its shared info in instead of leaving this row blank.
  const handleNameChange = (productId, newName) => {
    const match = findMatchingProduct(productId, newName);
    if (match) {
      updateProduct(productId, { name: newName, shape: match.shape, upc: match.upc, price: match.price, thumbnailUrl: match.thumbnailUrl });
      return;
    }
    // No match in the current session -- check the persistent registry
    // (products entered in past sessions too).
    const key = normalizeName(newName);
    const remembered = key ? registry[key] : null;
    const patch = remembered
      ? { name: newName, shape: remembered.shape || guessShape(newName), upc: remembered.upc || "", price: remembered.price || "", thumbnailUrl: remembered.thumbnailUrl || "" }
      : { name: newName, shape: guessShape(newName) };
    updateProduct(productId, patch);
  };

  // Called when upc/price/image/etc changes on a product. Applies the patch to
  // this product AND pushes those same shared fields to every other product
  // (in any gondola) with the same name, in one atomic update. Also saves to
  // the persistent registry so it's remembered in future sessions.
  const handleSharedFieldChange = (productId, patch) => {
    setGondolas((prev) => {
      let currentName = null;
      for (const g of prev) {
        const found = g.products.find((p) => p.id === productId);
        if (found) {
          currentName = found.name;
          break;
        }
      }
      const finalName = patch.name !== undefined ? patch.name : currentName;
      const key = normalizeName(finalName);
      if (key) saveRegistryEntry(finalName, patch);
      return prev.map((g) => ({
        ...g,
        products: g.products.map((p) => {
          if (p.id === productId) return { ...p, ...patch };
          if (key && normalizeName(p.name) === key) return { ...p, ...patch };
          return p;
        }),
      }));
    });
  };

  return (
    <div className="w-full min-h-[600px] bg-white text-neutral-900 p-5 rounded-2xl border border-neutral-200" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
      `}</style>

      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-wide" style={{ fontFamily: "'Oswald', sans-serif" }}>
            GONDOLA GENERATOR
          </h1>
          <p className="text-[12px] text-neutral-500">Fill in the fields, add products, and the fixture builds itself. Shelf 1 always starts at the bottom.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportProductsImportCSV} className="flex items-center gap-1.5 text-xs font-semibold bg-white border border-neutral-300 hover:border-neutral-400 text-neutral-700 rounded-lg px-3 py-2 transition-colors">
            <Download size={14} /> Export to Products Import
          </button>
          <button onClick={exportPlanogramCSV} className="flex items-center gap-1.5 text-xs font-semibold bg-white border border-neutral-300 hover:border-neutral-400 text-neutral-700 rounded-lg px-3 py-2 transition-colors">
            <Download size={14} /> Export to Planogram
          </button>
          <button onClick={addGondola} className="flex items-center gap-1.5 text-xs font-semibold bg-neutral-900 hover:bg-neutral-700 text-white rounded-lg px-3 py-2 transition-colors">
            <Plus size={14} /> Add gondola
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-5 flex-wrap border-b border-neutral-200 pb-3">
        {gondolas.map((g) => (
          <div
            key={g.id}
            onClick={() => setActiveId(g.id)}
            className={`group flex items-center gap-1.5 rounded-full pl-3 pr-1.5 py-1 cursor-pointer border transition-colors ${
              g.id === activeId ? "bg-neutral-900 border-neutral-900 text-white" : "bg-white border-neutral-300 text-neutral-500 hover:border-neutral-400"
            }`}
          >
            <span className="text-xs font-medium">{g.number || "G?"}</span>
            <button onClick={(e) => { e.stopPropagation(); duplicateGondola(g.id); }} className="opacity-0 group-hover:opacity-100 transition-opacity" title="Duplicate">
              <Copy size={11} />
            </button>
            {gondolas.length > 1 && (
              <button onClick={(e) => { e.stopPropagation(); removeGondola(g.id); }} className="opacity-0 group-hover:opacity-100 transition-opacity" title="Remove">
                <X size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* --- Config fields --- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-neutral-500">Gondola Number</span>
          <input
            value={active.number}
            onChange={(e) => updateGondola({ number: e.target.value })}
            className="border border-neutral-300 rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-neutral-500">Gondola Type</span>
          <select
            value={active.type}
            onChange={(e) => updateGondola({ type: e.target.value })}
            className="border border-neutral-300 rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="fridge">Fridge</option>
            <option value="dry">Dry Goods</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-neutral-500">Number of Shelves</span>
          <input
            type="number"
            min={1}
            max={10}
            value={active.shelfCount}
            onChange={(e) => updateGondola({ shelfCount: Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)) })}
            className="border border-neutral-300 rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </label>
      </div>

      <button
        onClick={() => {
          const placeholders = Array.from({ length: active.shelfCount }, (_, i) =>
            makeProduct({
              name: `Product on S${i + 1}`,
              shelf: i + 1,
              facings: active.facingsPerShelf,
              color: SWATCHES[i % SWATCHES.length],
            })
          );
          updateProducts(() => placeholders);
        }}
        className="mb-5 flex items-center gap-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg px-3 py-2 transition-colors"
      >
        <Plus size={14} /> Generate fixture from fields above
      </button>

      {/* --- Live preview --- */}
      <div className="mb-5">
        <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-2" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
          Preview
        </div>
        <div className="bg-neutral-100 rounded-xl p-5 overflow-x-auto">
          <GondolaFixture gondola={active} />
        </div>
      </div>

      {/* --- Product management --- */}
      <div className="grid grid-cols-1 gap-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-wide text-neutral-500" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            Products ({active.products.length})
          </div>
          <div className="flex items-center gap-3">
            <button onClick={addProduct} className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-800">
              <Plus size={12} /> Add one manually
            </button>
            <button
              onClick={() => updateProducts(() => [])}
              className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-red-500"
            >
              <X size={12} /> Clear all products
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 -mt-1">
          <Package size={12} />
          {registryLoaded
            ? `Type a matching product name to auto-fill any UPC, price, or photo saved for it before`
            : "Loading remembered products..."}
        </div>
        <ShelfEditor
          products={active.products}
          shelfCount={active.shelfCount}
          onAddToShelf={(shelfNum) =>
            updateProducts((products) => [
              ...products,
              makeProduct({ shelf: shelfNum, facings: active.facingsPerShelf, color: SWATCHES[products.length % SWATCHES.length] }),
            ])
          }
          onUpdate={updateProduct}
          onNameChange={handleNameChange}
          onSharedFieldChange={handleSharedFieldChange}
          onRemove={removeProduct}
        />
      </div>
    </div>
  );
}
