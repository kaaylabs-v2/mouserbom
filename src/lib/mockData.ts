export type Lifecycle = "active" | "nrnd" | "obsolete";
export type ParsedInput = {
  mpn?: string;
  description?: string;
  value?: string;
  tolerance?: string;
  voltage_rating?: string;
  reference_designators?: string[];
};
export type NormalizedInput = {
  value?: string;
  tolerance?: string;
  voltage_rating?: string;
  reference_designators?: string[];
};
export type Diagnostics = { reasons: string[]; next_actions: string[] };
export type ResultRow = {
  n: number;
  sku: string;
  mpn: string;
  mfr: string;
  pkg: string;
  price: number | null;
  stock: number | null;
  alts: number;
  confidence: number;
  rationale: string;
  lifecycle: Lifecycle;
  qty: number;
  alternatives: AltRow[];
  raw: { description: string; mpn: string; qty: number };
  input: ParsedInput;
  normalized?: NormalizedInput;
  diagnostics?: Diagnostics;
};
export type AltRow = {
  sku: string;
  mpn: string;
export type AltRow = {
  sku: string;
  mpn: string;
  mfr: string;
  pkg: string;
  price: number;
  stock: number;
  match: { pkg: boolean; tol: boolean; voltage: boolean };
  rationale: string;
  tradeoff_note?: string;
};

const altSeed = (mpn: string, mfr: string, pkg: string, basePrice: number): AltRow[] => [
  { sku: mpn + "-A1", mpn: mpn.replace(/.$/, "X"), mfr, pkg, price: +(basePrice * 0.96).toFixed(2), stock: 8400, match: { pkg: true, tol: true, voltage: true }, rationale: "Same family. -4% price. Active lifecycle.", tradeoff_note: "Cheaper, same family" },
  { sku: mpn + "-B2", mpn: mpn.replace(/.$/, "Y"), mfr, pkg, price: +(basePrice * 1.05).toFixed(2), stock: 1200, match: { pkg: true, tol: true, voltage: false }, rationale: "Tighter tolerance grade. +5% price.", tradeoff_note: "Tighter tolerance, slightly pricier" },
  { sku: mpn + "-C3", mpn: mpn.replace(/.$/, "Z"), mfr: mfr === "Murata" ? "TDK" : mfr, pkg, price: +(basePrice * 1.02).toFixed(2), stock: 24800, match: { pkg: true, tol: false, voltage: true }, rationale: "Alternate manufacturer. Higher stock.", tradeoff_note: "Same part, different manufacturer" },
];

};

const altSeed = (mpn: string, mfr: string, pkg: string, basePrice: number): AltRow[] => [
  { sku: mpn + "-A1", mpn: mpn.replace(/.$/, "X"), mfr, pkg, price: +(basePrice * 0.96).toFixed(2), stock: 8400, match: { pkg: true, tol: true, voltage: true }, rationale: "Same family. -4% price. Active lifecycle." },
  { sku: mpn + "-B2", mpn: mpn.replace(/.$/, "Y"), mfr, pkg, price: +(basePrice * 1.05).toFixed(2), stock: 1200, match: { pkg: true, tol: true, voltage: false }, rationale: "Tighter tolerance grade. +5% price." },
  { sku: mpn + "-C3", mpn: mpn.replace(/.$/, "Z"), mfr: mfr === "Murata" ? "TDK" : mfr, pkg, price: +(basePrice * 1.02).toFixed(2), stock: 24800, match: { pkg: true, tol: false, voltage: true }, rationale: "Alternate manufacturer. Higher stock." },
];

