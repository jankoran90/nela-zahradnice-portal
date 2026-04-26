import { Zakazka, PolozkaCeny } from '../types/garden';

// @ts-ignore – html2pdf.js nemá typy
import html2pdf from 'html2pdf.js';

const STAV_LABEL: Record<string, string> = {
  poptavka: 'Nabídka', naceneno: 'Naceněno', schvaleno: 'Schváleno',
  rozpracovano: 'Rozpracováno', dokonceno: 'Dokončeno', stornovano: 'Stornováno',
};

function formatCena(n: number): string {
  return n.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('cs-CZ');
}

function buildHtml(z: Zakazka): string {
  const polozky = z.polozky ?? [];
  const celkem = polozky.reduce((s, p) => s + p.mnozstvi * p.cena_za_jednotku, 0);

  // Seskupení položek dle kategorie
  const skupiny = new Map<string, PolozkaCeny[]>();
  for (const p of polozky) {
    const kat = p.kategorie || 'Nezařazeno';
    if (!skupiny.has(kat)) skupiny.set(kat, []);
    skupiny.get(kat)!.push(p);
  }

  let radky = '';
  let i = 1;
  for (const [kat, items] of skupiny) {
    radky += `<tr class="kat-header"><td colspan="5"><strong>${kat}</strong></td></tr>`;
    for (const p of items) {
      const suma = p.mnozstvi * p.cena_za_jednotku;
      radky += `<tr>
        <td class="center">${i++}</td>
        <td>${p.nazev}</td>
        <td class="center">${p.mnozstvi} ${p.jednotka}</td>
        <td class="right">${formatCena(p.cena_za_jednotku)} Kč</td>
        <td class="right"><strong>${formatCena(suma)} Kč</strong></td>
      </tr>`;
    }
  }

  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="utf-8">
<style>
  @page { margin: 0; }
  body { margin: 0; padding: 0; }
  .page-wrapper { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; font-size: 11pt; line-height: 1.5; padding: 5% 6%; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #166534; padding-bottom: 12px; margin-bottom: 20px; }
  .logo { display: flex; align-items: center; gap: 10px; }
  .logo img { height: 50px; width: auto; }
  .logo-text { font-size: 20pt; font-weight: 700; color: #166534; }
  .logo-text span { font-size: 12pt; color: #555; font-weight: 400; display: block; margin-top: 2px; }
  .meta { text-align: right; font-size: 9pt; color: #666; }
  .meta strong { color: #1a1a1a; font-size: 10pt; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  .info-box { background: #f5f8f5; border-radius: 6px; padding: 10px 14px; }
  .info-box h4 { margin: 0 0 6px 0; font-size: 9pt; text-transform: uppercase; color: #888; letter-spacing: 0.5px; }
  .info-box p { margin: 0; font-size: 10pt; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  thead th { background: #166534; color: white; padding: 8px 10px; text-align: left; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.3px; }
  thead th:first-child { border-radius: 6px 0 0 0; }
  thead th:last-child { border-radius: 0 6px 0 0; }
  td { padding: 7px 10px; border-bottom: 1px solid #d4ddd4; font-size: 10pt; }
  tr.kat-header td { background: #e8f5e9; color: #166534; padding: 6px 10px; border-bottom: 1px solid #a5d6a7; }
  .center { text-align: center; }
  .right { text-align: right; }
  tfoot td { border-bottom: none; padding-top: 10px; }
  .total-row { background: #e8f5e9; }
  .total-row td { font-size: 12pt; font-weight: 700; padding: 10px; border-top: 2px solid #166534; }
  .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 8pt; color: #999; text-align: center; }
  .poznamka { margin-top: 16px; background: #fffbeb; border-left: 3px solid #f59e0b; padding: 10px 14px; border-radius: 0 6px 6px 0; font-size: 10pt; }
</style>
</head>
<body>

<div class="page-wrapper">

<div class="header">
  <div class="logo">
    <img src="/assets/logo.png" onerror="this.style.display='none'" alt="Logo">
    <div class="logo-text">🌿 Nela Zahradnice<span>Zahradnické služby</span></div>
  </div>
  <div class="meta">
    <strong>${STAV_LABEL[z.stav] || z.stav}</strong><br>
    Zakázka č. ${z.cislo}<br>
    Datum: ${formatDate(z.datum_vytvoreni)}
  </div>
</div>

<div class="info-grid">
  <div class="info-box">
    <h4>Zákazník</h4>
    <p><strong>${z.zakaznik_jmeno}</strong></p>
    ${z.zakaznik_email ? `<p>${z.zakaznik_email}</p>` : ''}
  </div>
  <div class="info-box">
    <h4>Realizace</h4>
    <p><strong>${z.nazev}</strong></p>
    ${z.adresa ? `<p>📍 ${z.adresa}</p>` : ''}
  </div>
</div>

<table>
  <thead>
    <tr>
      <th style="width:30px">#</th>
      <th>Položka</th>
      <th style="width:90px">Množství</th>
      <th style="width:100px">Cena/jedn.</th>
      <th style="width:110px">Celkem</th>
    </tr>
  </thead>
  <tbody>
    ${radky || '<tr><td colspan="5" class="center" style="color:#999;padding:20px">Žádné položky</td></tr>'}
  </tbody>
  <tfoot>
    <tr class="total-row">
      <td colspan="4" class="right">Celková cena</td>
      <td class="right">${formatCena(celkem)} Kč</td>
    </tr>
  </tfoot>
</table>

${z.poznamka_interna ? `<div class="poznamka"><strong>Poznámka:</strong> ${z.poznamka_interna}</div>` : ''}

<div class="footer">
  Dokument vygenerován ${new Date().toLocaleString('cs-CZ')} · Nela Zahradnice
</div>

</div>

</body>
</html>`;
}

export function exportZakazkaPdf(z: Zakazka): void {
  const html = buildHtml(z);
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);

  const wrapper = container.querySelector('.page-wrapper') as HTMLElement;

  const options = {
    margin: 0,
    filename: `zakazka-${z.cislo}-${z.nazev.replace(/\s+/g, '-').toLowerCase()}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
  };

  html2pdf().set(options).from(wrapper).save().then(() => {
    document.body.removeChild(container);
  });
}
