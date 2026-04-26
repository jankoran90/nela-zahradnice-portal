import { Uzivatel, Zakazka, Zprava, ProjektovySoubor, Faktura } from '../types/garden';

const API_BASE = '/api';

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

// ── Uživatelé ─────────────────────────────────────────────
export async function getUzivatele(): Promise<Uzivatel[]> {
  const res = await fetch(`${API_BASE}/uzivatele`);
  return res.json();
}

export async function upsertUzivatel(u: Uzivatel): Promise<void> {
  await fetch(`${API_BASE}/uzivatele`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(u)
  });
}

// ── Zakázky ───────────────────────────────────────────────
export async function getZakazky(): Promise<Zakazka[]> {
  const res = await fetch(`${API_BASE}/zakazky`);
  return res.json();
}

export async function upsertZakazka(z: Zakazka): Promise<void> {
  await fetch(`${API_BASE}/zakazky`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(z)
  });
}

export async function deleteZakazka(id: string): Promise<void> {
  await fetch(`${API_BASE}/zakazky/${id}`, { method: 'DELETE' });
}

// ── Zprávy ────────────────────────────────────────────────
export async function getZpravy(zakazka_id: string): Promise<Zprava[]> {
  const res = await fetch(`${API_BASE}/zpravy/${zakazka_id}`);
  return res.json();
}

export async function saveZprava(z: Zprava): Promise<void> {
  await fetch(`${API_BASE}/zpravy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(z)
  });
}

export async function patchZprava(id: string, data: { stitek?: string | null; pinned?: boolean; precteno?: boolean }): Promise<void> {
  await fetch(`${API_BASE}/zpravy/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

export async function deleteZprava(id: string): Promise<void> {
  await fetch(`${API_BASE}/zpravy/${id}`, { method: 'DELETE' });
}

// ── Faktury ───────────────────────────────────────────────
export async function getFaktury(params?: { zakazka_id?: string; stav?: string; typ?: string }): Promise<Faktura[]> {
  const query = new URLSearchParams();
  if (params?.zakazka_id) query.set('zakazka_id', params.zakazka_id);
  if (params?.stav) query.set('stav', params.stav);
  if (params?.typ) query.set('typ', params.typ);
  const qs = query.toString();
  const res = await fetch(`${API_BASE}/faktury${qs ? '?' + qs : ''}`);
  return res.json();
}

export async function getFaktura(id: string): Promise<Faktura> {
  const res = await fetch(`${API_BASE}/faktury/${id}`);
  return res.json();
}

export async function vytvorFakturu(data: Partial<Faktura> & { zakazka_id: string; datum_splatnosti: string }): Promise<{ id: string; cislo: string }> {
  const res = await fetch(`${API_BASE}/faktury`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function patchFaktura(id: string, data: Record<string, unknown>): Promise<void> {
  await fetch(`${API_BASE}/faktury/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

export function fakturaPdfUrl(id: string): string {
  return `${API_BASE}/faktury/${id}/pdf`;
}

export async function deleteFaktura(id: string): Promise<void> {
  await fetch(`${API_BASE}/faktury/${id}`, { method: 'DELETE' });
}

// ── Projektové soubory ────────────────────────────────────
export async function getSoubory(zakazka_id: string): Promise<ProjektovySoubor[]> {
  const res = await fetch(`${API_BASE}/zakazky/${zakazka_id}/soubory`);
  return res.json();
}

export async function uploadSoubor(zakazka_id: string, file: File, stitek?: string): Promise<ProjektovySoubor> {
  const form = new FormData();
  form.append('soubor', file);
  if (stitek) form.append('stitek', stitek);
  const res = await fetch(`${API_BASE}/zakazky/${zakazka_id}/soubory`, { method: 'POST', body: form });
  return res.json();
}

export function souborUrl(id: string): string {
  return `${API_BASE}/soubory/${id}`;
}

export async function deleteSoubor(id: string): Promise<void> {
  await fetch(`${API_BASE}/soubory/${id}`, { method: 'DELETE' });
}
