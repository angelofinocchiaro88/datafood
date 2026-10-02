# Revisione connessioni tra moduli DATAFOOD

Revisione del codice e dei flussi dati eseguita il 2 ottobre 2026. La mappa distingue le connessioni effettive dalle lacune osservate; “collegato” indica un flusso implementato nel codice, non una certificazione contabile o fiscale.

## 1. Vendite e Revenue Management

### Flusso verificato

`Corrispettivi / POS → Sale → SaleItem → Dish/Categoria → Ricetta/Ingredienti → Revenue Management → Controllo di Gestione / Report / Budget / Bilancio`

- Le registrazioni manuali e CSV passano da `/api/sales` e vengono salvate in `Sale`; le righe articolo, quando presenti, diventano `SaleItem`.
- Menu Engineering, Revenue Management e Controllo di Gestione leggono le righe vendita e i collegamenti a `Dish`; il costo teorico proviene dalla ricetta e dal costo ingrediente corrente.
- La pagina Vendite usa ora un endpoint analitico con periodi, confronto omogeneo, dettaglio temporale, pagamenti, categorie e prodotti. La stessa selezione di periodo/categoria apre Revenue Management.
- Revenue Management condivide il filtro cliente della pagina Vendite e mostra il collegamento tra venduto, ricetta, margine di contribuzione e scenario prezzo.
- Ricavi lordi, ricavi netti, IVA non verificata e quadratura tra totale scontrino e righe sono distinti. Gli importi non riconciliati non vengono dichiarati ricavo netto.
- Le righe POS possono essere corrette/riconciliate con l’anagrafica piatti; le vendite non collegate restano visibili ma non entrano nel calcolo del costo ricetta.

### Correzioni incluse in questa revisione

- Rimossi periodo Q1 fisso, distribuzioni settimanali proporzionali e serie giornaliera di esempio dal modulo Vendite.
- Corretta la forma della risposta `/api/sales` attesa da Corrispettivi; la pagina gestisce ora l’array restituito dall’API.
- Manuale e CSV consentono di inserire l’IVA totale documentata e la cronologia permette di verificarla successivamente per gli scontrini senza righe articolo.
- Aggiunti `Sale.taxAmountKnown` e `SaleItem.vatRateKnown`, così aliquote mancanti e differenze tra totale e righe non vengono trasformate in ricavi netti verificati.
- Le righe storiche mantengono lo stato di aliquota già memorizzato; le imposte storiche con importo maggiore di zero sono state marcate come note. Gli incassi aggregati senza imposta restano da verificare.
- Dashboard, Controllo di Gestione e Revenue Management usano la stessa funzione `calculateSaleFinancials` per distinguere il netto verificato dal lordo non riconciliato.
- Le API legacy di riepilogo vendite sono state spostate dalla tabella derivata `DailySummary` ai record `Sale`.
- La sincronizzazione Cassa in Cloud salva gli scontrini come vendite; i report aggregati per reparto/prodotto non vengono più persistiti come ulteriori vendite. I record aggregati legacy (`type=POS`) restano conservati ma sono esclusi dagli indicatori a livello scontrino. Le righe articolo si collegano ai piatti quando il nome POS corrisponde.

### Limiti dati ancora da gestire operativamente

- I corrispettivi giornalieri aggregati non hanno mix prodotto: per Menu Engineering e margini servono righe articolo POS collegate ai piatti.
- Cassa in Cloud non fornisce sempre aliquota o metodo pagamento sulle righe; tali campi restano esplicitamente da verificare quando mancano.
- La corrispondenza POS→piatto usa il nome normalizzato. Sinonimi/codici prodotto non sono ancora gestiti con una tabella di mapping dedicata.
- Il margine usa la ricetta e il costo ingrediente attuali, non lo storico dei costi al giorno della vendita né il consumo effettivo d’inventario.

## 2. Mappa dei moduli e dei flussi