const baseSeed: Omit<ResultRow, "alternatives" | "raw" | "qty" | "lifecycle" | "input">[] = [
  { n: 1,  sku: "STM32F407VGT6",       mpn: "STM32F407VGT6",         mfr: "STMicroelectronics", pkg: "LQFP-100",       price: 8.42,  stock: 12480,  alts: 3, confidence: 0.96, rationale: "Exact MPN match. Attribute compatibility 100% (package, voltage, lifecycle: active)." },
  { n: 2,  sku: "TPS54360DDAR",        mpn: "TPS54360DDAR",          mfr: "Texas Instruments",  pkg: "SO PowerPAD-8",  price: 2.18,  stock: 4210,   alts: 3, confidence: 0.92, rationale: "Exact MPN match. Lifecycle active. Tier pricing available at qty 100+." },
  { n: 3,  sku: "LMK04828BISQ/NOPB",   mpn: "LMK04828BISQ/NOPB",     mfr: "Texas Instruments",  pkg: "WQFN-64",        price: 11.05, stock: 820,    alts: 3, confidence: 0.88, rationale: "Exact MPN match. Attribute compatibility 95%. Lead time within target." },
  { n: 4,  sku: "CRCW06031K00FKEA",    mpn: "CRCW0603-1K00-FKEA",    mfr: "Vishay Dale",        pkg: "0603",           price: 0.04,  stock: 250000, alts: 3, confidence: 0.99, rationale: "Normalized MPN to canonical form. Tolerance and package match exactly." },
  { n: 5,  sku: "GRM188R71H104KA93D",  mpn: "GRM188R71H104KA93D",    mfr: "Murata",             pkg: "0603",           price: 0.06,  stock: 0,      alts: 3, confidence: 0.74, rationale: "Out of stock; alternative C0603C104K5RACTU recommended at +0.0¢ price delta." },
  { n: 6,  sku: "no_match",            mpn: "(unresolved)",          mfr: "—",                  pkg: "—",              price: null,  stock: null,   alts: 0, confidence: 0.32, rationale: "Description too ambiguous; no candidate met the attribute threshold. Suggested action: confirm package and value." },
  { n: 7,  sku: "ATSAMD21G18A-AU",     mpn: "ATSAMD21G18A-AU",       mfr: "Microchip",          pkg: "TQFP-48",        price: 4.21,  stock: 8120,   alts: 3, confidence: 0.94, rationale: "Exact MPN match. Active lifecycle." },
  { n: 8,  sku: "LM358DR",             mpn: "LM358DR",               mfr: "Texas Instruments",  pkg: "SOIC-8",         price: 0.18,  stock: 96000,  alts: 3, confidence: 0.97, rationale: "Exact MPN. High availability." },
  { n: 9,  sku: "MCP2515-I/SO",        mpn: "MCP2515-I/SO",          mfr: "Microchip",          pkg: "SOIC-18",        price: 1.92,  stock: 2310,   alts: 3, confidence: 0.91, rationale: "Exact MPN. Industrial grade." },
  { n: 10, sku: "ESP32-WROOM-32E",     mpn: "ESP32-WROOM-32E",       mfr: "Espressif",          pkg: "Module",         price: 3.45,  stock: 14500,  alts: 3, confidence: 0.95, rationale: "Exact MPN. Active." },
  { n: 11, sku: "AD8307ARZ",           mpn: "AD8307ARZ",              mfr: "Analog Devices",     pkg: "SOIC-8",         price: 9.18,  stock: 612,    alts: 3, confidence: 0.83, rationale: "Exact MPN. Lower stock — review qty." },
  { n: 12, sku: "MAX3232ECPE+",        mpn: "MAX3232ECPE+",           mfr: "Analog Devices",     pkg: "DIP-16",         price: 2.05,  stock: 4400,   alts: 3, confidence: 0.79, rationale: "Package preference partial match. Recommend SOIC variant." },
  { n: 13, sku: "FT232RL-REEL",        mpn: "FT232RL-REEL",           mfr: "FTDI",               pkg: "SSOP-28",        price: 4.62,  stock: 7280,   alts: 3, confidence: 0.93, rationale: "Exact MPN. Active." },
  { n: 14, sku: "CDBU0530-HF",         mpn: "CDBU0530-HF",            mfr: "Comchip",            pkg: "0603",           price: 0.09,  stock: 38000,  alts: 3, confidence: 0.86, rationale: "Exact MPN. Volume pricing applied." },
  { n: 15, sku: "ABM8G-25.000MHZ-4Y",  mpn: "ABM8G-25.000MHZ-4Y-T3",  mfr: "Abracon",            pkg: "SMD-3225",       price: 0.42,  stock: 9100,   alts: 3, confidence: 0.81, rationale: "Normalized to canonical form. Frequency exact." },
  { n: 16, sku: "no_match",            mpn: "(unresolved)",           mfr: "—",                  pkg: "—",              price: null,  stock: null,   alts: 0, confidence: 0.41, rationale: "Description missing footprint. Confirm package." },
  { n: 17, sku: "TLV1117-33CDCYR",     mpn: "TLV1117-33CDCYR",        mfr: "Texas Instruments",  pkg: "SOT-223",        price: 0.38,  stock: 22100,  alts: 3, confidence: 0.96, rationale: "Exact MPN match." },
  { n: 18, sku: "MMBT3904LT1G",        mpn: "MMBT3904LT1G",           mfr: "onsemi",             pkg: "SOT-23",         price: 0.03,  stock: 480000, alts: 3, confidence: 0.99, rationale: "Exact MPN. Highest availability." },
  { n: 19, sku: "INA219AIDCNR",        mpn: "INA219AIDCNR",           mfr: "Texas Instruments",  pkg: "SOT-23-8",       price: 1.74,  stock: 6210,   alts: 3, confidence: 0.9,  rationale: "Exact MPN match. Tier pricing at 25+." },
  { n: 20, sku: "BSS138LT1G",          mpn: "BSS138LT1G",             mfr: "onsemi",             pkg: "SOT-23",         price: 0.06,  stock: 124000, alts: 3, confidence: 0.97, rationale: "Exact MPN. Active." },
  { n: 21, sku: "PESD5V0S1BA",         mpn: "PESD5V0S1BA",            mfr: "Nexperia",           pkg: "SOD-323",        price: 0.07,  stock: 84000,  alts: 3, confidence: 0.88, rationale: "Exact MPN. Active." },
  { n: 22, sku: "USB4110-GF-A",        mpn: "USB4110-GF-A",           mfr: "GCT",                pkg: "Through-Hole",   price: 0.62,  stock: 5400,   alts: 3, confidence: 0.78, rationale: "Connector match. Confirm orientation in artwork." },
  { n: 23, sku: "W25Q128JVSIQ",        mpn: "W25Q128JVSIQ",           mfr: "Winbond",            pkg: "SOIC-8",         price: 1.86,  stock: 17400,  alts: 3, confidence: 0.94, rationale: "Exact MPN match." },
  { n: 24, sku: "RC0805FR-0710KL",     mpn: "RC0805FR-0710KL",        mfr: "Yageo",              pkg: "0805",           price: 0.01,  stock: 612000, alts: 3, confidence: 0.99, rationale: "Exact MPN. Volume pricing." },
];

