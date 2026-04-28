import { Uzivatel, Zakazka, Zprava, ProjektovySoubor, Faktura } from '../types/garden';
import { getToken, authHeaders } from '../hooks/useAuth';

const API_BASE = '/api';

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

// ── Pomocná funkce: fetch s auth hlavičkou ────────────────
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = {
    ...authHeaders(),
    ...(options.headers || {}),
  };
  return fetch(url, { ...options, headers });
}

// ── Uživatelé ─────────────────────────────────────────────
export async function getUzivatele(): Promise<Uzivatel[]> {
  const res = await authFetch(`${API_BASE}/uzivatele`);
  if (!res.ok) throw new Error('Nepodařilo se načíst uživatele');
  return res.json();
}

export async function upsertUzivatel(u: Uzivatel): Promise<void> {
  const res = await authFetch(`${API_BASE}/uzivatele`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(u),
  });
  if (!res.ok) throw new Error('Nepodařilo se uložit uživatele');
}

// ── Zakázky ───────────────────────────────────────────────
export async function getZakazky(): Promise<Zakazka[]> {
  const res = await authFetch(`${API_BASE}/zakazky`);
  if (!res.ok) throw new Error('Nepodařilo se načíst zakázky');
  return res.json();
}

export async function upsertZakazka(z: Zakazka): Promise<void> {
  const res = await authFetch(`${API_BASE}/zakazky`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(z),
  });
  if (!res.ok) throw new Error('Nepodařilo se uložit zakázku');
}

export async function deleteZakazka(id: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/zakazky/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Nepodařilo se smazat zakázku');
}

// ── Zprávy ────────────────────────────────────────────────
export async function getZpravy(zakazka_id: string): Promise<Zprava[]> {
  const res = await authFetch(`${API_BASE}/zpravy/${zakazka_id}`);
  if (!res.ok) throw new Error('Nepodařilo se načíst zprávy');
  return res.json();
}

export async function saveZprava(z: Zprava): Promise<void> {
  const res = await authFetch(`${API_BASE}/zpravy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(z),
  });
  if (!res.ok) throw new Error('Nepodařilo se uložit zprávu');
}

export async function patchZprava(id: string, data: { stitek?: string | null; pinned?: boolean; precteno?: boolean }): Promise<void> {
  const res = await authFetch(`${API_BASE}/zpravy/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Nepodařilo se upravit zprávu');
}

export async function deleteZprava(id: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/zpravy/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Nepodařilo se smazat zprávu');
}

// ── Faktury ───────────────────────────────────────────────
export async function getFaktury(params?: { zakazka_id?: string; stav?: string; typ?: string }): Promise<Faktura[]> {
  const query = new URLSearchParams();
  if (params?.zakazka_id) query.set('zakazka_id', params.zakazka_id);
  if (params?.stav) query.set('stav', params.stav);
  if (params?.typ) query.set('typ', params.typ);
  const qs = query.toString();
  const res = await authFetch(`${API_BASE}/faktury${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Nepodařilo se načíst faktury');
  return res.json();
}

export async function upsertFaktura(f: Partial<Faktura> & { zakazka_id: string; datum_splatnosti: string }): Promise<{ id: string; cislo: string }> {
  const res = await authFetch(`${API_BASE}/faktury`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(f),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Chyba při ukládání faktury' }));
    throw new Error(err.error);
  }
  return res.json();
}

export async function updateFaktura(id: string, data: Partial<Faktura>): Promise<void> {
  const res = await authFetch(`${API_BASE}/faktury/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Nepodařilo se upravit fakturu');
}

export async function deleteFaktura(id: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/faktury/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Nepodařilo se smazat fakturu');
}

// ── Historie položek (našeptávač) ─────────────────────────
export async function getHistory(type: 'kategorie' | 'nazev', q?: string): Promise<string[]> {
  const query = new URLSearchParams();
  if (q) query.set('q', q);
  const qs = query.toString();
  const res = await authFetch(`${API_BASE}/history/${type}${qs ? `?${qs}` : ''}`);
  if (!res.ok) return [];
  return res.json();
}

export async function saveHistory(type: 'kategorie' | 'nazev', value: string): Promise<void> {
  // Fire & forget — není kritické
  try {
    await authFetch(`${API_BASE}/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, value }),
    });
  } catch {
    // tiše přeskočit
  }
}

// ── Aliases pro kompatibilitu s existujícími komponentami ──
/** @deprecated Použij upsertFaktura */
export const vytvorFakturu = upsertFaktura;

/** @deprecated Použij updateFaktura */
export const patchFaktura = updateFaktura;

/** Vrátí URL pro stažení PDF faktury */
export function fakturaPdfUrl(id: string): string {
  const token = getToken();
  return `${API_BASE}/faktury/${id}/pdf${token ? `?token=${token}` : ''}`;
}

// ── Soubory ───────────────────────────────────────────────
export async function getSoubory(zakazka_id: string): Promise<ProjektovySoubor[]> {
  const res = await authFetch(`${API_BASE}/zakazky/${zakazka_id}/soubory`);
  if (!res.ok) return [];
  return res.json();
}

export async function uploadSoubory(zakazka_id: string, files: File | File[], stitek?: string): Promise<void> {
  const fd = new FormData();
  const pole = Array.isArray(files) ? files : [files];
  pole.forEach(f => fd.append('soubory', f));
  if (stitek) fd.append('stitek', stitek);
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // Necháme fetch bez Content-Type – FormData si ho nastaví samo
  await fetch(`${API_BASE}/zakazky/${zakazka_id}/soubory`, { method: 'POST', headers, body: fd });
}

export function getSouborUrl(id: string): string {
  const token = getToken();
  return `${API_BASE}/soubory/${id}${token ? `?token=${token}` : ''}`;
}

export async function deleteSoubor(id: string): Promise<void> {
  await authFetch(`${API_BASE}/soubory/${id}`, { method: 'DELETE' });
}

// ── Parametry ─────────────────────────────────────────────
export async function getParametry(typ?: string): Promise<any[]> {
  const url = typ ? `${API_BASE}/parametry/${typ}` : `${API_BASE}/parametry`;
  const res = await authFetch(url);
  if (!res.ok) return [];
  return res.json();
}

export async function upsertParametr(id: string, typ: string, data: Record<string, any>): Promise<void> {
  await authFetch(`${API_BASE}/parametry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, typ, ...data }),
  });
}

export async function deleteParametr(id: string): Promise<void> {
  await authFetch(`${API_BASE}/parametry/${id}`, { method: 'DELETE' });
}

// ── Číselná řada ──────────────────────────────────────────
export async function getCiselnaRada(): Promise<{ rok: number; posledni_cislo: number }[]> {
  const res = await authFetch(`${API_BASE}/ciselna-rada`);
  if (!res.ok) return [];
  return res.json();
}

export async function updateCiselnaRada(rok: number, posledni_cislo: number): Promise<void> {
  await authFetch(`${API_BASE}/ciselna-rada/${rok}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ posledni_cislo }),
  });
}

export async function deleteCiselnaRada(rok: number): Promise<void> {
  await authFetch(`${API_BASE}/ciselna-rada/${rok}`, { method: 'DELETE' });
}