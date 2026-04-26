/**
 * PDF generátor faktury – pdfmake + Roboto fonty (čeština)
 * Kompaktní layout, barvy sjednoceny s webem: primární #166534
 */
import PdfPrinter from 'pdfmake';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Fonty ─────────────────────────────────────────────────
const fontDir = join(__dirname, 'fonts');
const fontPaths = {
  Roboto: {
    normal:      join(fontDir, 'Roboto-Regular.ttf'),
    bold:        join(fontDir, 'Roboto-Medium.ttf'),
    italics:     join(fontDir, 'Roboto-Italic.ttf'),
    bolditalics: join(fontDir, 'Roboto-MediumItalic.ttf'),
  }
};

const missingFonts = Object.values(fontPaths.Roboto).filter(p => !existsSync(p));
if (missingFonts.length) {
  console.error('⚠️  Chybí fonty pro PDF generátor:', missingFonts);
}

// ── Logo ──────────────────────────────────────────────────
const logoPath = join(__dirname, 'assets', 'logo.png');
let logoData = null;
if (existsSync(logoPath)) {
  const buf = readFileSync(logoPath);
  logoData = `data:image/png;base64,${buf.toString('base64')}`;
}

// ── Barvy ─────────────────────────────────────────────────
const ZELENA   = '#166534';
const ZELENA_L = '#14532d';
const PODKLAD  = '#f0fdf4';
const PODKLAD2 = '#e8f5e9';
const SEDA     = '#555';
const SEDA_L   = '#999';

const printer = new PdfPrinter(fontPaths);

