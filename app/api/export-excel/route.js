import JSZip from "jszip";
import path from "path";
import fs from "fs";
import { NextResponse } from "next/server";

export const maxDuration = 30;

const TEMPLATE_PATH = path.join(process.cwd(), "public", "templates", "planogram-template.xlsx");

const PLANOGRAM_SHEET_NAME = "Planogram";
const PRODUCTS_SHEET_NAME = "Products Import "; // trailing space, matches the template exactly

function escapeXml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function colRefToIndex(ref) {
  const letters = ref.match(/[A-Z]+/)[0];
  let n = 0;
  for (let i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
  return n;
}

function colIndexToLetters(n) {
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Finds the actual worksheetN.xml path for a given visible sheet name, by
// reading workbook.xml (name -> r:id) and workbook.xml.rels (r:id -> file).
async function findSheetPath(zip, sheetName) {
  const workbookXml = await zip.file("xl/workbook.xml").async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels").async("string");

  const sheetTagRegex = /<sheet\b[^>]*\/>/g;
  let match;
  let rId = null;
  while ((match = sheetTagRegex.exec(workbookXml)) !== null) {
    const tag = match[0];
    const nameMatch = tag.match(/name="([^"]*)"/);
    if (nameMatch && nameMatch[1] === sheetName) {
      const idMatch = tag.match(/r:id="([^"]+)"/);
      if (idMatch) rId = idMatch[1];
      break;
    }
  }
  if (!rId) throw new Error(`Sheet "${sheetName}" not found in workbook.xml`);

  const relRegex = new RegExp(`<Relationship\\b[^>]*Id="${rId}"[^>]*/>`);
  const relMatch = relsXml.match(relRegex);
  if (!relMatch) throw new Error(`Relationship not found for ${rId}`);
  const targetMatch = relMatch[0].match(/Target="([^"]+)"/);
  if (!targetMatch) throw new Error(`Target not found for ${rId}`);
  let target = targetMatch[1];
  if (!target.startsWith("xl/")) target = "xl/" + target.replace(/^\/+/, "");
  return target;
}

// Parses the <c> elements of one <row>...</row> block into a map keyed by
// column index, so we can reuse each cell's existing style and only replace
// the parts we actually need to.
function parseRowCells(rowInner) {
  const cellRegex = /<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g;
  const cells = new Map();
  let m;
  while ((m = cellRegex.exec(rowInner)) !== null) {
    const refMatch = m[0].match(/r="([A-Z]+\d+)"/);
    if (!refMatch) continue;
    const colIndex = colRefToIndex(refMatch[1]);
    cells.set(colIndex, m[0]);
  }
  return cells;
}

function cellStyleAttr(existingCellXml) {
  if (!existingCellXml) return "";
  const sMatch = existingCellXml.match(/\ss="(\d+)"/);
  return sMatch ? ` s="${sMatch[1]}"` : "";
}

function buildCell(rowNum, colIndex, value, type, existingCellXml) {
  const ref = `${colIndexToLetters(colIndex)}${rowNum}`;
  const style = cellStyleAttr(existingCellXml);
  if (value === "" || value === null || value === undefined) {
    return existingCellXml || `<c r="${ref}"${style}/>`;
  }
  if (type === "number" && !isNaN(Number(value)) && String(value).trim() !== "") {
    return `<c r="${ref}"${style}><v>${Number(value)}</v></c>`;
  }
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

// Writes a set of {col, value, type} entries into the given row number,
// reusing that row's existing opening tag and any cells we don't touch,
// so formatting (borders, height, etc.) already in the template survives.
function buildRowXml(rowNum, entries, existingRowXml) {
  let openTag = `<row r="${rowNum}">`;
  let existingCells = new Map();
  if (existingRowXml) {
    const openTagMatch = existingRowXml.match(/^<row\b[^>]*>/);
    if (openTagMatch) openTag = openTagMatch[0];
    const innerMatch = existingRowXml.match(/^<row\b[^>]*>([\s\S]*)<\/row>$/);
    if (innerMatch) existingCells = parseRowCells(innerMatch[1]);
  }

  entries.forEach(({ col, value, type }) => {
    existingCells.set(col, buildCell(rowNum, col, value, type, existingCells.get(col)));
  });

  const sortedCols = Array.from(existingCells.keys()).sort((a, b) => a - b);
  const cellsXml = sortedCols.map((c) => existingCells.get(c)).join("");
  return `${openTag}${cellsXml}</row>`;
}

// Merges a set of newly-built rows (by row number) into a sheet's XML,
// replacing/augmenting existing rows in place and preserving every row and
// every other part of the sheet we don't explicitly write to.
function mergeRowsIntoSheet(sheetXml, rowsByNum) {
  const isEmpty = /<sheetData\s*\/>/.test(sheetXml);
  const dataMatch = sheetXml.match(/<sheetData>([\s\S]*?)<\/sheetData>/);
  const inner = dataMatch ? dataMatch[1] : "";

  const rowRegex = /<row\b[^>]*\/>|<row\b[^>]*>[\s\S]*?<\/row>/g;
  const existingRows = new Map();
  let m;
  while ((m = rowRegex.exec(inner)) !== null) {
    const rMatch = m[0].match(/r="(\d+)"/);
    if (rMatch) existingRows.set(parseInt(rMatch[1], 10), m[0]);
  }

  rowsByNum.forEach((entries, rowNum) => {
    const built = buildRowXml(rowNum, entries, existingRows.get(rowNum));
    existingRows.set(rowNum, built);
  });

  const allNums = Array.from(existingRows.keys()).sort((a, b) => a - b);
  const rebuilt = allNums.map((n) => existingRows.get(n)).join("");

  if (isEmpty) {
    return sheetXml.replace(/<sheetData\s*\/>/, `<sheetData>${rebuilt}</sheetData>`);
  }
  return sheetXml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, `<sheetData>${rebuilt}</sheetData>`);
}

