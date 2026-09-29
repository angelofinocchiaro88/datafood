// DATAFOOD - Calcolo costo del lavoro (costo azienda reale)

// Aliquote contributive standard (Italia, CCNL Pubblici Esercizi)
// Queste sono parametri configurabili; valori di default ragionati
export interface AliquoteConfig {
  inpsAziendaPct: number;      // INPS a carico azienda
  inpsDipendentePct: number;   // INPS a carico dipendente
  inailPct: number;            // INAIL (varia per settore, ristorazione ≈)
  tfrPct: number;              // TFR = lordo / 13.5 (~7.41%)
  irpefMediaPct: number;       // stima IRPEF (variabile per scaglione)
  rateoMensilitaPct: number;   // rateo 13a (1/13) o 13a+14a
  rateoFeriePct: number;       // rateo ferie (~1/12 del 26/12)
  rateoPermessiPct: number;    // rateo permessi ROL
}

export const DEFAULT_ALIQUOTE: AliquoteConfig = {
  inpsAziendaPct: 28.0,
  inpsDipendentePct: 9.19,
  inailPct: 1.7, // settore ristorazione (varia 0,5% - 5%)
  tfrPct: 7.41, // 1/13.5
  irpefMediaPct: 15.0, // stima su scaglione medio
  rateoMensilitaPct: 8.33, // 1/12 della 13a (o 16.67 se 14 mensilità)
  rateoFeriePct: 9.62, // ferie maturate circa 1/12 del 2.31/12 -> arrotondato
  rateoPermessiPct: 3.33, // permessi ROL
};

export interface CostoPersonaInput {
  retribuzioneLorda: number;
  straordinari?: number;
  indennita?: number;
  mensilita?: number; // 13 o 14
  aliquote?: AliquoteConfig;
}

export interface CostoPersonaOutput {
  retribuzioneLorda: number;      // lordo mensile
  imponibileInps: number;         // base contributiva (lordo + straordinari + indennità)
  contributiAzienda: number;      // INPS a carico azienda
  inailAzienda: number;           // INAIL
  tfrMaturato: number;            // TFR accantonato
  rateoTredicesima: number;
  rateoQuattordicesima: number;
  rateiFerie: number;
  rateiPermessi: number;
  totaleRateiDifferiti: number;   // ratei + TFR (costi non liquidati subito)
  contributiDipendente: number;   // INPS a carico dipendente
  irpef: number;
  nettoDipendente: number;        // netto in busta
  costoAziendaMensile: number;    // costo totale azienda/mese
  costoAziendaAnnuale: number;
  rapportoCostoLordo: number;     // moltiplicatore costo azienda / lordo
}

export function calcolaCostoPersona(input: CostoPersonaInput): CostoPersonaOutput {
  const a = input.aliquote || DEFAULT_ALIQUOTE;
  const mensilita = input.mensilita || 13;

  const lordo = input.retribuzioneLorda;
  const straordinari = input.straordinari || 0;
  const indennita = input.indennita || 0;
  const imponibile = lordo + straordinari + indennita;

  // Contributi
  const contributiAzienda = imponibile * (a.inpsAziendaPct / 100);
  const inail = imponibile * (a.inailPct / 100);

  // TFR = imponibile / 13.5 (~7.41% dell'imponibile)
  const tfr = imponibile * (a.tfrPct / 100);

  // Ratei mensilità aggiuntive
  const rateoTredicesima = imponibile / 12;
  const rateoQuattordicesima = mensilita >= 14 ? imponibile / 12 : 0;

  // Ratei ferie e permessi (accantonamento per non goduti)
  const rateiFerie = imponibile * (a.rateoFeriePct / 100);
  const rateiPermessi = imponibile * (a.rateoPermessiPct / 100);

  const totaleDifferiti = tfr + rateoTredicesima + rateoQuattordicesima + rateiFerie + rateiPermessi;

  // Trattenute dipendente
  const contributiDipendente = imponibile * (a.inpsDipendentePct / 100);
  const irpef = lordo * (a.irpefMediaPct / 100);
  const netto = lordo - contributiDipendente - irpef;

  // Costo azienda mensile
  const costoAziendaMensile = imponibile + contributiAzienda + inail + totaleDifferiti;

  return {
    retribuzioneLorda: round2(lordo),
    imponibileInps: round2(imponibile),
    contributiAzienda: round2(contributiAzienda),
    inailAzienda: round2(inail),
    tfrMaturato: round2(tfr),
    rateoTredicesima: round2(rateoTredicesima),
    rateoQuattordicesima: round2(rateoQuattordicesima),
    rateiFerie: round2(rateiFerie),
    rateiPermessi: round2(rateiPermessi),
    totaleRateiDifferiti: round2(totaleDifferiti),
    contributiDipendente: round2(contributiDipendente),
    irpef: round2(irpef),
    nettoDipendente: round2(netto),
    costoAziendaMensile: round2(costoAziendaMensile),
    costoAziendaAnnuale: round2(costoAziendaMensile * 12),
    rapportoCostoLordo: round2(costoAziendaMensile / (lordo || 1)),
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}