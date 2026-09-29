// DATAFOOD - Topologia Costi Ristorazione (Magazzino Dati)
// Questo file è il registro gerarchico completo dei costi per la classificazione fatture.
// 4 livelli: macro_area → categoria → sottocategoria → voce_dettaglio

export interface VoceDettaglio { voce: string; }
export interface SottoCategoria { nome: string; voci: string[]; }
export interface Categoria { nome: string; sottocategorie: SottoCategoria[]; }
export interface MacroArea { macro_area: string; conto_gestionale: string; categorie: Categoria[]; }

export const COST_TOPOLOGY: MacroArea[] = [
  {
    macro_area: "COSTO DEL VENDUTO FOOD",
    conto_gestionale: "Food Cost",
    categorie: [
      { nome: "Carni", sottocategorie: [
        { nome: "Pollame", voci: ["pollo", "tacchino", "anatra", "gallina"] },
        { nome: "Bovino", voci: ["vitello", "manzo", "scottona", "hamburger bovino"] },
        { nome: "Suino", voci: ["maiale", "guanciale", "pancetta", "salumi suini", "salsiccia"] },
        { nome: "Ovicaprini", voci: ["agnello", "pecora", "capra"] },
      ]},
      { nome: "Pesce e prodotti ittici", sottocategorie: [
        { nome: "Pesce fresco", voci: ["branzino", "orata", "tonno", "salmone", "merluzzo", "pesce spada"] },
        { nome: "Molluschi e crostacei", voci: ["gamberi", "scampi", "calamari", "polpo", "cozze", "vongole"] },
        { nome: "Pesce congelato/lavorato", voci: ["filetti congelati", "fritto misto"] },
      ]},
      { nome: "Verdure e ortaggi", sottocategorie: [
        { nome: "Verdure fresche", voci: ["insalata", "pomodoro", "zucchine", "melanzane", "patate", "cipolle", "spinaci"] },
        { nome: "Legumi", voci: ["fagioli", "ceci", "lenticchie", "piselli"] },
        { nome: "Funghi e tartufi", voci: ["funghi freschi", "funghi secchi", "tartufo", "porcini"] },
      ]},
      { nome: "Pasta, riso, farine e cereali", sottocategorie: [
        { nome: "Pasta", voci: ["pasta secca", "pasta fresca", "gnocchi", "ripiena"] },
        { nome: "Riso e cereali", voci: ["riso", "orzo", "farro", "cous cous"] },
        { nome: "Farine", voci: ["farina 00", "semola", "pangrattato"] },
      ]},
      { nome: "Latticini e formaggi", sottocategorie: [
        { nome: "Latte e derivati", voci: ["latte", "panna", "burro", "yogurt", "mascarpone"] },
        { nome: "Formaggi freschi", voci: ["mozzarella", "burrata", "ricotta", "stracciatella"] },
        { nome: "Formaggi stagionati", voci: ["parmigiano", "grana", "pecorino", "gorgonzola"] },
      ]},
      { nome: "Pane, bakery e pizza", sottocategorie: [
        { nome: "Pane e forno", voci: ["pane", "panini", "focaccia", "grissini"] },
        { nome: "Pizza e impasti", voci: ["impasto pizza", "lievito"] },
      ]},
      { nome: "Condimenti, spezie e basi", sottocategorie: [
        { nome: "Oli e grassi", voci: ["olio evo", "olio semi", "burro chiarificato"] },
        { nome: "Spezie e aromi", voci: ["sale", "pepe", "origano", "basilico", "rosmarino"] },
        { nome: "Salse e basi", voci: ["passata", "concentrato", "maionese", "brodi"] },
      ]},
      { nome: "Frutta e dessert", sottocategorie: [
        { nome: "Frutta fresca", voci: ["mele", "pere", "fragole", "limoni", "arance"] },
        { nome: "Frutta secca", voci: ["mandorle", "nocciole", "noci"] },
      ]},
      { nome: "Altri alimentari", sottocategorie: [
        { nome: "Uova", voci: ["uova fresche", "uova pastorizzate", "albumi"] },
        { nome: "Conserve", voci: ["tonno", "pelati", "olive", "capperi"] },
      ]},
    ],
  },
  {
    macro_area: "COSTO DEL VENDUTO BEVERAGE",
    conto_gestionale: "Beverage Cost",
    categorie: [
      { nome: "Acque e bibite", sottocategorie: [
        { nome: "Acqua", voci: ["acqua naturale", "acqua frizzante"] },
        { nome: "Soft drink", voci: ["cola", "aranciata", "limonata", "te freddo", "energy drink"] },
      ]},
      { nome: "Vini", sottocategorie: [
        { nome: "Vini bianchi", voci: ["vino bianco fermo", "vino bianco frizzante"] },
        { nome: "Vini rossi", voci: ["vino rosso fermo", "vino rosso strutturato"] },
        { nome: "Bollicine e rosati", voci: ["prosecco", "spumante", "champagne", "rosato"] },
      ]},
      { nome: "Birre", sottocategorie: [
        { nome: "Birra bottiglia", voci: ["lager", "ipa", "artigianale"] },
        { nome: "Birra spina", voci: ["fusto lager", "fusto ipa"] },
      ]},
      { nome: "Spirits e liquori", sottocategorie: [
        { nome: "Distillati", voci: ["gin", "vodka", "rum", "whisky", "grappa"] },
        { nome: "Liquori", voci: ["amaro", "vermouth", "aperitivo", "limoncello"] },
      ]},
      { nome: "Caffe e colazione", sottocategorie: [
        { nome: "Caffe", voci: ["caffe in grani", "caffe macinato", "capsule", "decaffeinato"] },
        { nome: "Bevande calde", voci: ["te", "tisane", "cioccolata"] },
      ]},
    ],
  },
  {
    macro_area: "PACKAGING E MATERIALI DI VENDITA",
    conto_gestionale: "Packaging",
    categorie: [
      { nome: "Packaging delivery", sottocategorie: [
        { nome: "Contenitori", voci: ["box", "vaschette", "contenitori pizza"] },
        { nome: "Monouso", voci: ["bicchieri", "posate monouso", "cannucce"] },
        { nome: "Shopper", voci: ["shopper carta", "shopper plastica"] },
      ]},
    ],
  },
  {
    macro_area: "PERSONALE",
    conto_gestionale: "Labor Cost",
    categorie: [
      { nome: "Personale operativo", sottocategorie: [
        { nome: "Cucina", voci: ["chef", "sous chef", "cuoco", "aiuto cuoco", "pizzaiolo"] },
        { nome: "Sala", voci: ["maitre", "cameriere", "sommelier", "hostess"] },
        { nome: "Bar", voci: ["barista"] },
      ]},
      { nome: "Oneri e costi personale", sottocategorie: [
        { nome: "Retribuzioni", voci: ["stipendi", "straordinari", "tredicesima"] },
        { nome: "Oneri contributivi", voci: ["inps", "inail"] },
        { nome: "Accessori", voci: ["divise", "formazione", "welfare"] },
      ]},
    ],
  },
  {
    macro_area: "DELIVERY E TAKE AWAY",
    conto_gestionale: "Delivery Costs",
    categorie: [
      { nome: "Commissioni piattaforme", sottocategorie: [
        { nome: "Marketplace", voci: ["glovo", "deliveroo", "just eat", "uber eats"] },
      ]},
    ],
  },
  {
    macro_area: "OCCUPAZIONE E STRUTTURA",
    conto_gestionale: "Occupancy",
    categorie: [
      { nome: "Canoni immobiliari", sottocategorie: [
        { nome: "Locazione", voci: ["affitto locale", "affitto deposito"] },
        { nome: "Condominio", voci: ["spese condominiali"] },
      ]},
      { nome: "Assicurazioni", sottocategorie: [
        { nome: "Polizze", voci: ["rc", "incendio", "furto"] },
      ]},
    ],
  },
  {
    macro_area: "UTENZE",
    conto_gestionale: "Utilities",
    categorie: [
      { nome: "Energia e servizi", sottocategorie: [
        { nome: "Energia", voci: ["energia elettrica", "gas"] },
        { nome: "Acqua e rifiuti", voci: ["acqua", "tari"] },
        { nome: "Comunicazioni", voci: ["telefono", "internet", "fibra"] },
      ]},
    ],
  },
  {
    macro_area: "MANUTENZIONI E ASSISTENZA",
    conto_gestionale: "Maintenance",
    categorie: [
      { nome: "Manutenzioni", sottocategorie: [
        { nome: "Attrezzature cucina", voci: ["forni", "frigoriferi", "abbattitori"] },
        { nome: "Impianti", voci: ["elettrico", "idrico", "clima"] },
      ]},
    ],
  },
  {
    macro_area: "SERVIZI DIGITALI E SOFTWARE",
    conto_gestionale: "Software",
    categorie: [
      { nome: "Software gestionali", sottocategorie: [
        { nome: "POS e cassa", voci: ["software cassa", "abbonamento pos"] },
        { nome: "Gestionale", voci: ["gestionale sala", "magazzino", "food cost"] },
        { nome: "Prenotazioni/CRM", voci: ["the fork", "crm"] },
      ]},
    ],
  },
  {
    macro_area: "CONSULENZE E SERVIZI PROFESSIONALI",
    conto_gestionale: "Professional Services",
    categorie: [
      { nome: "Consulenze amministrative", sottocategorie: [
        { nome: "Amministrazione", voci: ["commercialista", "paghe", "consulente lavoro"] },
        { nome: "Legale", voci: ["avvocato", "notaio"] },
      ]},
      { nome: "Consulenze operative", sottocategorie: [
        { nome: "Compliance", voci: ["haccp", "sicurezza", "privacy"] },
      ]},
    ],
  },
  {
    macro_area: "MARKETING E PUBBLICITA'",
    conto_gestionale: "Marketing",
    categorie: [
      { nome: "Advertising", sottocategorie: [
        { nome: "Digital", voci: ["meta ads", "google ads", "instagram ads"] },
        { nome: "Offline", voci: ["volantini", "cartellonistica"] },
      ]},
    ],
  },
  {
    macro_area: "SPESE OPERATIVE DI SALA E CUCINA",
    conto_gestionale: "Direct Operating Expenses",
    categorie: [
      { nome: "Materiali operativi", sottocategorie: [
        { nome: "Pulizia e igiene", voci: ["detersivi", "sanificanti", "carta", "guanti"] },
        { nome: "Piccole attrezzature", voci: ["coltelli", "padelle", "utensili"] },
      ]},
    ],
  },
  {
    macro_area: "SPESE GENERALI E AMMINISTRATIVE",
    conto_gestionale: "G&A",
    categorie: [
      { nome: "Spese ufficio", sottocategorie: [
        { nome: "Cancelleria", voci: ["cancelleria", "toner"] },
      ]},
    ],
  },
  {
    macro_area: "IMPOSTE, TRIBUTI, DIRITTI E CANONI",
    conto_gestionale: "Taxes & Licenses",
    categorie: [
      { nome: "Tributi", sottocategorie: [
        { nome: "Locali", voci: ["tari", "occupazione suolo"] },
        { nome: "Licenze", voci: ["siae", "scf"] },
      ]},
    ],
  },
  {
    macro_area: "ONERI FINANZIARI E BANCARI",
    conto_gestionale: "Financial Charges",
    categorie: [
      { nome: "Banche", sottocategorie: [
        { nome: "Commissioni", voci: ["commissioni pos", "spese conto"] },
        { nome: "Interessi", voci: ["interessi passivi"] },
      ]},
    ],
  },
  {
    macro_area: "AMMORTAMENTI E CANONI BENI STRUMENTALI",
    conto_gestionale: "Depreciation & Leases",
    categorie: [
      { nome: "Canoni e ammortamenti", sottocategorie: [
        { nome: "Leasing", voci: ["leasing attrezzature", "noleggio"] },
        { nome: "Ammortamenti", voci: ["attrezzature", "arredi", "software"] },
      ]},
    ],
  },
  {
    macro_area: "COSTI STRAORDINARI O NON RICORRENTI",
    conto_gestionale: "Extraordinary",
    categorie: [
      { nome: "Straordinari", sottocategorie: [
        { nome: "Non ricorrenti", voci: ["multe", "sanzioni", "danni"] },
      ]},
    ],
  },
];

export function getAllMacroAreas(): string[] {
  return COST_TOPOLOGY.map(m => m.macro_area);
}

export function getCategorie(macroArea: string): string[] {
  const m = COST_TOPOLOGY.find(x => x.macro_area === macroArea);
  return m ? m.categorie.map(c => c.nome) : [];
}

export function getSottoCategorie(macroArea: string, categoria: string): string[] {
  const m = COST_TOPOLOGY.find(x => x.macro_area === macroArea);
  const c = m?.categorie.find(c => c.nome === categoria);
  return c ? c.sottocategorie.map(s => s.nome) : [];
}

export function getVoci(macroArea: string, categoria: string, sottocategoria: string): string[] {
  const m = COST_TOPOLOGY.find(x => x.macro_area === macroArea);
  const c = m?.categorie.find(c => c.nome === categoria);
  const s = c?.sottocategorie.find(s => s.nome === sottocategoria);
  return s ? s.voci : [];
}