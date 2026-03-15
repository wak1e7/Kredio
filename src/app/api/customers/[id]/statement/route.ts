import { getAuthenticatedUser } from "@/lib/auth/guards";
import { getCustomerStatementData } from "@/lib/customer-statement";
import { PDFDocument, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { NextResponse } from "next/server";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function sanitizeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const { id } = await context.params;
    const statement = await getCustomerStatementData(authUser.id, id);

    if (!statement) {
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    }

    const statementData = statement;
    const pdfDoc = await PDFDocument.create();
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 28;
    const contentWidth = pageWidth - margin * 2;
    const lineColor = rgb(0.15, 0.18, 0.23);
    const lightFill = rgb(0.87, 0.89, 0.93);
    const white = rgb(1, 1, 1);
    const textColor = rgb(0.08, 0.1, 0.14);

    const pages: PDFPage[] = [];
    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    pages.push(page);
    let y = pageHeight - margin;

    function addPage() {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      pages.push(page);
      y = pageHeight - margin;
    }

    function ensureSpace(requiredHeight: number) {
      if (y - requiredHeight < margin) {
        addPage();
      }
    }

    function drawText(
      value: string,
      x: number,
      topY: number,
      size = 10,
      bold = false,
      color = textColor,
    ) {
      page.drawText(value, {
        x,
        y: topY,
        size,
        font: bold ? boldFont : regularFont,
        color,
      });
    }

    function textWidth(value: string, size = 10, bold = false) {
      return (bold ? boldFont : regularFont).widthOfTextAtSize(value, size);
    }

    function wrapText(value: string, maxWidth: number, size = 9, bold = false) {
      const normalized = value.trim();
      if (!normalized) {
        return [""];
      }

      const words = normalized.split(/\s+/);
      const lines: string[] = [];
      let currentLine = "";
      const activeFont = bold ? boldFont : regularFont;

      for (const word of words) {
        const candidate = currentLine ? `${currentLine} ${word}` : word;
        if (activeFont.widthOfTextAtSize(candidate, size) <= maxWidth || !currentLine) {
          currentLine = candidate;
          continue;
        }

        lines.push(currentLine);
        currentLine = word;
      }

      if (currentLine) {
        lines.push(currentLine);
      }

      return lines;
    }

    function drawHorizontalRule(topY: number, thickness = 1.2) {
      page.drawLine({
        start: { x: margin, y: topY },
        end: { x: pageWidth - margin, y: topY },
        thickness,
        color: lineColor,
      });
    }

    function drawLabeledRows(
      x: number,
      topY: number,
      width: number,
      rows: Array<{ label: string; value: string }>,
      labelWidth: number,
      rowHeight = 18,
      fontSize = 9,
    ) {
      let currentTop = topY;

      for (const row of rows) {
        page.drawRectangle({
          x,
          y: currentTop - rowHeight,
          width: labelWidth,
          height: rowHeight,
          borderColor: lineColor,
          borderWidth: 1,
          color: lightFill,
        });

        page.drawRectangle({
          x: x + labelWidth,
          y: currentTop - rowHeight,
          width: width - labelWidth,
          height: rowHeight,
          borderColor: lineColor,
          borderWidth: 1,
          color: white,
        });

        drawText(row.label, x + 6, currentTop - 12, fontSize, true);
        drawText(row.value, x + labelWidth + 6, currentTop - 12, fontSize);
        currentTop -= rowHeight;
      }

      return currentTop;
    }

    function drawDataTable(
      title: string,
      x: number,
      topY: number,
      width: number,
      rows: Array<{ label: string; value: string }>,
    ) {
      const titleHeight = 18;
      const rowHeight = 18;

      page.drawRectangle({
        x,
        y: topY - titleHeight,
        width,
        height: titleHeight,
        borderColor: lineColor,
        borderWidth: 1,
        color: lightFill,
      });
      drawText(title, x + 6, topY - 12, 9, true);

      return drawLabeledRows(x, topY - titleHeight, width, rows, width * 0.56, rowHeight, 9);
    }

    function drawMovementTable() {
      const columns = [
        { label: "FECHA", width: 64, align: "left" as const },
        { label: "CONCEPTO", width: 190, align: "left" as const },
        { label: "REFERENCIA", width: 78, align: "left" as const },
        { label: "CARGOS", width: 72, align: "right" as const },
        { label: "ABONOS", width: 72, align: "right" as const },
        { label: "SALDO", width: 80, align: "right" as const },
      ];
      const headerHeight = 20;
      const baseRowHeight = 20;
      let runningBalance = 0;

      function drawHeader() {
        let currentX = margin;

        page.drawRectangle({
          x: margin,
          y: y - headerHeight,
          width: contentWidth,
          height: headerHeight,
          borderColor: lineColor,
          borderWidth: 1,
          color: lightFill,
        });

        for (const column of columns) {
          drawText(column.label, currentX + 6, y - 13, 8.5, true);
          currentX += column.width;
          if (currentX < margin + contentWidth) {
            page.drawLine({
              start: { x: currentX, y: y - headerHeight },
              end: { x: currentX, y: y },
              thickness: 1,
              color: lineColor,
            });
          }
        }

        y -= headerHeight;
      }

      ensureSpace(48);
      drawText("DETALLE DE MOVIMIENTOS REALIZADOS", margin, y, 10, true);
      drawHorizontalRule(y - 4);
      y -= 12;
      drawHeader();

      const rows = statementData.movements.map((movement) => {
        runningBalance = Number((runningBalance + movement.charge - movement.credit).toFixed(2));

        return {
          date: formatDate(movement.date),
          concept: movement.concept,
          reference: movement.reference,
          charge: movement.charge > 0 ? formatCurrency(movement.charge) : "",
          credit: movement.credit > 0 ? formatCurrency(movement.credit) : "",
          balance: formatCurrency(runningBalance),
        };
      });

      rows.push({
        date: "",
        concept: "DEUDA TOTAL",
        reference: "",
        charge: "",
        credit: "",
        balance: formatCurrency(statementData.totals.totalDebt),
      });

      if (rows.length === 0) {
        rows.push({
          date: "",
          concept: "Sin movimientos registrados",
          reference: "",
          charge: "",
          credit: "",
          balance: formatCurrency(statementData.totals.totalDebt),
        });
      }

      for (const row of rows) {
        const cells = [row.date, row.concept, row.reference, row.charge, row.credit, row.balance];
        const wrappedCells = cells.map((cell, index) =>
          wrapText(cell, Math.max(columns[index].width - 10, 20), 8.5, index === 1 && row.concept === "DEUDA TOTAL"),
        );
        const lineCount = Math.max(...wrappedCells.map((lines) => lines.length));
        const rowHeight = Math.max(baseRowHeight, lineCount * 10 + 8);

        if (y - rowHeight < margin) {
          addPage();
          drawHeader();
        }

        let currentX = margin;
        const isFinalRow = row.concept === "DEUDA TOTAL";

        page.drawRectangle({
          x: margin,
          y: y - rowHeight,
          width: contentWidth,
          height: rowHeight,
          borderColor: lineColor,
          borderWidth: 1,
          color: isFinalRow ? lightFill : white,
        });

        for (let index = 0; index < columns.length; index += 1) {
          const column = columns[index];
          const lines = wrappedCells[index];

          if (index > 0) {
            page.drawLine({
              start: { x: currentX, y: y - rowHeight },
              end: { x: currentX, y: y },
              thickness: 1,
              color: lineColor,
            });
          }

          let lineY = y - 12;
          for (const line of lines) {
            const isRight = column.align === "right";
            const lineWidth = textWidth(line, 8.5, isFinalRow && index === 1);
            const textX = isRight ? currentX + column.width - lineWidth - 6 : currentX + 6;

            drawText(line, textX, lineY, 8.5, isFinalRow && index === 1);
            lineY -= 10;
          }

          currentX += column.width;
        }

        y -= rowHeight;
      }
    }

    const accountInfoRows = [
      { label: "REGISTRO", value: formatDate(statementData.customer.createdAt) },
      { label: "DOCUMENTO", value: statementData.customer.documentId ?? "-" },
      { label: "TELEFONO", value: statementData.customer.phone || "-" },
      { label: "ESTADO", value: statementData.customer.status === "ACTIVE" ? "ACTIVO" : "INACTIVO" },
      { label: "DIRECCION", value: statementData.customer.address ?? "-" },
    ];

    const financialLeftRows = [
      { label: "Total comprado", value: formatCurrency(statementData.totals.totalPurchased) },
      { label: "Total pagado", value: formatCurrency(statementData.totals.totalPaid) },
      { label: "Deuda total", value: formatCurrency(statementData.totals.totalDebt) },
    ];

    drawText("Kredio", margin, y, 28, true);
    drawText("Estado de cuenta", pageWidth - margin - 140, y + 10, 15, true);
    y -= 34;

    const rightBoxWidth = 245;
    const rightBoxX = pageWidth - margin - rightBoxWidth;
    const leftBlockWidth = rightBoxX - margin - 18;

    const leftTextLines = [
      statementData.customer.fullName.toUpperCase(),
      statementData.customer.address?.toUpperCase() ?? "SIN DIRECCION REGISTRADA",
      statementData.customer.phone ? `TEL. ${statementData.customer.phone}` : "",
      statementData.customer.documentId ? `DOC. ${statementData.customer.documentId}` : "",
    ].filter(Boolean);

    let leftLineY = y - 12;
    for (const line of leftTextLines) {
      const wrapped = wrapText(line, leftBlockWidth, 9, line === leftTextLines[0]);
      for (const piece of wrapped) {
        drawText(piece, margin, leftLineY, line === leftTextLines[0] ? 10 : 8.5, line === leftTextLines[0]);
        leftLineY -= 12;
      }
    }

    const accountBottom = drawLabeledRows(rightBoxX, y, rightBoxWidth, accountInfoRows, 88, 16, 8.2);
    y = accountBottom - 12;

    drawText("INFORMACION FINANCIERA", margin, y, 9.5, true);
    drawText("MONEDA NACIONAL", pageWidth - margin - 112, y, 8.5, true);
    drawHorizontalRule(y - 5);
    y -= 14;

    const financialBottom = drawDataTable("RESUMEN FINANCIERO", margin, y, contentWidth, financialLeftRows);
    y = financialBottom - 18;

    drawMovementTable();

    for (let index = 0; index < pages.length; index += 1) {
      const currentPage = pages[index];
      const label = `HOJA ${index + 1} DE ${pages.length}`;
      currentPage.drawText(label, {
        x: pageWidth - margin - textWidth(label, 8, true),
        y: margin - 10,
        size: 8,
        font: boldFont,
        color: textColor,
      });
    }

    const pdfBytes = await pdfDoc.save();
    const fileName = `estado-cuenta-${sanitizeFileName(statementData.customer.fullName || "cliente")}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo exportar el estado de cuenta.",
        detail: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}
