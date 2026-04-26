import { useState, useEffect } from 'react';
import { Uzivatel } from '../types/garden';
import { getUzivatele, upsertUzivatel, generateId } from '../services/database';

const SESSION_KEY = 'nela_session';

export function useAuth() {
  const [uzivatel, setUzivatel] = useState<Uzivatel | null>(() => {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  });

  async function prihlasit(email: string, heslo: string): Promise<boolean> {
    const uzivatele = await getUzivatele();
    const nalezeny = uzivatele.find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.heslo_hash === heslo
    );
    if (!nalezeny) return false;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(nalezeny));
    setUzivatel(nalezeny);
    return true;
  }

  function odhlasit(): void {
    sessionStorage.removeItem(SESSION_KEY);
    setUzivatel(null);
  }

  async function aktivovatTokenem(token: string, heslo: string): Promise<boolean> {
    const uzivatele = await getUzivatele();
    const u = uzivatele.find(x => x.token === token && !x.token_pouzit);
    if (!u) return false;
    const updated: Uzivatel = { ...u, heslo_hash: heslo, token_pouzit: true };
    await upsertUzivatel(updated);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    setUzivatel(updated);
    return true;
  }

  async function vytvorZakaznika(email: string, jmeno: string): Promise<void> {
    const uzivatele = await getUzivatele();
    const existuje = uzivatele.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existuje) return;
    const novy: Uzivatel = {
      id: generateId(),
      email,
      jmeno,
      role: 'zakaznik',
      heslo_hash: '',
      token: generateId(),
      token_pouzit: false,
      datum_vytvoreni: new Date().toISOString(),
    };
    await upsertUzivatel(novy);
  }

  return { uzivatel, prihlasit, odhlasit, aktivovatTokenem, vytvorZakaznika };
}
