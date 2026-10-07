# Revisione connessioni tra moduli DATAFOOD

Revisione del codice e dei flussi dati eseguita il 2 ottobre 2026. La mappa distingue le connessioni effettive dalle lacune osservate; “collegato” indica un flusso implementato nel codice, non una certificazione contabile o fiscale.

## Modello operativo ibrido

- Ogni ristorante è un tenant `Client` con modalità `self_service`, `managed` o `hybrid`, stato/piano/scadenza licenza e flag per incarico DATAFOOD.
- L’accesso è basato su utenti email/password e membership per ristorante con ruoli `owner`, `manager`, `accountant`, `staff` e `datafood_operator`.
- L’operatore DATAFOOD può scrivere nei dati del ristorante solo se la modalità è managed/ibrida e l’incarico è attivo. L’attore e la provenienza sono conservati in `ClientAuditLog`.
- Licenza e servizio gestito si attivano manualmente dall’amministratore; Stripe non è collegato in questa fase.
- Il tenant selezionato è impostato in cookie HttpOnly e verificato rispetto alle membership. Il livello Prisma applica il filtro tenant ai modelli con `clientId` e alle relazioni principali.
- Il primo amministratore DATAFOOD è stato creato il 6 ottobre 2026 tramite bootstrap una tantum; `DATAFOOD_BOOTSTRAP_TOKEN` è stato rimosso da Vercel e l’endpoint rifiuta ulteriori bootstrap.
- Tutte le richieste API e pagine passano ora dal middleware di sessione; il selettore imposta un cookie HttpOnly verificato contro le membership e Prisma aggiunge il filtro tenant anche alle query per ID e alle relazioni principali.

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
| Ordini | Ordine fornitore → ricezione parziale/totale → stock ingrediente + `Movement` → fattura reale collegabile | Ricezione aggiorna lo stock in transazione. Accounting può collegare una fattura approvata a un ordine ricevuto dello stesso fornitore; niente fattura sintetica o IVA presunta. |
| Accounting (fatture ricevute) | XML/documento → `Invoice` → approvazione/classificazione → ordine ricevuto opzionale → scadenza Cash Flow | Scadenza creata su data/importo documento verificati; pagamento dal Cash Flow aggiorna lo stato fattura. L’ordine ricevuto è collegabile durante la classificazione. |
| Fatture emesse | `FatturaEmessa` + scadenza → ricavo B2B + incasso programmato Cash Flow | La scadenza genera un evento idempotente e il saldo aggiorna lo stato pagamento. Se la data non è presente, il modulo non inventa una scadenza. |
| Magazzino | `Ingredient.currentStock` + `Movement`; ricezione ordini aggiorna entrambi | Collegato alle ricette via ingrediente e ai costi via unit price; vendite POS non scaricano automaticamente le quantità teoriche. |
| Personale | Dipendenti/contratti/buste paga → costo personale in Controllo di Gestione | Collegato; i periodi senza busta possono essere stimati e sono marcati. |
| Ammortamenti | Cespiti → quote ammortamento → Controllo di Gestione/Bilancio | Collegato ai calcoli economici e patrimoniali; non è un flusso di cassa. |
| Cash Flow | Conti, saldi iniziali, movimenti importati/manuali, fatture con scadenza → forecast | Il saldo è coerente tra moduli; fatture ricevute/emesse creano scadenze collegate quando hanno una data affidabile. Corrispettivi POS restano da abbinare a movimenti effettivi, perché i tempi di accredito dipendono dal metodo e dal contratto POS. |
| Clienti / accesso | User + membership + licenza + cookie HttpOnly + filtro Prisma per tenant | Fondazione, bootstrap admin e UI d’invito completati; restano smoke test con due tenant e verifica dei permessi per ruoli prima dell’onboarding. |

## 3. Lacune trasversali prioritarie rimaste

1. **Copertura tenant (P0):** il contesto server e il filtro Prisma sono implementati anche per relazioni senza `clientId`; restano da testare con due tenant e percorsi API per ID, inclusi i casi di ruolo revocato e licenza sospesa.
2. **POS–Cash Flow (P1):** le fatture con scadenza sono collegate. Gli incassi POS vanno abbinati a movimenti bancari reali: non si deduce una data di accredito senza configurazione del gestore POS.
3. **POS–magazzino (P1):** il costo resta teorico; lo scarico reale richiede mapping affidabile prodotti→piatti, unità/resa/scarto e deduplica per scontrino prima di aggiornare le giacenze.
4. **Test automatici (P1):** presenti test unitari per le regole di filtro tenant. Servono test end-to-end con due tenant e test per ruoli, licenza, import deduplicato, pagamento fatture, ordini e stock.
5. **Bootstrap e gestione inviti:** bootstrap admin completato e `DATAFOOD_BOOTSTRAP_TOKEN` rimosso da Vercel. Manca l’invio email automatico; l’amministratore condivide il link temporaneo prodotto dal pannello.
6. **API legacy/orfane:** le viste P&L e riepilogo annuale usano ora la fonte Controllo di Gestione; alcune API non risultano comunque richiamate dalle pagine correnti e andranno consolidate o rimosse dopo aver verificato eventuali integrazioni esterne.
7. **Webhook SDI:** il middleware richiede sessione anche per `/api/sdi/webhook`. Prima di collegare un provider esterno va implementata una firma webhook per tenant; la firma ricevuta dal codice precedente non veniva verificata.

## 4. Verifiche richieste prima della pubblicazione

- `npx prisma validate`, `npx prisma db push`, `npm test` e `npm run build`.
- Primo amministratore DATAFOOD creato da `/login`; `DATAFOOD_BOOTSTRAP_TOKEN` rimosso da Vercel.
- Smoke test autenticato con due ristoranti: account/membership, query tenant, invito/accettazione, servizio gestito, scadenza fattura e saldo in Cash Flow.
- Verificare il webhook SDI con la firma/provider prima di riattivare l’integrazione esterna.