| Modulo | Flusso implementato osservato | Esito / punto da verificare |
|---|---|---|
| Corrispettivi | Inserimento manuale/CSV e sync POS → `Sale` | Collegato; il dettaglio prodotto e l’IVA dipendono dalla fonte importata. |
| Vendite | `Sale` + `SaleItem` → aggregazioni lorde/nette, mix, pagamenti, coperti | Dettagliato e collegato a Revenue Management in questo aggiornamento. |
| Revenue Management | `SaleItem` + `Dish` + `Recipe` + `Ingredient` → ricavi, costi teorici, mix, fascia oraria, scenari | Collegato; richiede vendite con orario, piatti collegati e ricette complete. |
| Menu Engineering | Vendite per `Dish` + ricette/prezzi → popolarità, contribuzione, quadranti | Collegato sulle righe collegate; righe senza piatto sono escluse dalla matrice. |
| Food Cost | `Dish` + ricetta + `Ingredient.unitPrice` → costo porzione, food cost e prezzo obiettivo | Schede ricetta collegate alle vendite negli altri moduli; il workspace Food Cost non mostra ancora volume venduto e copertura nello stesso flusso. |
| Dashboard | Vendite, ricette, personale, fatture, budget, scadenze, cassa e ordini → KPI/alert | Composizione implementata; eredita qualità e limiti delle fonti sottostanti. |
| Controllo di Gestione | Vendite POS + fatture emesse + fatture fornitori classificate + personale + cespiti + budget | Collegato tramite `/api/cost-control`; alcune voci sono dichiarate stime/parziali e non consuntivi contabili. |
| Report | Riepiloga Controllo di Gestione e copertura delle fonti | Collegato tramite `/api/cost-control`. |
| Budget | Obiettivi mensili + actual di Controllo di Gestione | Collegato tramite `/api/budget-targets` e `/api/cost-control`. |
| Bilancio | Conto Economico gestionale da Controllo di Gestione + saldi patrimoniali disponibili | Collegato ai dati operativi; liquidità condivisa con i saldi iniziali e movimenti Cash Flow. Debiti, imposte e patrimonio netto restano N/D finché non riconciliati. |
| Ordini | Ordine fornitore → ricezione parziale/totale → stock ingrediente + `Movement` | Ricezione aggiorna lo stock in transazione. La fattura reale va registrata in Accounting: la ricezione non crea più una fattura sintetica con IVA presunta. Manca ancora la relazione ordine↔fattura per la riconciliazione. |
| Accounting (fatture ricevute) | XML/documento → `Invoice` → approvazione/classificazione → Controllo di Gestione | Collegato per i costi classificati; la riconciliazione ordine–fattura e il pagamento–Cash Flow non sono automatizzati. |
| Fatture emesse | `FatturaEmessa` → ricavi B2B nel Controllo di Gestione/Bilancio | Ricavo collegato; incasso e credito cliente non sono riconciliati con i movimenti bancari Cash Flow. |
| Magazzino | `Ingredient.currentStock` + `Movement`; ricezione ordini aggiorna entrambi | Collegato alle ricette via ingrediente e ai costi via unit price; vendite POS non scaricano automaticamente le quantità teoriche. |
| Personale | Dipendenti/contratti/buste paga → costo personale in Controllo di Gestione | Collegato; i periodi senza busta possono essere stimati e sono marcati. |
| Ammortamenti | Cespiti → quote ammortamento → Controllo di Gestione/Bilancio | Collegato ai calcoli economici e patrimoniali; non è un flusso di cassa. |
| Cash Flow | Conti, saldi iniziali, movimenti importati/manuali e scadenze → forecast | Il saldo attuale è ora calcolato con la stessa regola in Cash Flow, Dashboard, Controllo di Gestione e Bilancio. Sottosistema ancora manuale: vendite e fatture non generano automaticamente incassi/pagamenti o scadenze. |
| Clienti / selettore | `localStorage.df_clientId` seleziona un cliente nell’interfaccia | **Lacuna trasversale critica:** numerose API e pagine server-side continuano a filtrare `clientId: "default"` oppure non filtrano affatto. Le nuove viste Vendite/Revenue e Corrispettivi propagano il cliente attivo; non è ancora uniforme in tutto il prodotto. |

## 3. Lacune trasversali prioritarie rimaste

1. **Contesto cliente (P0):** il selettore non è una sessione/contesto server condiviso. Verificato hard-coded `default` in API di Controllo di Gestione, Budget, Bilancio, Menu Engineering, Cash Flow e Revenue Management precedente; altre API leggono dati senza filtro cliente. Va risolto con un contesto client server-side e applicato a tutte le letture, scritture e operazioni per ID.
2. **Riconciliazione finanziaria (P1):** Cash Flow non crea automaticamente scadenze da fatture emesse/ricevute e corrispettivi. Occorrono date/condizioni di pagamento e un collegamento univoco tra documento, scadenza e movimento bancario.
3. **Ordine–fattura (P1):** la fattura sintetica e l’aliquota presunta sono state rimosse dalla ricezione; schema e API non conservano ancora una relazione ordine↔fattura che consenta riconciliazione affidabile con il documento reale.
4. **POS–magazzino (P1):** le vendite non generano scarichi ingredienti derivati dalle ricette; il costo esposto è teorico e non la variazione reale di giacenza.
5. **Audit e test automatici (P1):** il repository non definisce script di test nel `package.json`; l’integrazione è verificata principalmente via build e controlli manuali. Servono test di dominio per IVA/netto, deduplica import, ricezione ordini, tenant e riconciliazione.
6. **API legacy/orfane:** le viste P&L e riepilogo annuale usano ora la fonte Controllo di Gestione invece di percentuali fisse; alcune API di analisi non risultano comunque richiamate dalle pagine correnti e andranno consolidate o rimosse dopo aver verificato eventuali integrazioni esterne.

## 4. Verifiche richieste prima della pubblicazione

- `npx prisma validate` e `npx prisma db push` per i due campi di qualità fiscale aggiunti allo schema.
- `npm run build` per compilazione e controllo TypeScript dell’intero progetto.
- Smoke test in produzione degli endpoint Vendite e test UI senza creare corrispettivi finanziari fittizi.
- Verifica operativa con un cliente non `default` prima di considerare risolto il problema di selezione cliente a livello applicativo.
