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
- Node.js 18+
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

## 📄 Licenza

Progetto privato — tutti i diritti riservati. Per uso interno e test.

---

## 📧 Contatti

Progetto sviluppato con opencode. Per informazioni: **angelofinocchiaro88**