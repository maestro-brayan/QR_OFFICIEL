/**
 * MODULE FILIGRANE
 * ─────────────────────────────────────────────────
 * DIAGONAL uniquement : police BlippoBlack (api/fonts/BlippoBlack.ttf)
 *
 * Modifier uniquement cette section :
 */

const DIAGONAL = {
    text          : 'COPIE E-TRIBCOM',
    fontSize      : 65,
    letterSpacing : 20,
    color         : '#312f2f',
    opacity       : 0.18,
};

/* ── Ne pas modifier en dessous ── */
const { PDFDocument, rgb, degrees } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const fs      = require('fs');
const path    = require('path');

function hexToRgb(hex) {
    return {
        r: parseInt(hex.slice(1, 3), 16) / 255,
        g: parseInt(hex.slice(3, 5), 16) / 255,
        b: parseInt(hex.slice(5, 7), 16) / 255,
    };
}

function textWidthWithSpacing(font, text, fontSize, spacing) {
    let total = 0;
    for (let i = 0; i < text.length; i++) {
        total += font.widthOfTextAtSize(text[i], fontSize);
        if (i < text.length - 1) total += spacing;
    }
    return total;
}

function drawTextWithSpacing(page, text, { x, y, font, fontSize, spacing, color, opacity, angleRad }) {
    let offset = 0;
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    for (const char of text) {
        page.drawText(char, {
            x:      x + offset * cosA,
            y:      y + offset * sinA,
            size:   fontSize,
            font,
            color,
            opacity,
            rotate: degrees(angleRad * 180 / Math.PI),
        });
        offset += font.widthOfTextAtSize(char, fontSize) + spacing;
    }
}

async function applyWatermark(pdfBuffer) {
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    pdfDoc.registerFontkit(fontkit);

    const diagFontBytes = fs.readFileSync(path.join(__dirname, 'fonts', 'BlippoBlack.ttf'));
    const fontDiag      = await pdfDoc.embedFont(diagFontBytes);

    const pages = pdfDoc.getPages();

    for (const page of pages) {
        const { width, height } = page.getSize();

        const dRgb    = hexToRgb(DIAGONAL.color);
        const angleRad = 50 * Math.PI / 180;
        const totalW  = textWidthWithSpacing(
            fontDiag, DIAGONAL.text, DIAGONAL.fontSize, DIAGONAL.letterSpacing
        );
        const cx = width  / 2;
        const cy = height / 2;

        const startX = cx - (totalW / 2) * Math.cos(angleRad) + (DIAGONAL.fontSize / 2) * Math.sin(angleRad);
        const startY = cy - (totalW / 2) * Math.sin(angleRad) - (DIAGONAL.fontSize / 2) * Math.cos(angleRad);

        drawTextWithSpacing(page, DIAGONAL.text, {
            x: startX, y: startY,
            font:     fontDiag,
            fontSize: DIAGONAL.fontSize,
            spacing:  DIAGONAL.letterSpacing,
            color:    rgb(dRgb.r, dRgb.g, dRgb.b),
            opacity:  DIAGONAL.opacity,
            angleRad,
        });
    }

    return Buffer.from(await pdfDoc.save());
}

module.exports = { applyWatermark };