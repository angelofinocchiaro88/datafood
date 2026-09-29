# RistoGest - Software Controllo di Gestione Ristorante

## 1. Concept & Vision

**RistoGest** è un software di controllo di gestione per ristoranti che offre una visione chiara e in tempo reale dei costi, margini e performance. L'interfaccia è pulita, professionale ma accogliente - come un buon ristorante italiano. L'obiettivo è trasformare dati complessi in insight azionabili per proprietari e manager.

### Nuove Funzionalità
- **Integrazione POS**: Collegamento ai sistemi di cassa per acquisire vendite in tempo reale
- **Fatture Elettroniche SDI**: Ricezione automatica e parsing delle fatture elettroniche dalla Agenzia delle Entrate
- **Analisi Food Cost Real**: Calcolo margini basato su dati reali di acquisto e vendita

## 2. Design Language

### Color Palette
- **Primary**: `#1E3A5F` (Blu profondo - professionalità)
- **Secondary**: `#2D5016` (Verde oliva - freschezza ingredienti)
- **Accent**: `#D4A574` (Terracotta - calore italiano)
- **Success**: `#22C55E` (Verde - margini positivi)
- **Warning**: `#F59E0B` (Arancione - alert)
- **Danger**: `#EF4444` (Rosso - costi eccessivi)

### Stack Tecnologico
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: SQLite (via Prisma ORM)
- **Charts**: Recharts
- **Icons**: Lucide React

## 3. Data Model (Esteso)

### Modelli Esistenti
- **Category**: id, name
- **Dish**: id, name, description, price, categoryId, recipes
- **Ingredient**: id, name, unit, minStock, currentStock, unitPrice
- **Recipe**: id, dishId, ingredientId, quantity
- **Supplier**: id, name, vat, email, phone, address, notes
- **Order**: id, date, status, total, supplierId
- **OrderItem**: id, orderId, ingredientId, quantity, unitPrice, received
- **Movement**: id, ingredientId, type, quantity, date, reference

### Nuovi Modelli per POS e SDI

```prisma
// Vendite e Transazioni
model Sale {
  id              String   @id @default(cuid())
  date            DateTime @default(now())
  total           Float
  taxAmount       Float    @default(0)
  paymentMethod   String   @default("CASH")  // CASH, CARD, MIXED
  coverCount      Int      @default(1)
  posId           String?  // ID del POS che ha generato la vendita
  operatorName    String?
  tableNumber     String?
  orderNumbers    String?  // Numeri d'ordine associati
  externalId      String?  // ID esterno (da POS)
  type            String   @default("MANUAL") // MANUAL, POS, RECEIPT
  source          String?  // cassa_in_cloud, sumup, etc.
  metadataJson    String?  // JSON con dati extra
  items          SaleItem[]
  dailySummary   DailySummary? @relation(fields: [dailySummaryId], references: [id])
  dailySummaryId String?

  @@unique([externalId, date])
}

model SaleItem {
  id           String  @id @default(cuid())
  quantity     Float
  unitPrice    Float
  totalPrice   Float
  vatRate      Float   @default(10)
  dishId       String?
  dish         Dish?   @relation(fields: [dishId], references: [id])
  saleId       String
  sale         Sale    @relation(fields: [saleId], references: [id], onDelete: Cascade)
  productName  String  // Nome descrittivo per riferimento
}

// Rijepilogo giornaliero per analytics
model DailySummary {
  id              String   @id @default(cuid())
  date            DateTime @unique
  totalRevenue    Float    @default(0)
  totalTax        Float    @default(0)
  totalCash       Float    @default(0)
  totalCard       Float    @default(0)
  coverCount      Int      @default(0)
  transactionCount Int     @default(0)
  averageTicket   Float    @default(0)
  sales           Sale[]
}

// Fatture Elettroniche SDI
model Invoice {
  id              String   @id @default(cuid())
  invoiceNumber   String   // Numero fattura (es. "FT24-00001")
  invoiceDate     DateTime
  dueDate         DateTime?
  senderVat       String   // Partita IVA fornitore
  senderName      String   // Ragione sociale fornitore
  recipientVat    String   // Partita IVA ristorante
  recipientName   String   // Ragione sociale ristorante
  totalAmount     Float
  taxAmount       Float
  xmlContent      String?  // Contenuto XML originale
  status          String   @default("RECEIVED")  // RECEIVED, PROCESSED, ERROR
  supplierId      String?
  supplier        Supplier? @relation(fields: [supplierId], references: [id])
  items           InvoiceItem[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model InvoiceItem {
  id           String  @id @default(cuid())
  description  String
  quantity     Float
  unitPrice    Float
  totalPrice   Float
  vatRate      Float   @default(10)
  invoiceId    String
  invoice      Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  ingredientId String?
  ingredient   Ingredient? @relation(fields: [ingredientId], references: [id])
}

// Configurazione POS
model PosConfig {
  id            String @id @default(cuid())
  name          String
  apiEndpoint   String
  apiKey        String?
  active        Boolean @default(true)
  lastSync      DateTime?
}

// Configurazione SDI
model SdiConfig {
  id                  String @id @default(cuid())
  recipientCode       String // Codice destinatario SDI
  pecAddress          String // PEC per ricezione fatture
  pushUrl             String? // URL per notifica push (opzionale)
  active             Boolean @default(true)
  lastFetch          DateTime?
}
```

## 4. API Endpoints