const inputBy: Record<number, ParsedInput> = {
  4:  { mpn: "CRCW0603-1K00-FKEA", value: "1k", tolerance: "1%" },
  5:  { mpn: "GRM188R71H104K", value: "100nF", voltage_rating: "50V" },
  6:  { description: "0603 — pull-up on RESET" },
  12: { description: "RS-232 transceiver, 5V", voltage_rating: "5V" },
  16: { description: "LDO 3.3V 1A" },
  17: { mpn: "TLV1117-3.3", voltage_rating: "3.3V" },
  22: { description: "USB-A connector through-hole" },
  24: { description: "10K 0805 1%", value: "10K", tolerance: "1%" },
};

const normalizedBy: Record<number, NormalizedInput> = {
  4:  { value: "1000Ω", tolerance: "1.0%" },
  17: { voltage_rating: "3.3V" },
  24: { value: "10000Ω", tolerance: "1.0%" },
};

const diagnosticsBy: Record<number, Diagnostics> = {
  6: {
    reasons: ["mpn_unresolved", "no_attribute_match", "candidate_set_empty"],
    next_actions: ["confirm_package", "provide_value", "attach_datasheet"],
  },
  16: {
    reasons: ["mpn_unresolved", "no_attribute_match"],
    next_actions: ["confirm_package", "provide_value"],
  },
};

export const seedRows: ResultRow[] = baseSeed.map((r) => ({
  ...r,
  qty: 50,
  lifecycle: r.confidence > 0.5 ? "active" : "obsolete",
  alternatives: r.alts ? altSeed(r.mpn, r.mfr === "—" ? "Generic" : r.mfr, r.pkg === "—" ? "0603" : r.pkg, r.price ?? 0.1) : [],
  raw: { description: `${r.mfr} ${r.pkg} ${r.mpn}`, mpn: r.mpn, qty: 50 },
  input: inputBy[r.n] ?? { mpn: r.mpn },
  normalized: normalizedBy[r.n],
  diagnostics: diagnosticsBy[r.n],
}));

