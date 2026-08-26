import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import { NextResponse } from "next/server";

const TEMPLATE_PATH = path.join(process.cwd(), "public", "templates", "planogram-template.xlsx");

const PLANOGRAM_SHEET = "Planogram";
const PRODUCTS_SHEET = "Products Import "; // note: trailing space, matches the template exactly

export async function POST(request) {
  try {
    const { gondolas } = await request.json();
    if (!Array.isArray(gondolas)) {
      return NextResponse.json({ error: "Expected { gondolas: [...] }" }, { status: 400 });
    }

    const templateBuffer = fs.readFileSync(TEMPLATE_PATH);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(templateBuffer);

    const planogramSheet = workbook.getWorksheet(PLANOGRAM_SHEET);
    const productsSheet = workbook.getWorksheet(PRODUCTS_SHEET);
    if (!planogramSheet || !productsSheet) {
      return NextResponse.json({ error: "Template is missing an expected tab" }, { status: 500 });
    }

    // --- Planogram tab: Gondola Index | Shelf Index | Bin Index | UPC | Product Name ---
    let planogramRow = 2;
    gondolas.forEach((g) => {
      const gondolaIndexMatch = (g.number || "").match(/\d+/);
      const gondolaIndex = gondolaIndexMatch ? parseInt(gondolaIndexMatch[0], 10) : g.number;
      const shelfNums = [...new Set(g.products.map((p) => p.shelf))].sort((a, b) => a - b);
      shelfNums.forEach((shelfNum) => {
        const shelfProducts = g.products.filter((p) => p.shelf === shelfNum);
        shelfProducts.forEach((p, idx) => {
          const row = planogramSheet.getRow(planogramRow);
          row.getCell(1).value = gondolaIndex;
          row.getCell(2).value = shelfNum;
          row.getCell(3).value = idx + 1;
          row.getCell(4).value = p.upc || "";
          row.getCell(5).value = p.name || "Unnamed";
          row.commit();
          planogramRow++;
        });
      });
    });

    // --- Products Import tab: ID | Name | Price | Weight | Thumbnail URL | Barcode | External ID | Tax code | Restricted ---
    const seenNames = new Set();
    let productsRow = 2;
    gondolas.forEach((g) => {
      g.products.forEach((p) => {
        const name = (p.name || "Unnamed").trim();
        const key = name.toLowerCase();
        if (seenNames.has(key)) return;
        seenNames.add(key);

        const row = productsSheet.getRow(productsRow);
        row.getCell(1).value = ""; // ID
        row.getCell(2).value = name; // Name
        row.getCell(3).value = p.price || ""; // Price
        row.getCell(4).value = ""; // Weight
        row.getCell(5).value = p.thumbnailUrl || ""; // Thumbnail URL
        row.getCell(6).value = p.upc || ""; // Barcode
        row.getCell(7).value = ""; // External ID
        row.getCell(8).value = ""; // Tax code
        row.getCell(9).value = ""; // Restricted
        row.commit();
        productsRow++;
      });
    });

    const outBuffer = await workbook.xlsx.writeBuffer();

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
