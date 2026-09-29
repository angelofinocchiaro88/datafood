// DATAFOOD - Auto-classificazione fatture basata sul Registro Costi Gestionale
// Questo modulo analizza la descrizione di una fattura e suggerisce la classificazione

interface Classification {
  macro_area: string;
  categoria: string;
  sottocategoria: string;
  voce_dettaglio: string;
  conto_gestionale: string;
  confidence: number;
}

const CLASSIFICATION_RULES: { keywords: string[]; classification: Omit<Classification, "confidence"> }[] = [
  // Food - Carni
  { keywords: ["pollo", "tacchino", "anatra", "gallina"], classification: { macro_area: "COSTO DEL VENDUTO FOOD", categoria: "Carni", sottocategoria: "Pollame", voce_dettaglio: "pollo", conto_gestionale: "Food Cost" } },
  { keywords: ["vitello", "manzo", "scottona", "bovino", "hamburger", "frattaglie"], classification: { macro_area: "COSTO DEL VENDUTO FOOD", categoria: "Carni", sottocategoria: "Bovino", voce_dettaglio: "bovino", conto_gestionale: "Food Cost" } },
  { keywords: ["maiale", "salsiccia", "pancetta", "guanciale", "prosciutto", "salumi", "speck"], classification: { macro_area: "COSTO DEL VENDUTO FOOD", categoria: "Carni", sottocategoria: "Suino", voce_dettaglio: "salumi suini", conto_gestionale: "Food Cost" } },
  { keywords: ["agnello", "pecora", "capra"], classification: { macro_area: "COSTO DEL VENDUTO FOOD", categoria: "Carni", sottocategoria: "Ovicaprini", voce_dettaglio: "agnello", conto_gestionale: "Food Cost" } },
  
  // Food - Pesce
  { keywords: ["branzino", "orata", "tonno", "salmone", "merluzzo", "pesce spada", "pesce fresco"], classification: { macro_area: "COSTO DEL VENDUTO FOOD", categoria: "Pesce e prodotti ittici", sottocategoria: "Pesce fresco", voce_dettaglio: "pesce fresco", conto_gestionale: "Food Cost" } },
  { keywords: ["gamberi", "scampi", "calamari", "polpo", "cozze", "vongole", "ostriche"], classification: { macro_area: "COSTO DEL VENDUTO FOOD", categoria: "Pesce e prodotti ittici", sottocategoria: "Molluschi e crostacei", voce_dettaglio: "molluschi", conto_gestionale: "Food Cost" } },
  
  // Food - Verdure
  { keywords: ["insalata", "pomodoro", "zucchine", "melanzane", "peperoni", "carote", "cipolla", "patate", "spinaci", "broccoli", "verdure"], classification: { macro_area: "COSTO DEL VENDUTO FOOD", categoria: "Verdure e ortaggi", sottocategoria: "Verdure fresche", voce_dettaglio: "verdure fresche", conto_gestionale: "Food Cost" } },
  { keywords: ["funghi", "tartufo", "porcini"], classification: { macro_area: "COSTO DEL VENDUTO FOOD", categoria: "Verdure e ortaggi", sottocategoria: "Funghi e tartufi", voce_dettaglio: "funghi", conto_gestionale: "Food Cost" } },
  
  // Food - Pasta, Riso, Farine
  { keywords: ["pasta", "spaghetti", "penne", "tagliatelle", "gnocchi"], classification: { macro_area: "COSTO DEL VENDUTO FOOD", categoria: "Pasta, riso, farine e cereali", sottocategoria: "Pasta", voce_dettaglio: "pasta secca", conto_gestionale: "Food Cost" } },
  { keywords: ["riso", "carnaroli", "arborio", "orzo", "farro", "cereali"], classification: { macro_area: "COSTO DEL VENDUTO FOOD", categoria: "Pasta, riso, farine e cereali", sottocategoria: "Riso e cereali", voce_dettaglio: "riso", conto_gestionale: "Food Cost" } },
  { keywords: ["farina", "semola", "pangrattato"], classification: { macro_area: "COSTO DEL VENDUTO FOOD", categoria: "Pasta, riso, farine e cereali", sottocategoria: "Farine e semilavorati base", voce_dettaglio: "farina", conto_gestionale: "Food Cost" } },
  
  // Food - Latticini
  { keywords: ["mozzarella", "burrata", "ricotta", "stracciatella", "fiordilatte"], classification: { macro_area: "COSTO DEL VENDUTO FOOD", categoria: "Latticini e formaggi", sottocategoria: "Formaggi freschi", voce_dettaglio: "mozzarella", conto_gestionale: "Food Cost" } },
  { keywords: ["parmigiano", "grana", "pecorino", "gorgonzola", "asiago", "provola", "stagionato"], classification: { macro_area: "COSTO DEL VENDUTO FOOD", categoria: "Latticini e formaggi", sottocategoria: "Formaggi stagionati", voce_dettaglio: "parmigiano", conto_gestionale: "Food Cost" } },
  { keywords: ["latte", "panna", "burro", "yogurt", "mascarpone"], classification: { macro_area: "COSTO DEL VENDUTO FOOD", categoria: "Latticini e formaggi", sottocategoria: "Latte e derivati", voce_dettaglio: "latticini", conto_gestionale: "Food Cost" } },
  
  // Food - Condimenti e Oli
  { keywords: ["olio", "evo", "extravergine"], classification: { macro_area: "COSTO DEL VENDUTO FOOD", categoria: "Condimenti, spezie e basi cucina", sottocategoria: "Oli e grassi", voce_dettaglio: "olio evo", conto_gestionale: "Food Cost" } },
  { keywords: ["sale", "pepe", "origano", "basilico", "rosmarino", "spezie"], classification: { macro_area: "COSTO DEL VENDUTO FOOD", categoria: "Condimenti, spezie e basi cucina", sottocategoria: "Spezie e aromi", voce_dettaglio: "spezie", conto_gestionale: "Food Cost" } },
  
  // Beverage
  { keywords: ["acqua", "coca cola", "cola", "aranciata", "bibita", "soft drink", "energy drink"], classification: { macro_area: "COSTO DEL VENDUTO BEVERAGE", categoria: "Acque e bibite", sottocategoria: "Soft drink", voce_dettaglio: "bibite", conto_gestionale: "Beverage Cost" } },
  { keywords: ["vino", "prosecco", "spumante", "champagne", "rosato"], classification: { macro_area: "COSTO DEL VENDUTO BEVERAGE", categoria: "Vini", sottocategoria: "Vini bianchi", voce_dettaglio: "vino", conto_gestionale: "Beverage Cost" } },
  { keywords: ["birra", "lager", "ipa", "fusto", "spina"], classification: { macro_area: "COSTO DEL VENDUTO BEVERAGE", categoria: "Birre", sottocategoria: "Birra in bottiglia", voce_dettaglio: "birra", conto_gestionale: "Beverage Cost" } },
  { keywords: ["gin", "vodka", "rum", "whisky", "tequila", "grappa", "distillati", "amaro", "aperitivo", "liquore"], classification: { macro_area: "COSTO DEL VENDUTO BEVERAGE", categoria: "Spirits e liquori", sottocategoria: "Distillati", voce_dettaglio: "spirits", conto_gestionale: "Beverage Cost" } },
  { keywords: ["caffe", "caffè", "capsule", "decaffeinato", "te", "tisana", "cioccolata"], classification: { macro_area: "COSTO DEL VENDUTO BEVERAGE", categoria: "Caffe e colazione", sottocategoria: "Caffe", voce_dettaglio: "caffe", conto_gestionale: "Beverage Cost" } },
  
  // Other categories
  { keywords: ["glovo", "deliveroo", "just eat", "uber eats", "delivery"], classification: { macro_area: "DELIVERY E TAKE AWAY", categoria: "Commissioni piattaforme", sottocategoria: "Marketplace delivery", voce_dettaglio: "commissioni delivery", conto_gestionale: "Delivery" } },
  { keywords: ["affitto", "locazione", "canone", "condominio"], classification: { macro_area: "OCCUPAZIONE E STRUTTURA", categoria: "Canoni immobiliari", sottocategoria: "Locazione", voce_dettaglio: "affitto", conto_gestionale: "Occupancy" } },
  { keywords: ["energia", "luce", "gas", "elettrica", "acqua", "telefono", "internet", "fibra"], classification: { macro_area: "UTENZE", categoria: "Energia e servizi", sottocategoria: "Energia", voce_dettaglio: "utenze", conto_gestionale: "Utilities" } },
  { keywords: ["software", "licenza", "saas", "cloud", "dominio", "hosting", "pos", "gestionale", "cassa"], classification: { macro_area: "SERVIZI DIGITALI E SOFTWARE", categoria: "Software gestionali", sottocategoria: "Gestionale ristorante", voce_dettaglio: "software", conto_gestionale: "Software" } },
  { keywords: ["commercialista", "consulenza", "payroll", "consulente del lavoro", "paghe"], classification: { macro_area: "CONSULENZE E SERVIZI PROFESSIONALI", categoria: "Consulenze amministrative e fiscali", sottocategoria: "Amministrazione e contabilità", voce_dettaglio: "commercialista", conto_gestionale: "Professional Services" } },
  { keywords: ["meta ads", "facebook ads", "instagram ads", "google ads", "tiktok ads", "pubblicita", "marketing", "volantini", "shooting", "influencer"], classification: { macro_area: "MARKETING E PUBBLICITA'", categoria: "Advertising", sottocategoria: "Digital advertising", voce_dettaglio: "social ads", conto_gestionale: "Marketing" } },
  { keywords: ["manutenzione", "riparazione", "assistenza tecnica", "forno", "frigo"], classification: { macro_area: "MANUTENZIONI E ASSISTENZA", categoria: "Manutenzioni cucina e impianti", sottocategoria: "Attrezzature cucina", voce_dettaglio: "manutenzione attrezzature", conto_gestionale: "Maintenance" } },
  { keywords: ["detersivi", "sanificanti", "carta igienica", "guanti", "pulizia"], classification: { macro_area: "SPESE OPERATIVE DI SALA E CUCINA", categoria: "Materiali operativi", sottocategoria: "Pulizia e igiene", voce_dettaglio: "pulizia", conto_gestionale: "Direct OE" } },
  { keywords: ["siae", "scf", "licenza", "tassa", "tari", "tributo"], classification: { macro_area: "IMPOSTE, TRIBUTI, DIRITTI E CANONI", categoria: "Tributi e autorizzazioni", sottocategoria: "Tributi locali", voce_dettaglio: "tributi", conto_gestionale: "Taxes" } },
  { keywords: ["commissione pos", "commissione bancaria", "interessi", "banca"], classification: { macro_area: "ONERI FINANZIARI E BANCARI", categoria: "Banche e pagamenti", sottocategoria: "Commissioni bancarie", voce_dettaglio: "commissioni bancarie", conto_gestionale: "Financial" } },
  { keywords: ["sponsorizzazioni", "haccp", "sicurezza", "privacy", "formazione"], classification: { macro_area: "CONSULENZE E SERVIZI PROFESSIONALI", categoria: "Consulenze operative e strategiche", sottocategoria: "Compliance e sicurezza", voce_dettaglio: "consulenza", conto_gestionale: "Professional Services" } },
];

