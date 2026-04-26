import { useState } from 'react';

interface Props {
  onPrihlaseni: (email: string, heslo: string) => Promise<boolean>;
}

export function Login({ onPrihlaseni }: Props) {
  const [email, setEmail] = useState('');
  const [heslo, setHeslo] = useState('');
  const [chyba, setChyba] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setChyba('');
    const ok = await onPrihlaseni(email, heslo);
    if (!ok) { setChyba('Nesprávný e-mail nebo heslo.'); return; }
  }

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🌿</div>
          <h1 className="text-2xl font-bold text-green-800">Nela Zahradnice</h1>
          <p className="text-gray-500 text-sm mt-1">Správa zakázek</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Heslo</label>
            <input
              type="password"
              value={heslo}
              onChange={e => setHeslo(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          {chyba && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{chyba}</p>}
          <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-lg transition-colors">
            Přihlásit se
          </button>
        </form>
      </div>
    </div>
  );
}