// Dedicated dataset for "Try a sample BOM" — engineer-messy, 24 lines, ~85% match, ~$1,800 @ qty.
type SampleSpec = Omit<ResultRow, "qty" | "lifecycle" | "alternatives" | "raw">;
const sampleBase: SampleSpec[] = [
  { n: 1,  sku: "STM32G474RET6",     mpn: "STM32G474RET6",     mfr: "STMicroelectronics", pkg: "LQFP-64",  price: 6.84, stock: 8200,  alts: 3, confidence: 0.97, rationale: "Exact MPN match.",
    input: { mpn: "STM32G474RET6", reference_designators: ["U1"] } },
  { n: 2,  sku: "TPS62933PDRLR",     mpn: "TPS62933PDRLR",     mfr: "Texas Instruments",  pkg: "SOT-583",  price: 0.92, stock: 14200, alts: 3, confidence: 0.94, rationale: "Exact MPN.",
    input: { mpn: "TPS62933PDRLR", reference_designators: ["U2"] } },
  { n: 3,  sku: "ADP3335ACPZ-3.3",   mpn: "ADP3335ACPZ-3.3",   mfr: "Analog Devices",     pkg: "LFCSP-8",  price: 2.18, stock: 3100,  alts: 3, confidence: 0.91, rationale: "Exact MPN. 3.3V LDO.",
    input: { mpn: "ADP3335ACPZ-3.3", voltage_rating: "3.3V", reference_designators: ["U3"] } },
  { n: 4,  sku: "RC0805FR-0710KL",   mpn: "RC0805FR-0710KL",   mfr: "Yageo",              pkg: "0805",     price: 0.01, stock: 612000, alts: 3, confidence: 0.99, rationale: "Normalized engineer shorthand → canonical MPN.",
    input: { description: "10K 0805 1%", value: "10K", tolerance: "1%", reference_designators: ["R1","R2","R3","R4"] },
    normalized: { value: "10000Ω", tolerance: "1.0%" } },
  { n: 5,  sku: "GRM188R71H104KA93D",mpn: "GRM188R71H104KA93D",mfr: "Murata",             pkg: "0603",     price: 0.06, stock: 240000, alts: 3, confidence: 0.96, rationale: "Exact MPN.",
    input: { mpn: "GRM188R71H104KA93D", value: "100nF", voltage_rating: "50V", reference_designators: ["C1","C2","C3","C4","C5"] } },
  { n: 6,  sku: "GRM31CR61E226KE15L",mpn: "GRM31CR61E226KE15L",mfr: "Murata",             pkg: "1206",     price: 0.31, stock: 92000,  alts: 3, confidence: 0.93, rationale: "Exact MPN.",
    input: { mpn: "GRM31CR61E226KE15L", value: "22µF", voltage_rating: "25V", reference_designators: ["C6","C7"] } },
  { n: 7,  sku: "ERJ-3EKF4701V",     mpn: "ERJ-3EKF4701V",     mfr: "Panasonic",          pkg: "0603",     price: 0.02, stock: 480000, alts: 3, confidence: 0.95, rationale: "Engineer-messy refdes range expanded; value 4k7 normalized to 4700Ω.",
    input: { mpn: "ERJ-3EKF4701V", value: "4k7", tolerance: "1%", reference_designators: ["R5","R6","R7"] },
    normalized: { value: "4700Ω", tolerance: "1.0%" } },
  { n: 8,  sku: "LM358DR",           mpn: "LM358DR",           mfr: "Texas Instruments",  pkg: "SOIC-8",   price: 0.18, stock: 96000,  alts: 3, confidence: 0.97, rationale: "Exact MPN.",
    input: { mpn: "LM358DR", reference_designators: ["U4"] } },
  { n: 9,  sku: "INA219AIDCNR",      mpn: "INA219AIDCNR",      mfr: "Texas Instruments",  pkg: "SOT-23-8", price: 1.74, stock: 6210,   alts: 3, confidence: 0.92, rationale: "Exact MPN.",
    input: { mpn: "INA219AIDCNR", reference_designators: ["U5"] } },
  { n: 10, sku: "AP2112K-3.3TRG1",   mpn: "AP2112K-3.3TRG1",   mfr: "Diodes Inc",         pkg: "SOT-25",   price: 0.36, stock: 41000,  alts: 3, confidence: 0.89, rationale: "Exact MPN. 3.3V LDO.",
    input: { mpn: "AP2112K-3.3TRG1", voltage_rating: "3.3V", reference_designators: ["U6"] } },
  { n: 11, sku: "BSS138LT1G",        mpn: "BSS138LT1G",        mfr: "onsemi",             pkg: "SOT-23",   price: 0.06, stock: 124000, alts: 3, confidence: 0.96, rationale: "Exact MPN.",
    input: { mpn: "BSS138LT1G", reference_designators: ["Q1","Q2"] } },
  { n: 12, sku: "PESD5V0S1BA",       mpn: "PESD5V0S1BA",       mfr: "Nexperia",           pkg: "SOD-323",  price: 0.07, stock: 84000,  alts: 3, confidence: 0.88, rationale: "Exact MPN.",
    input: { mpn: "PESD5V0S1BA", voltage_rating: "5V", reference_designators: ["D1","D2"] } },
  { n: 13, sku: "no_match",          mpn: "(unresolved)",      mfr: "—",                  pkg: "—",        price: null, stock: null,   alts: 0, confidence: 0.31, rationale: "Description ambiguous; no candidate met the attribute threshold.",
    input: { description: "0603 — pull-up on RESET", reference_designators: ["R8"] },
    diagnostics: {
      reasons: ["mpn_unresolved", "no_attribute_match", "candidate_set_empty"],
      next_actions: ["confirm_package", "provide_value", "attach_datasheet"],
    } },
  { n: 14, sku: "ABM8G-25.000MHZ-4Y",mpn: "ABM8G-25.000MHZ-4Y-T3",mfr: "Abracon",         pkg: "SMD-3225", price: 0.42, stock: 9100,   alts: 3, confidence: 0.86, rationale: "Normalized to canonical MPN.",
    input: { description: "25MHz xtal SMD", value: "25MHz", reference_designators: ["Y1"] },
    normalized: { value: "25.000MHz" } },
  { n: 15, sku: "W25Q128JVSIQ",      mpn: "W25Q128JVSIQ",      mfr: "Winbond",            pkg: "SOIC-8",   price: 1.86, stock: 17400,  alts: 3, confidence: 0.95, rationale: "Exact MPN.",
    input: { mpn: "W25Q128JVSIQ", reference_designators: ["U7"] } },
  { n: 16, sku: "ESP32-WROOM-32E",   mpn: "ESP32-WROOM-32E",   mfr: "Espressif",          pkg: "Module",   price: 3.45, stock: 14500,  alts: 3, confidence: 0.96, rationale: "Exact MPN.",
    input: { mpn: "ESP32-WROOM-32E", reference_designators: ["U8"] } },
  { n: 17, sku: "FT232RL-REEL",      mpn: "FT232RL-REEL",      mfr: "FTDI",               pkg: "SSOP-28",  price: 4.62, stock: 7280,   alts: 3, confidence: 0.93, rationale: "Exact MPN.",
    input: { mpn: "FT232RL-REEL", reference_designators: ["U9"] } },
  { n: 18, sku: "MMBT3904LT1G",      mpn: "MMBT3904LT1G",      mfr: "onsemi",             pkg: "SOT-23",   price: 0.03, stock: 480000, alts: 3, confidence: 0.99, rationale: "Exact MPN.",
    input: { mpn: "MMBT3904LT1G", reference_designators: ["Q3","Q4","Q5"] } },
  { n: 19, sku: "TLV1117-33CDCYR",   mpn: "TLV1117-33CDCYR",   mfr: "Texas Instruments",  pkg: "SOT-223",  price: 0.38, stock: 22100,  alts: 3, confidence: 0.93, rationale: "Normalized engineer shorthand to canonical MPN.",
    input: { mpn: "TLV1117-3.3", voltage_rating: "3.3V", reference_designators: ["U10"] },
    normalized: { voltage_rating: "3.3V" } },
  { n: 20, sku: "USB4110-GF-A",      mpn: "USB4110-GF-A",      mfr: "GCT",                pkg: "Through-Hole", price: 0.62, stock: 5400, alts: 3, confidence: 0.78, rationale: "Connector match.",
    input: { description: "USB-A connector through-hole", reference_designators: ["J1"] } },
  { n: 21, sku: "CDBU0530-HF",       mpn: "CDBU0530-HF",       mfr: "Comchip",            pkg: "0603",     price: 0.09, stock: 38000,  alts: 3, confidence: 0.87, rationale: "Exact MPN.",
    input: { mpn: "CDBU0530-HF", reference_designators: ["D3","D4"] } },
  { n: 22, sku: "MCP2515-I/SO",      mpn: "MCP2515-I/SO",      mfr: "Microchip",          pkg: "SOIC-18",  price: 1.92, stock: 2310,   alts: 3, confidence: 0.91, rationale: "Exact MPN.",
    input: { mpn: "MCP2515-I/SO", reference_designators: ["U11"] } },
  { n: 23, sku: "ATSAMD21G18A-AU",   mpn: "ATSAMD21G18A-AU",   mfr: "Microchip",          pkg: "TQFP-48",  price: 4.21, stock: 8120,   alts: 3, confidence: 0.79, rationale: "Exact MPN. Secondary MCU footprint partial.",
    input: { mpn: "ATSAMD21G18A-AU", reference_designators: ["U12"] } },
  { n: 24, sku: "RC0603FR-074K7L",   mpn: "RC0603FR-074K7L",   mfr: "Yageo",              pkg: "0603",     price: 0.01, stock: 380000, alts: 3, confidence: 0.83, rationale: "Engineer shorthand value 4k7 normalized to 4700Ω.",
    input: { description: "4k7 0603", value: "4k7", tolerance: "1%", reference_designators: ["R9","R10"] },
    normalized: { value: "4700Ω", tolerance: "1.0%" } },
];