export function classifyInvoice(description: string, supplierName: string, amount: number): Classification {
  const lowerDesc = description.toLowerCase();
  const lowerName = supplierName.toLowerCase();
  const combined = `${lowerDesc} ${lowerName}`;
  
  // Search for keyword matches
  let bestMatch: Classification | null = null;
  let bestScore = 0;
  
  for (const rule of CLASSIFICATION_RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (combined.includes(kw.toLowerCase())) {
        score += kw.length; // longer keyword = more specific match
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { ...rule.classification, confidence: Math.min(100, score * 5) };
    }
  }
  
  if (bestMatch && bestMatch.confidence > 10) {
    return bestMatch;
  }
  
  // Default: analyze amount to guess
  if (amount > 5000) {
    return { macro_area: "COSTO DEL VENDUTO FOOD", categoria: "Altri alimentari", sottocategoria: "Semilavorati", voce_dettaglio: "generico food", conto_gestionale: "Food Cost", confidence: 20 };
  }
  
  return { macro_area: "SPESE GENERALI E AMMINISTRATIVE", categoria: "Spese ufficio", sottocategoria: "Cancelleria e materiali", voce_dettaglio: "generico", conto_gestionale: "G&A", confidence: 5 };
}

export const MACRO_AREAS = [
  "COSTO DEL VENDUTO FOOD",
  "COSTO DEL VENDUTO BEVERAGE",
  "PACKAGING E MATERIALI DI VENDITA",
  "PERSONALE",
  "DELIVERY E TAKE AWAY",
  "OCCUPAZIONE E STRUTTURA",
  "UTENZE",
  "MANUTENZIONI E ASSISTENZA",
  "SERVIZI DIGITALI E SOFTWARE",
  "CONSULENZE E SERVIZI PROFESSIONALI",
  "MARKETING E PUBBLICITA'",
  "SPESE OPERATIVE DI SALA E CUCINA",
  "SPESE GENERALI E AMMINISTRATIVE",
  "IMPOSTE, TRIBUTI, DIRITTI E CANONI",
  "ONERI FINANZIARI E BANCARI",
  "COSTI STRAORDINARI O NON RICORRENTI",
  "AMMORTAMENTI E CANONI BENI STRUMENTALI",
];