import { canAccessBusiness, getAuthenticatedUser, getOwnedBusiness } from "@/lib/auth/guards";
import { getReportOverviewData } from "@/lib/reports/overview";
import { PDFDocument, PageSizes, StandardFonts, rgb } from "pdf-lib";
import { NextRequest, NextResponse } from "next/server";

async function resolveBusinessId(userId: string, requestedBusinessId: string | null | undefined) {
  if (requestedBusinessId) {
    const hasAccess = await canAccessBusiness(userId, requestedBusinessId);
    if (!hasAccess) {
      return { error: "No autorizado para este negocio.", status: 403 as const };
    }
    return { businessId: requestedBusinessId };
  }

  const ownedBusiness = await getOwnedBusiness(userId);
  if (!ownedBusiness) {
    return { error: "No se encontró un negocio para este usuario.", status: 404 as const };
  }

  return { businessId: ownedBusiness.id };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("es-PE").format(new Date(value));
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

type TableOptions = {
  headers: string[];
  widths: number[];
  rows: string[][];
  rightAligned?: number[];
};

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const businessIdParam = searchParams.get("businessId");
    const yearParam = searchParams.get("year");
    const campaignIdParam = searchParams.get("campaignId");

    const businessResolution = await resolveBusinessId(user.id, businessIdParam);
    if (!businessResolution.businessId) {
      return NextResponse.json({ error: businessResolution.error }, { status: businessResolution.status });
    }

    const requestedYear = yearParam ? Number(yearParam) : undefined;
    const data = await getReportOverviewData({
      businessId: businessResolution.businessId,
      requestedYear,
      requestedCampaignId: campaignIdParam,
    });

    const selectedCampaignName = data.selectedCampaignId
      ? data.campaignOptions.find((campaign) => campaign.id === data.selectedCampaignId)?.name ?? "Campaña seleccionada"
      : null;

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
    const pageSize: [number, number] = [PageSizes.A4[1], PageSizes.A4[0]];
    const marginX = 40;
    const marginTop = 36;
    const marginBottom = 34;
    const contentWidth = pageSize[0] - marginX * 2;
    let page = pdf.addPage(pageSize);
    let cursorY = pageSize[1] - marginTop;

    const ensureSpace = (neededHeight: number) => {
      if (cursorY - neededHeight >= marginBottom) {
        return;
      }

      page = pdf.addPage(pageSize);
      cursorY = pageSize[1] - marginTop;
    };

    const drawText = (
      text: string,
      {
        x = marginX,
        size = 10,
        bold = false,
        color = rgb(0.18, 0.24, 0.36),
      }: { x?: number; size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {},
    ) => {
      const activeFont = bold ? boldFont : font;
      page.drawText(text, {
        x,
        y: cursorY,
        size,
        font: activeFont,
        color,
      });
    };

    const drawLine = () => {
      page.drawLine({
        start: { x: marginX, y: cursorY },
        end: { x: marginX + contentWidth, y: cursorY },
        thickness: 1,
        color: rgb(0.86, 0.89, 0.94),
      });
    };

    const drawSectionTitle = (title: string, subtitle?: string) => {
      ensureSpace(subtitle ? 42 : 26);
      drawText(title, { size: 13, bold: true });
      cursorY -= 18;
      if (subtitle) {
        drawText(subtitle, { size: 9, color: rgb(0.42, 0.49, 0.59) });
        cursorY -= 14;
      }
      drawLine();
      cursorY -= 14;
    };

    const drawSummaryBlock = () => {
      const items = [
        ["Vendido", formatCurrency(data.annualSummary.sold)],
        ["Costo total", formatCurrency(data.annualSummary.cost)],
        ["Ganancia total", formatCurrency(data.annualSummary.margin)],
        ["Cobrado", formatCurrency(data.annualSummary.collected)],
        ["Deuda pendiente", formatCurrency(data.annualSummary.pending)],
      ] as const;

      const colWidth = contentWidth / 2;
      const rowHeight = 22;
      ensureSpace(16 + Math.ceil(items.length / 2) * rowHeight + 16);
      const localY = cursorY;

      items.forEach(([label, value], index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const x = marginX + col * colWidth;
        const y = localY - row * rowHeight;
        page.drawText(label, {
          x,
          y,
          size: 9,
          font: boldFont,
          color: rgb(0.42, 0.49, 0.59),
        });
        page.drawText(value, {
          x: x + 120,
          y,
          size: 9,
          font,
          color: rgb(0.18, 0.24, 0.36),
        });
      });

      cursorY = localY - Math.ceil(items.length / 2) * rowHeight - 4;
    };

    const drawTable = ({ headers, widths, rows, rightAligned = [] }: TableOptions) => {
      const headerHeight = 18;
      const rowHeight = 18;
      ensureSpace(headerHeight + rowHeight + 10);

      const drawHeader = () => {
        let x = marginX;
        headers.forEach((header, index) => {
          page.drawText(header, {
            x,
            y: cursorY,
            size: 8,
            font: boldFont,
            color: rgb(0.42, 0.49, 0.59),
          });
          x += widths[index];
        });
        cursorY -= 12;
        drawLine();
        cursorY -= 12;
      };

      drawHeader();

      rows.forEach((row) => {
        ensureSpace(rowHeight + 10);
        let x = marginX;

        row.forEach((cell, index) => {
          const safeCell = truncate(cell, Math.max(8, Math.floor(widths[index] / 7)));
          const textWidth = font.widthOfTextAtSize(safeCell, 8.5);
          const drawX = rightAligned.includes(index)
            ? x + widths[index] - textWidth - 4
            : x;

          page.drawText(safeCell, {
            x: drawX,
            y: cursorY,
            size: 8.5,
            font,
            color: rgb(0.18, 0.24, 0.36),
          });
          x += widths[index];
        });

        cursorY -= 12;
        page.drawLine({
          start: { x: marginX, y: cursorY },
          end: { x: marginX + contentWidth, y: cursorY },
          thickness: 0.6,
          color: rgb(0.92, 0.94, 0.97),
        });
        cursorY -= 8;

        if (cursorY < marginBottom + rowHeight) {
          page = pdf.addPage(pageSize);
          cursorY = pageSize[1] - marginTop;
          drawHeader();
        }
      });
    };

    drawText("Reporte de ventas y rentabilidad", { size: 18, bold: true });
    cursorY -= 22;
    drawText(
      selectedCampaignName
        ? `Campaña: ${selectedCampaignName} | Año: ${data.selectedYear}`
        : `Reporte anual ${data.selectedYear}`,
      { size: 10, color: rgb(0.42, 0.49, 0.59) },
    );
    cursorY -= 12;
    drawText(`Generado el ${formatDate(new Date())}`, { size: 9, color: rgb(0.42, 0.49, 0.59) });
    cursorY -= 14;
    drawLine();
    cursorY -= 16;

    drawSectionTitle("Resumen general");
    drawSummaryBlock();
    cursorY -= 10;

    drawSectionTitle(
      selectedCampaignName ? "Desglose de la campaña" : "Desglose por campaña",
      selectedCampaignName ? undefined : `${data.campaignBreakdown.length} campañas incluidas en el filtro actual.`,
    );
    drawTable({
      headers: ["Campaña", "Vendido", "Costo", "Ganancia", "Cobrado", "Pendiente", "Clientes"],
      widths: [190, 80, 80, 90, 80, 90, 60],
      rightAligned: [1, 2, 3, 4, 5, 6],
      rows: data.campaignBreakdown.map((row) => [
        row.campaignName,
        formatCurrency(row.sold),
        formatCurrency(row.cost),
        formatCurrency(row.margin),
        formatCurrency(row.collected),
        formatCurrency(row.pending),
        String(row.customersCount),
      ]),
    });
    cursorY -= 10;

    drawSectionTitle("Ganancia por categoría");
    drawTable({
      headers: ["Categoría", "Venta", "Costo", "Ganancia", "Ítems"],
      widths: [190, 120, 120, 120, 80],
      rightAligned: [1, 2, 3, 4],
      rows: data.categoryMargins.map((row) => [
        row.category,
        formatCurrency(row.sold),
        formatCurrency(row.cost),
        formatCurrency(row.margin),
        String(row.itemsCount),
      ]),
    });
    cursorY -= 10;

    if (selectedCampaignName) {
      drawSectionTitle("Detalle de productos de la campaña");
      drawTable({
        headers: ["Producto", "Marca", "Cantidad", "Costo", "Vendido"],
        widths: [300, 90, 70, 100, 100],
        rightAligned: [2, 3, 4],
        rows:
          data.campaignProductDetails.length > 0
            ? data.campaignProductDetails.map((row) => [
                row.productName,
                row.category,
                String(row.quantity),
                formatCurrency(row.totalCost),
                formatCurrency(row.totalSold),
              ])
            : [["No hay productos registrados para esta campaña.", "-", "0", formatCurrency(0), formatCurrency(0)]],
      });
      cursorY -= 10;
    }

    drawSectionTitle("Historial de gastos");
    drawTable({
      headers: ["Fecha", "Campaña", "Concepto", "Monto", "Observación"],
      widths: [70, 150, 200, 80, 180],
      rightAligned: [3],
      rows:
        data.expensesHistory.length > 0
          ? data.expensesHistory.map((row) => [
              formatDate(row.expenseDate),
              row.campaignName,
              row.concept,
              formatCurrency(row.amount),
              row.notes ?? "-",
            ])
          : [["-", "-", "No hay gastos registrados para este filtro.", "-", "-"]],
    });
    cursorY -= 10;

    drawSectionTitle("Top 5 clientes que más compran");
    drawTable({
      headers: ["Cliente", "Compras", "Total comprado"],
      widths: [430, 120, 150],
      rightAligned: [1, 2],
      rows:
        data.topBuyers.length > 0
          ? data.topBuyers.map((row) => [row.customerName, String(row.purchasesCount), formatCurrency(row.totalPurchased)])
          : [["No hay compras registradas para este filtro.", "0", formatCurrency(0)]],
    });
    cursorY -= 10;

    drawSectionTitle("Top 5 clientes con mayor deuda");
    drawTable({
      headers: ["Cliente", "Campañas con deuda", "Deuda"],
      widths: [430, 120, 150],
      rightAligned: [1, 2],
      rows:
        data.topDebtors.length > 0
          ? data.topDebtors.map((row) => [row.customerName, String(row.pendingCampaigns), formatCurrency(row.debt)])
          : [["No hay deuda registrada para este filtro.", "0", formatCurrency(0)]],
    });

    const bytes = await pdf.save();
    const filenameBase = selectedCampaignName ? `reporte-${data.selectedYear}-${slugify(selectedCampaignName)}` : `reporte-${data.selectedYear}-anual`;

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo exportar el reporte en PDF.",
        detail: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}
