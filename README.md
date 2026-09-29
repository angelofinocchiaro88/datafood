# RistoGest

Software completo di controllo di gestione per ristorante.

## Funzionalità

- **Dashboard**: KPI in tempo reale, grafici fatturato e costi
- **Gestione Menu**: CRUD piatti con calcolo automatico margini
- **Gestione Magazzino**: Inventario ingredienti, alert scorte
- **Gestione Fornitori**: Anagrafica fornitori e ordini
- **Food Cost**: Analisi marginalità per piatto
- **Reportistica**: Report mensili e trend

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Prisma + SQLite
- Recharts

## Setup

```bash
# Installa dipendenze
npm install

# Genera Prisma client
npm run db:generate

# Inizializza database
npm run db:push

# Seed dati di esempio
npm run db:seed

# Avvia sviluppo
npm run dev
```

## Credenziali

Accesso libero (MVP senza auth).