// ── Formátování ───────────────────────────────────────────
function formatCena(amount) {
  return new Intl.NumberFormat('cs-CZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ' Kč';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return dateStr.slice(0, 10);
}

const TYP_LABEL = { zalohova: 'Zálohová faktura', konecna: 'Faktura', dobropis: 'Dobropis' };
const STAV_LABEL = { vystavena: 'Vystavena', odeslana: 'Odeslána', zaplacena: 'Zaplacena', stornovana: 'Stornována' };

// ── Adresní blok ──────────────────────────────────────────
function addrBlock(osoba, label) {
  const lines = [];
  if (osoba.jmeno)   lines.push({ text: osoba.jmeno, bold: true, fontSize: 9 });
  if (osoba.adresa)  lines.push({ text: osoba.adresa, fontSize: 8 });
  if (osoba.ico)     lines.push({ text: `IČO: ${osoba.ico}`, fontSize: 8 });
  if (osoba.dic)     lines.push({ text: `DIČ: ${osoba.dic}`, fontSize: 8 });
  if (osoba.telefon) lines.push({ text: `Tel: ${osoba.telefon}`, fontSize: 8 });
  if (osoba.email)   lines.push({ text: `E-mail: ${osoba.email}`, fontSize: 8 });

  return {
    stack: [
      { text: label, style: 'sectionTitle' },
      ...lines,
    ],
  };
}

// ── Document Definition ───────────────────────────────────
function buildDocDef(faktura) {
  const dodavatel = faktura.dodavatel || {};
  const odberatel = faktura.odberatel || {};
  const polozky   = faktura.polozky || [];

  // ── Hlavička: logo + název na jednom řádku vlevo, typ vpravo ──
  const headerLeftStack = [];
  if (logoData) {
    headerLeftStack.push({ image: logoData, width: 80, margin: [0, 0, 0, 2] });
  }
  headerLeftStack.push({ text: 'Nela Zahradnice · Zahradnické služby', fontSize: 9, color: SEDA, italics: true });

  // ── Tabulka položek – seskupené podle kategorie ────────
  const kategorieOrder = [];
  const kategorieMap = {};
  for (const p of polozky) {
    const kat = p.kategorie || 'Bez kategorie';
    if (!kategorieMap[kat]) {
      kategorieOrder.push(kat);
      kategorieMap[kat] = [];
    }
    kategorieMap[kat].push(p);
  }

  const tableBody = [
    [
      { text: 'Kategorie', style: 'th' },
      { text: 'Položka', style: 'th' },
      { text: 'Množství', style: 'th', alignment: 'center' },
      { text: 'Celkem', style: 'th', alignment: 'right' },
    ],
  ];

  for (const kat of kategorieOrder) {
    // Řádek kategorie (sloučený přes 4 sloupce, zelené pozadí)
    tableBody.push([
      { text: kat, colSpan: 4, bold: true, fontSize: 9, color: ZELENA, margin: [2, 1, 2, 1] },
      {}, {}, {},
    ]);
    // Položky v kategorii
    for (const p of kategorieMap[kat]) {
      tableBody.push([
        { text: '', fontSize: 9 },
        { text: p.nazev || '', fontSize: 9 },
        { text: `${p.mnozstvi ?? ''} ${p.jednotka || ''}`, alignment: 'center', fontSize: 9 },
        { text: formatCena(p.celkova_cena), alignment: 'right', fontSize: 9 },
      ]);
    }
  }

  // Celkem řádek
  tableBody.push([
    { text: '', colSpan: 3 },
    {}, {},
    { text: formatCena(faktura.castka_celkem), bold: true, alignment: 'right', fontSize: 10 },
  ]);

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [40, 35, 40, 50],

    content: [
      // ── Hlavička – kompaktní ──────────────────────────
      {
        columns: [
          { width: '*', stack: headerLeftStack },
          {
            width: 'auto',
            stack: [
              { text: TYP_LABEL[faktura.typ] || 'Faktura', style: 'title', alignment: 'right' },
              { text: `č. ${faktura.cislo}`, style: 'cislo', alignment: 'right' },
            ],
          },
        ],
        margin: [0, 0, 0, 6],
      },

      // ── Oddělovač ────────────────────────────────────
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: ZELENA }],
        margin: [0, 0, 0, 10],
      },

      // ── Dodavatel / Odběratel ────────────────────────
      {
        columns: [
          { width: '*', ...addrBlock(dodavatel, 'Dodavatel') },
          { width: 20, text: '' },
          { width: '*', ...addrBlock(odberatel, 'Odběratel') },
        ],
        margin: [0, 0, 0, 10],
      },

      // ── Detaily faktury ──────────────────────────────
      {
        table: {
          widths: [110, '*'],
          body: [
            [{ text: 'Datum vystavení:', style: 'label' }, { text: formatDate(faktura.datum_vystaveni), fontSize: 8 }],
            [{ text: 'Datum splatnosti:', style: 'label' }, { text: formatDate(faktura.datum_splatnosti), fontSize: 8 }],
            ...(faktura.datum_zaplaceni ? [[{ text: 'Datum zaplacení:', style: 'label' }, { text: formatDate(faktura.datum_zaplaceni), fontSize: 8 }]] : []),
            [{ text: 'Variabilní symbol:', style: 'label' }, { text: faktura.variabilni_symbol || '—', fontSize: 8 }],
            [{ text: 'Stav:', style: 'label' }, { text: STAV_LABEL[faktura.stav] || faktura.stav, fontSize: 8 }],
          ],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 10],
      },

      // ── Tabulka položek ──────────────────────────────
      {
        table: {
          headerRows: 1,
          widths: [75, '*', 55, 75],
          body: tableBody,
        },
        layout: {
          hLineWidth: (i, node) => {
            if (i === 0 || i === 1) return 1;
            if (i === node.table.body.length) return 1;
            return 0.3;
          },
          vLineWidth: () => 0,
          hLineColor: (i, node) => {
            if (i === 0 || i === 1) return ZELENA;
            if (i === node.table.body.length) return ZELENA;
            return '#c8e6c9';
          },
          fillColor: (i, node) => {
            if (i === 0) return ZELENA;
            // Kategorie řádky — světle zelené pozadí
            const row = node.table.body[i];
            if (row && row[0] && row[0].colSpan === 4) return PODKLAD2;
            if (i % 2 === 1) return PODKLAD;
            return null;
          },
          paddingLeft:   () => 5,
          paddingRight:  () => 5,
          paddingTop:    () => 3,
          paddingBottom: () => 3,
        },
        margin: [0, 0, 0, 10],
      },

      // ── Celková částka ───────────────────────────────
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 'auto',
            table: {
              widths: [100, 95],
              body: [
                [
                  { text: 'Celková částka:', bold: true, fontSize: 11, color: ZELENA_L },
                  { text: formatCena(faktura.castka_celkem), bold: true, fontSize: 11, alignment: 'right', color: ZELENA_L },
                ],
              ],
            },
            layout: {
              hLineWidth: () => 1.5,
              vLineWidth: () => 0,
              hLineColor: () => ZELENA,
              fillColor: () => PODKLAD,
              paddingLeft: () => 5,
              paddingRight: () => 5,
              paddingTop: () => 4,
              paddingBottom: () => 4,
            },
          },
        ],
        margin: [0, 0, 0, 10],
      },

      // ── Platební údaje ───────────────────────────────
      {
        stack: [
          { text: 'Platební údaje', style: 'sectionTitle' },
          ...(dodavatel.iban ? [{ text: `IBAN: ${dodavatel.iban}`, fontSize: 8 }] : []),
          ...(dodavatel.ucet ? [{ text: `Účet: ${dodavatel.ucet}`, fontSize: 8 }] : []),
          { text: `Variabilní symbol: ${faktura.variabilni_symbol || faktura.cislo}`, fontSize: 8 },
        ],
        margin: [0, 0, 0, 8],
      },

      // ── Poznámka ─────────────────────────────────────
      ...(faktura.poznamka ? [
        { text: 'Poznámka', style: 'sectionTitle', margin: [0, 4, 0, 3] },
        { text: faktura.poznamka, fontSize: 8, color: SEDA },
      ] : []),

      // ── Poděkování ───────────────────────────────────
      {
        text: 'Děkujeme za vaši platbu.',
        fontSize: 8,
        italics: true,
        color: SEDA,
        margin: [0, 15, 0, 0],
      },
    ],

    // ── Patička ──────────────────────────────────────────
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: 'Nela Zahradnice · Zahradnické služby — Šemanovice 46, Kokořín 277 23', fontSize: 7, color: SEDA_L },
        { text: `Strana ${currentPage} / ${pageCount}`, fontSize: 7, color: SEDA_L, alignment: 'right' },
      ],
      margin: [40, 0, 40, 0],
    }),

    // ── Styly ────────────────────────────────────────────
    styles: {
      title:       { fontSize: 16, bold: true, color: ZELENA, lineHeight: 1.1 },
      cislo:       { fontSize: 11, color: SEDA, margin: [0, 1, 0, 0], lineHeight: 1.1 },
      sectionTitle:{ fontSize: 9, bold: true, color: ZELENA, margin: [0, 0, 0, 3] },
      label:       { fontSize: 8, bold: true, color: SEDA },
      th:          { fontSize: 8, bold: true, color: '#ffffff' },
    },

    defaultStyle: {
      font: 'Roboto',
      fontSize: 9,
      lineHeight: 1.2,
    },
  };

  return docDefinition;
}

// ── Veřejné API ───────────────────────────────────────────
export function generateFakturaPdf(faktura) {
  const docDefinition = buildDocDef(faktura);
  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  return pdfDoc;
}
