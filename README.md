# nela-zahradnice-portal

CRM portál pro zahradnickou firmu. React + Express + SQLite.

## Stack
- **Frontend:** React 18, TypeScript, Vite, Tailwind
- **Backend:** Express.js, SQLite3, Multer, PDFKit
- **Integrace:** Google Drive API (soubory zakázek)

## Lokální vývoj (Zenbook)

### Požadavky
- Docker (pro backend)
- Node.js 20+ (pro frontend Vite)

### Start

```bash
# 1. Backend (Docker)
docker compose up -d backend
docker logs nelazahradnice-portal-backend --tail 5

# 2. Frontend (Vite)
npm install
npm run dev
# → http://localhost:5173
```

### Prostředí
```bash
cp backend/.env.example backend/.env
# Doplň hodnoty
```

## Deploy na produkci

```bash
bash deploy.sh
# → git push + rebuild na Hetzneru
# → portal.nelazahradnice.cz
```

## Struktura
```
├── src/                  # React frontend (TypeScript)
├── backend/
│   ├── server.js         # Express API
│   ├── pdf-generator.js  # Faktura PDF
│   └── services/
│       └── googleDrive.js
├── Dockerfile            # Multi-stage: frontend build + backend runtime
├── docker-compose.yml    # Lokální vývoj
├── docker-compose.prod.yml # Produkce (Hetzner)
└── deploy.sh             # Deploy skript
```