const sampleQty: Record<number, number> = {
  1: 5, 2: 10, 3: 10, 4: 200, 5: 100, 6: 50, 7: 200, 8: 20, 9: 25, 10: 25,
  11: 50, 12: 50, 13: 25, 14: 5, 15: 10, 16: 5, 17: 10, 18: 200,
  19: 10, 20: 5, 21: 50, 22: 10, 23: 5, 24: 200,
};

export const sampleRows: ResultRow[] = sampleBase.map((r) => ({
  ...r,
  qty: sampleQty[r.n] ?? 25,
  lifecycle: r.confidence > 0.5 ? "active" : "obsolete",
  alternatives: r.alts
    ? altSeed(r.mpn, r.mfr === "—" ? "Generic" : r.mfr, r.pkg === "—" ? "0603" : r.pkg, r.price ?? 0.1)
    : [],
  raw: { description: r.input.description ?? `${r.mfr} ${r.pkg} ${r.mpn}`, mpn: r.input.mpn ?? r.mpn, qty: sampleQty[r.n] ?? 25 },
}));

export type Job = {
  id: string;
  file: string;
  lines: number;
  status: "queued" | "processing" | "complete" | "partial" | "failed";
  matchRate: number | null;
  submitted: string; // ISO
};

const daysAgo = (d: number, h = 0) => new Date(Date.now() - d * 86400000 - h * 3600000).toISOString();

export const recentJobs: Job[] = [
  { id: "j_8x21", file: "GW-Reflow-RevC.xlsx",  lines: 184, status: "complete",  matchRate: 0.96, submitted: daysAgo(0, 2) },
  { id: "j_7p10", file: "MainBoard-v4.csv",     lines: 312, status: "partial",   matchRate: 0.83, submitted: daysAgo(1, 6) },
  { id: "j_6r88", file: "PowerStage.pdf",       lines: 47,  status: "complete",  matchRate: 0.99, submitted: daysAgo(2) },
  { id: "j_5w12", file: "SensorHub-prod.xlsx",  lines: 96,  status: "processing", matchRate: null, submitted: daysAgo(3, 4) },
  { id: "j_4t02", file: "RFI-quote-batch.csv",  lines: 612, status: "complete",  matchRate: 0.91, submitted: daysAgo(7) },
  { id: "j_3a99", file: "Legacy-RevA.pdf",      lines: 78,  status: "failed",    matchRate: null, submitted: daysAgo(11) },
];

export const stages = [
  "Ingest", "Parse", "Normalize", "Retrieve", "Rank", "Confidence", "Enrich", "Assemble"
] as const;
export type StageName = typeof stages[number];