### Vendite (POS)
```
GET    /api/sales                 - Lista vendite (con filtri data)
POST   /api/sales                 - Registra nuova vendita (da POS)
GET    /api/sales/:id             - Dettaglio vendita
GET    /api/sales/daily           - Vendite giornaliere
GET    /api/sales/summary         - Riepilogo giornaliero/mensile
```

### Fatture SDI
```
GET    /api/invoices              - Lista fatture
POST   /api/invoices              - Upload fattura XML
GET    /api/invoices/:id          - Dettaglio fattura
POST   /api/invoices/parse        - Parsa XML fattura SDI
GET    /api/invoices/supplier/:vat - Fatture per fornitore
PUT    /api/invoices/:id/status   - Aggiorna stato fattura
```

### POS Integration
```
POST   /api/pos/connect           - Registra nuovo POS
GET    /api/pos                   - Lista POS configurati
PUT    /api/pos/:id/sync          - Forza sincronizzazione
```

### Cassa in Cloud Integration
```
POST   /api/cassa/sync            - Sincronizza dati da Cassa in Cloud
```
**Flusso:**
1. Autenticazione con API Key → Ottieni Bearer token
2. Chiamata `/reports/sold/products` per vendite per prodotto
3. Chiamata `/reports/sold/departments` per vendite per reparto
4. Chiamata `/documents/receipts` per scontrini dettagliati
5. Storage locale in tabella `Sale` con link al POS source

**Endpoint Cassa in Cloud:**
- Auth: `POST https://api.cassanova.com/apikey/token`
- Report by product: `GET https://api.cassanova.com/reports/sold/products`
- Report by department: `GET https://api.cassanova.com/reports/sold/departments`
- Receipts: `GET https://api.cassanova.com/documents/receipts`

**Requisiti:**
- API Key da Cassa in Cloud (licenza Enterprise)
- Rate limit: 360 chiamate / 10 minuti
- Body max: 100KB per richiesta

### Dashboard Real Data
```
GET    /api/analytics/revenue    - Andamento ricavi
GET    /api/analytics/food-cost   - Food cost real
GET    /api/analytics/margins     - Analisi margini
GET    /api/analytics/kpis        - KPI principali
```

## 5. Funzionalità Backend

### 5.1 Ricezione Vendite da POS
- Ricezione vendite JSON da registratori di cassa
- Validazione e normalizzazione dati
- Associazione automatica piatti/ingredienti
- Aggiornamento riepiloghi giornalieri

### 5.2 Parsing Fatture SDI (formato FatturaPA)
- Decodifica XML fattura elettronica
- Estrazione dati fiscali (P.IVA, importi, date)
- Matching automatico con fornitori registrati
- Creazione movimenti magazzino da fatture acquisto

### 5.3 Calcolo Food Cost Real
- Costo ingredienti da fatture SDI
- Ricette con dosi precise
- Sottoscorta minima e alert
- Trend food cost nel tempo

### 5.4 Reportistica Avanzata
- Bilancio mensile completo
- Analisi scostamenti budget
- Previsioni based on trend
- Export CSV/PDF

## 6. Componenti Backend

### lib/
- `db.ts` - Prisma client
- `utils.ts` - Helper functions
- `sdi-parser.ts` - Parser fatture SDI XML
- `cassa.ts` - Cassa in Cloud API client
- `food-cost.ts` - Calcolo costi ricette

### app/api/
- `/api/sales/*` - CRUD vendite
- `/api/invoices/*` - CRUD fatture SDI
- `/api/analytics/*` - Endpoints analytics
- `/api/pos/*` - Configurazione POS

## 7. MVP Scope (Esteso)

### Fase 1: Backend Base (completato)
1. ✅ Dashboard con KPI simulati
2. ✅ Gestione Menu (CRUD piatti)
3. ✅ Gestione Magazzino (CRUD ingredienti)
4. ✅ Gestione Fornitori
5. ✅ Food Cost base

## 7. MVP Scope (Esteso)

### Fase 1: Backend Base (completato)
1. ✅ Dashboard con KPI simulati
2. ✅ Gestione Menu (CRUD piatti)
3. ✅ Gestione Magazzino (CRUD ingredienti)
4. ✅ Gestione Fornitori
5. ✅ Food Cost base

### Fase 2: AI Assistant & Chat Interface
1. ✅ Chat AI floating window (bottom-right)
2. ✅ Command interpreter backend (`/api/ai/chat`)
3. ✅ Intent detection per: food cost, vendite, menu, magazzino, fornitori, fatture
4. ✅ Action routing (navigate, show_data, open_modal)

### Fase 3: Controllo di Gestione
1. ✅ Conto Economico page (`/controllo-gestione`)
2. ✅ KPI cards per ricavi, margine lordo/neto, food cost %
3. ✅ Struttura costi visualizzazione
4. ✅ Link a sezioni specifiche

### Fase 4: Integrazione POS
1. ✅ API per ricezione vendite
2. ✅ Modello Sale e SaleItem
3. ✅ Endpoint sincronizzazione Cassa in Cloud
4. 🔄 Dashboard con dati reali

### Fase 5: Fatture SDI
1. ⬜ Parser XML fattura elettronica
2. ⬜ Modello Invoice e InvoiceItem
3. ⬜ Upload manuale fatture XML
4. ⬜ Associazione ingredienti da fattura
5. ⬜ Aggiornamento automatico magazzino

### Fase 6: Analytics Avanzate
1. ⬜ Food cost real da fatture
2. ⬜ Analisi marginalità per piatto
3. ⬜ Report mensili automatizzati
4. ⬜ Alert sottoscorta