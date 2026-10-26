# 🍽️ DATAFOOD

**Il tuo ristorante sotto controllo. Ogni giorno.**

Software professionale di **controllo di gestione per la ristorazione**. Trasforma i dati del ristorante in decisioni concrete: costi reali, margini, liquidità e produttività in un'unica piattaforma.

> DATAFOOD è progettato per ristoratori e consulenti. Multi-cliente, on-premise, con AI locale. I dati restano sul tuo computer.

---

## ✨ Funzionalità principali

### 📊 Analisi e Controllo
| Modulo | Descrizione |
|--------|-------------|
| **Dashboard** | Alert prioritari, KPI, cash flow, scadenziario, azioni rapide |
| **Cost Control** | Indicatori operativi, costo pasto, produttività, conto economico |
| **Bilancio** | Conto economico riclassificabile (3 viste) + stato patrimoniale |
| **KPI Report** | 33 KPI con formule del registro ufficiale |
| **Budget** | Assunzioni, ricavi/costi, CE budget, scenari, vs actual |

### 🍽️ Operations
| Modulo | Descrizione |
|--------|-------------|
| **Menu Engineering** | Matrice Kasavana-Smith (Stars, Puzzles, Plow Horses, Dogs) |
| **Food Cost** | Costi ricette, margini per piatto, CRUD completo |
| **Magazzino** | Valore stock, scorte per categoria, movimenti, inventario |
| **Ordini** | Creazione, invio email, ricezione → aggiorna magazzino e fatture |

### 💰 Vendite e Acquisti
| Modulo | Descrizione |
|--------|-------------|
| **Vendite** | Analisi Q1, andamento giornaliero/settimanale/mensile |
| **Corrispettivi** | Import CSV/PDF/estratto conto, categorizzazione automatica |
| **Fatture Emesse** | Import XML, gestione B2B (catering, eventi) |
| **Accounting** | Fatture ricevute, staging, classificazione costi (17 macro aree) |
| **Fornitori** | CRUD completo, monitoraggio spese |

### 💵 Finanza e Risorse
| Modulo | Descrizione |
|--------|-------------|
| **Cash Flow** | Forecast 13 settimane, runway, scadenziario, F24, alert |
| **Personale** | Costo azienda reale (INPS, TFR, ratei, ferie/permessi) |
| **Ammortamenti** | Coefficienti D.M. 1988, piani automatici |

### 🧠 Intelligenza
- **KPI Registry** — 33 formule standard di settore centralizzate
- **Cost Topology** — 17 macro aree, 200+ voci di costo
- **Classificatore automatico** fatture
- **AI locale (Ollama)** — dati che restano sul tuo computer

---

## 🏗️ Stack Tecnologico

- **Framework**: Next.js 14 (App Router)
- **Linguaggio**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: SQLite + Prisma ORM
- **Grafici**: Recharts
- **Email**: Nodemailer (SMTP)
- **AI**: Ollama (locale)

---

## 🚀 Installazione

### Requisiti
- Node.js 18+ (consigliato: LTS 24)
- PostgreSQL 14+ in locale (oppure un database Neon)
- Git

### Setup

```bash
# 1. Clona la repository
git clone https://github.com/angelofinocchiaro88/datafood.git
cd datafood

# 2. Installa le dipendenze
npm install

# 3. Prepara il database
npx prisma db push
npx prisma generate

# 4. (Opzionale) Carica dati demo
node scripts/seed-cashflow.js
node scripts/seed-cashflow-demo.js
node scripts/seed-orders.js

# 5. Avvia in sviluppo
npm run dev
```

Apri **http://localhost:3000**

---

## 🖥️ Avvio rapido in locale (PostgreSQL + dati demo)

Il progetto usa **Prisma con provider `postgresql`**. Per una macchina locale
senza account Neon, basta un PostgreSQL installato in locale:

```bash
# 1. Avvia il database (su Windows: .\avvia-ristogest.bat avvia anche Postgres)
pg_ctl -D <DATADIR> -l <LOGFILE> -o "-p 5432 -h 127.0.0.1" start

# 2. Crea il database e configura la connessione
createdb -h 127.0.0.1 -U postgres datafood
# .env:
#   DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/datafood?schema=public"
#   DATAFOOD_SESSION_SECRET="<stringa casuale di almeno 32 caratteri>"

# 3. Schema + dati demo completi (ristorante, utente, vendite, fatture, personale, cash flow)
npx prisma db push
npm run seed

# 4. Avvia l'app
npm run dev
```

### Credenziali demo

| Campo | Valore |
|-------|--------|
| Email | `admin@datafood.it` |
| Password | `datafood2026!` |
| Ristorante | Trattoria La Lanterna |

Il seed (`prisma/seed-demo.mjs`) è **ri-eseguibile**: usa `upsert` su cliente e
utente, quindi ricaricarlo non invalida le sessioni aperte.

### Script di avvio

`avvia-ristogest.bat` avvia PostgreSQL (se non è già attivo) e poi il server
Next.js su <http://127.0.0.1:3000>.

> **Nota — DLL e PATH**: all'avvio di PostgreSQL il launcher usa un PATH
> sanificato. Le DLL di PostgreSQL (`libcrypto-3-x64`, `libintl-9`,
> `libwinpthread-1`) hanno gli stessi nomi di quelle MinGW di Git: se il PATH
> contiene la cartella `git\ucrt64\bin`, i backend caricano le versioni
> sbagliate e muoiono con `0xC0000142` (Prisma `P1001`, HTTP 500 casuali).

### Avvio in background (senza console)

```powershell
# PostgreSQL (staccato, con PATH pulito)
$env:PATH = "$env:LOCALAPPDATA\Programs\PostgreSQL\pgsql\bin;C:\Windows\System32;C:\Windows"
Start-Process "$env:LOCALAPPDATA\Programs\PostgreSQL\pgsql\bin\postgres.exe" `
  -ArgumentList "-D","$env:LOCALAPPDATA\PostgreSQL\16\data","-p","5432","-h","127.0.0.1" `
  -WorkingDirectory "$env:LOCALAPPDATA\Programs\PostgreSQL\pgsql\bin" `
  -RedirectStandardOutput "$env:LOCALAPPDATA\datafood-logs\postgres.log" `
  -RedirectStandardError  "$env:LOCALAPPDATA\datafood-logs\postgres.log.err"

# Next.js in dev mode (staccato)
Start-Process "$env:LOCALAPPDATA\Programs\nodejs\node.exe" `
  -ArgumentList "node_modules\next\dist\bin\next","dev","--port","3000","--hostname","127.0.0.1" `
  -WorkingDirectory "C:\Users\Angelo(Farco)\Documents\GitHub\datafood" `
  -RedirectStandardOutput "$env:LOCALAPPDATA\datafood-logs\next-dev.log" `
  -RedirectStandardError  "$env:LOCALAPPDATA\datafood-logs\next-dev.log.err"
```

Log in `%LOCALAPPDATA%\datafood-logs`. Per fermarli: `Get-Process postgres,node | Stop-Process`.

---

## 📄 Licenza

Progetto privato — tutti i diritti riservati. Per uso interno e test.

---

## 📧 Contatti

Progetto sviluppato con opencode. Per informazioni: **angelofinocchiaro88**