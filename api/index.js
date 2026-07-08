const express  = require('express');
const multer   = require('multer');
const qrcode   = require('qrcode');
const path     = require('path');
const { put }  = require('@vercel/blob');
const { applyWatermark } = require('./watermark');

const app    = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

/* ── Validation du champ "periode" (MM-YYYY ou MM/YYYY) ── */
function parsePeriode(periode) {
    if (!periode || typeof periode !== 'string') return null;

    const match = periode.trim().match(/^(\d{1,2})[\/\-](\d{4})$/);
    if (!match) return null;

    const mois  = parseInt(match[1], 10);
    const annee = parseInt(match[2], 10);
    const anneeActuelle = new Date().getFullYear();

    if (mois < 1 || mois > 12) return null;
    if (annee < 1970 || annee > anneeActuelle) return null;

    return { mm: String(mois).padStart(2, '0'), yyyy: String(annee) };
}

/* ── Validation des champs "code" et "numero" (référence manuelle) ── */
function sanitizeRef(value) {
    if (!value || typeof value !== 'string') return null;
    const cleaned = value.trim().replace(/[^a-zA-Z0-9]/g, '');
    if (!cleaned) return null;
    return cleaned;
}

/* ── Upload + filigrane + QR Code ── */
app.post('/api/upload', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Pas de fichier' });

        const periode = parsePeriode(req.body.periode);
        if (!periode) {
            return res.status(400).json({ error: 'Période invalide. Format attendu: MM-YYYY ou MM/YYYY' });
        }
        const { mm, yyyy } = periode;

        const code   = sanitizeRef(req.body.code);
        const numero = sanitizeRef(req.body.numero);
        if (!code || !numero) {
            return res.status(400).json({ error: 'Code et numéro de référence requis (lettres/chiffres uniquement).' });
        }

        // Appliquer le filigrane (paramètres fixés dans watermark.js)
        const pdfBuffer = await applyWatermark(req.file.buffer);

        // Nom du fichier basé sur la référence saisie manuellement
        const fileName = `CI-ABJ-${mm}-${yyyy}-${code}-${numero}.pdf`;

        // Upload Vercel Blob
        const blob = await put(fileName, pdfBuffer, {
            access: 'public',
            contentType: 'application/pdf',
            addRandomSuffix: false,
        });

        // Lien court via notre proxy
        const host     = req.get('host');
        const blobName = blob.url.split('/').pop();
        const viewUrl  = `https://${host}/lib/pdfjs/web/viewer.html?file=/api/files/${blobName}`;

        // QR Code noir sur blanc
        const qrImage = await qrcode.toDataURL(viewUrl, {
            color: { dark: '#000000', light: '#ffffff' },
            width: 300,
            margin: 2,
        });

        res.json({ success: true, qrImage, viewerUrl: viewUrl });

    } catch (err) {
        console.error('Erreur upload:', err);
        res.status(500).json({ error: err.message });
    }
});

/* ── Proxy fichier blob ── */
app.get('/api/files/:filename', (req, res) => {
    res.redirect(`https://abeppcqgq6rabilm.public.blob.vercel-storage.com/${req.params.filename}`);
});

module.exports = app;