export async function POST(request) {
  try {
    const { gondolas } = await request.json();
    if (!Array.isArray(gondolas)) {
      return NextResponse.json({ error: "Expected { gondolas: [...] }" }, { status: 400 });
    }

    const templateBuffer = fs.readFileSync(TEMPLATE_PATH);
    const zip = await JSZip.loadAsync(templateBuffer);

    const planogramPath = await findSheetPath(zip, PLANOGRAM_SHEET_NAME);
    const productsPath = await findSheetPath(zip, PRODUCTS_SHEET_NAME);

    // --- Planogram: Gondola Index | Shelf Index | Bin Index | UPC | Product Name ---
    const planogramRows = new Map();
    let planogramRowNum = 2;
    gondolas.forEach((g) => {
      const gondolaIndexMatch = (g.number || "").match(/\d+/);
      const gondolaIndex = gondolaIndexMatch ? parseInt(gondolaIndexMatch[0], 10) : g.number;
      const shelfNums = [...new Set(g.products.map((p) => p.shelf))].sort((a, b) => a - b);
      shelfNums.forEach((shelfNum) => {
        const shelfProducts = g.products.filter((p) => p.shelf === shelfNum);
        shelfProducts.forEach((p, idx) => {
          planogramRows.set(planogramRowNum, [
            { col: 1, value: gondolaIndex, type: "number" },
            { col: 2, value: shelfNum, type: "number" },
            { col: 3, value: idx + 1, type: "number" },
            { col: 4, value: p.upc || "", type: "string" },
            { col: 5, value: p.name || "Unnamed", type: "string" },
          ]);
          planogramRowNum++;
        });
      });
    });

    // --- Products Import: ID | Name | Price | Weight | Thumbnail URL | Barcode | External ID | Tax code | Restricted ---
    const seenNames = new Set();
    const productsRows = new Map();
    let productsRowNum = 2;
    gondolas.forEach((g) => {
      g.products.forEach((p) => {
        const name = (p.name || "Unnamed").trim();
        const key = name.toLowerCase();
        if (seenNames.has(key)) return;
        seenNames.add(key);
        productsRows.set(productsRowNum, [
          { col: 2, value: name, type: "string" },
          { col: 3, value: p.price || "", type: "number" },
          { col: 5, value: p.thumbnailUrl || "", type: "string" },
          { col: 6, value: p.upc || "", type: "string" },
        ]);
        productsRowNum++;
      });
    });

    const planogramXmlOriginal = await zip.file(planogramPath).async("string");
    zip.file(planogramPath, mergeRowsIntoSheet(planogramXmlOriginal, planogramRows));

    const productsXmlOriginal = await zip.file(productsPath).async("string");
    zip.file(productsPath, mergeRowsIntoSheet(productsXmlOriginal, productsRows));

    const outBuffer = await zip.generateAsync({ type: "nodebuffer" });

    return new NextResponse(outBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="planogram-export.xlsx"',
      },
    });
  } catch (err) {
    console.error("Excel export failed", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
