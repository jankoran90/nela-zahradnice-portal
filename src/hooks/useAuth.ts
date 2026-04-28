import { useState, useEffect } from 'react';
import { Uzivatel } from '../types/garden';

const TOKEN_KEY = 'nela_token';
const USER_KEY = 'nela_user';

/**
 * Uloží token a user data do localStorage.
 * Token se posílá v Authorization headeru na každý request.
 */
function saveSession(token: string, uzivatel: Uzivatel) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(uzivatel));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/** Vytáhne token z localStorage */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** Připojí Authorization header k fetch options */
export function authHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) return {};
  return { 'Authorization': `Bearer ${token}` };
}

export function useAuth() {
  const [uzivatel, setUzivatel] = useState<Uzivatel | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    // Token musí existovat, jinak user není platný
    if (!localStorage.getItem(TOKEN_KEY)) return null;
    return raw ? JSON.parse(raw) : null;
  });

  /**
   * Přihlášení majitelky – pošle POST /api/auth/login, backend ověří bcrypt
   */
  async function prihlasit(email: string, heslo: string): Promise<boolean> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, heslo }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      saveSession(data.token, data.uzivatel);
      setUzivatel(data.uzivatel);
      return true;
    } catch {
      return false;
    }
  }

  function odhlasit(): void {
    clearSession();
    setUzivatel(null);
  }

  /**
   * Aktivace zákaznického účtu přes token z URL.
   * Zákazník si nastaví heslo, backend vrátí JWT.
   */
  async function aktivovatTokenem(token: string, heslo: string): Promise<boolean> {
    try {
      const res = await fetch('/api/auth/aktivace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, heslo }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      saveSession(data.token, data.uzivatel);
      setUzivatel(data.uzivatel);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Vytvoření zákazníka (majitelka přidá nového).
   * Backend vrátí JWT – ale zůstaneme přihlášeni jako majitelka,
   * takže token neukládáme. Pouze vytvoříme záznam.
   */
  async function vytvorZakaznika(email: string, jmeno: string): Promise<void> {
    const token = getToken();
    if (!token) return;
    const res = await fetch('/api/uzivatele', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 9),
        email,
        jmeno,
        role: 'zakaznik',
        token: Date.now().toString(36) + Math.random().toString(36).slice(2, 9),
        token_pouzit: false,
        datum_vytvoreni: new Date().toISOString(),
      }),
    });
    if (!res.ok) throw new Error('Nepodařilo se vytvořit zákazníka');
  }

  return { uzivatel, prihlasit, odhlasit, aktivovatTokenem, vytvorZakaznika };
}