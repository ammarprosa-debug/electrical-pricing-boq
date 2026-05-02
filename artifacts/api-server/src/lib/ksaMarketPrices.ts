/**
 * KSA Electrical & MEP Market Price Database
 * Source: Saudi Arabia construction market 2024-2025
 * Prices in SAR, ex-VAT, supply only (no installation)
 * Updated: Q1 2025
 */

export interface MarketItem {
  keywords: string[];                 // Match keywords (English/Arabic)
  unit: string;                       // LS. or NO. or m or m2
  supplyMin: number;                  // SAR – economical (Chinese/local)
  supplyStd: number;                  // SAR – standard (European mid-range)
  supplyPremium: number;              // SAR – premium (EU branded)
  brands: string;                     // Recommended brands
  brandAr: string;                    // Arabic brand note
  descAr: string;                     // Arabic description
  category: string;
  wastage?: number;                   // % wastage (default 1%)
}

export const KSA_MARKET_PRICES: MarketItem[] = [

  // ══════════════════════════════════════════════
  //  CABLES & WIRING (كابلات وأسلاك)
  // ══════════════════════════════════════════════
  { keywords: ["cable 1.5mm","wire 1.5","1.5 mm2","1×1.5","2×1.5","3×1.5"], unit: "m", supplyMin: 2.8, supplyStd: 4.2, supplyPremium: 6.5, brands: "Saudi Cable / Prysmian / Nexans", brandAr: "كابل سعودي / برايسميان", descAr: "كابل نحاسي 1.5 مم²", category: "Cables & Wiring", wastage: 5 },
  { keywords: ["cable 2.5mm","wire 2.5","2.5 mm2","1×2.5","2×2.5","3×2.5"], unit: "m", supplyMin: 4.0, supplyStd: 6.5, supplyPremium: 9.0, brands: "Saudi Cable / Prysmian / Nexans", brandAr: "كابل سعودي / برايسميان", descAr: "كابل نحاسي 2.5 مم²", category: "Cables & Wiring", wastage: 5 },
  { keywords: ["cable 4mm","wire 4","4 mm2","1×4","2×4","3×4"], unit: "m", supplyMin: 6.0, supplyStd: 9.5, supplyPremium: 13.5, brands: "Saudi Cable / Prysmian", brandAr: "كابل سعودي", descAr: "كابل نحاسي 4 مم²", category: "Cables & Wiring", wastage: 5 },
  { keywords: ["cable 6mm","wire 6","6 mm2","1×6","3×6","4×6"], unit: "m", supplyMin: 8.5, supplyStd: 14.0, supplyPremium: 20.0, brands: "Saudi Cable / Nexans / Prysmian", brandAr: "كابل سعودي / نيكسانس", descAr: "كابل نحاسي 6 مم²", category: "Cables & Wiring", wastage: 5 },
  { keywords: ["cable 10mm","10 mm2","3×10","4×10","5×10"], unit: "m", supplyMin: 14.0, supplyStd: 22.0, supplyPremium: 32.0, brands: "Saudi Cable / Nexans", brandAr: "كابل سعودي", descAr: "كابل نحاسي 10 مم²", category: "Cables & Wiring", wastage: 3 },
  { keywords: ["cable 16mm","16 mm2","3×16","4×16","5×16"], unit: "m", supplyMin: 22.0, supplyStd: 35.0, supplyPremium: 50.0, brands: "Saudi Cable / Prysmian", brandAr: "كابل سعودي", descAr: "كابل نحاسي 16 مم²", category: "Cables & Wiring", wastage: 3 },
  { keywords: ["cable 25mm","25 mm2","3×25","4×25","5×25"], unit: "m", supplyMin: 33.0, supplyStd: 55.0, supplyPremium: 78.0, brands: "Saudi Cable / Nexans", brandAr: "كابل سعودي", descAr: "كابل نحاسي 25 مم²", category: "Cables & Wiring", wastage: 3 },
  { keywords: ["cable 35mm","35 mm2","3×35","4×35","5×35"], unit: "m", supplyMin: 45.0, supplyStd: 75.0, supplyPremium: 108.0, brands: "Saudi Cable / Nexans", brandAr: "كابل سعودي", descAr: "كابل نحاسي 35 مم²", category: "Cables & Wiring", wastage: 3 },
  { keywords: ["cable 50mm","50 mm2","3×50","4×50"], unit: "m", supplyMin: 62.0, supplyStd: 105.0, supplyPremium: 150.0, brands: "Saudi Cable / Prysmian", brandAr: "كابل سعودي", descAr: "كابل نحاسي 50 مم²", category: "Cables & Wiring", wastage: 2 },
  { keywords: ["cable 70mm","70 mm2","3×70","4×70"], unit: "m", supplyMin: 88.0, supplyStd: 145.0, supplyPremium: 210.0, brands: "Saudi Cable / Nexans", brandAr: "كابل سعودي", descAr: "كابل نحاسي 70 مم²", category: "Cables & Wiring", wastage: 2 },
  { keywords: ["cable 95mm","95 mm2","3×95","4×95"], unit: "m", supplyMin: 115.0, supplyStd: 195.0, supplyPremium: 280.0, brands: "Saudi Cable / Prysmian", brandAr: "كابل سعودي", descAr: "كابل نحاسي 95 مم²", category: "Cables & Wiring", wastage: 2 },
  { keywords: ["cable 120mm","120 mm2","3×120","4×120"], unit: "m", supplyMin: 148.0, supplyStd: 250.0, supplyPremium: 360.0, brands: "Saudi Cable / Nexans", brandAr: "كابل سعودي", descAr: "كابل نحاسي 120 مم²", category: "Cables & Wiring", wastage: 2 },
  { keywords: ["cable 150mm","150 mm2","3×150"], unit: "m", supplyMin: 185.0, supplyStd: 310.0, supplyPremium: 445.0, brands: "Saudi Cable", brandAr: "كابل سعودي", descAr: "كابل نحاسي 150 مم²", category: "Cables & Wiring", wastage: 2 },
  { keywords: ["cable 185mm","185 mm2","3×185"], unit: "m", supplyMin: 228.0, supplyStd: 385.0, supplyPremium: 550.0, brands: "Saudi Cable", brandAr: "كابل سعودي", descAr: "كابل نحاسي 185 مم²", category: "Cables & Wiring", wastage: 2 },
  { keywords: ["cable 240mm","240 mm2","3×240"], unit: "m", supplyMin: 295.0, supplyStd: 498.0, supplyPremium: 720.0, brands: "Saudi Cable / Nexans", brandAr: "كابل سعودي", descAr: "كابل نحاسي 240 مم²", category: "Cables & Wiring", wastage: 2 },
  { keywords: ["cable 300mm","300 mm2","3×300"], unit: "m", supplyMin: 365.0, supplyStd: 620.0, supplyPremium: 890.0, brands: "Saudi Cable", brandAr: "كابل سعودي", descAr: "كابل نحاسي 300 مم²", category: "Cables & Wiring", wastage: 2 },
  { keywords: ["armoured cable","swa","xlpe","armored","مدرع"], unit: "m", supplyMin: 12.0, supplyStd: 22.0, supplyPremium: 35.0, brands: "Saudi Cable / Prysmian / Nexans", brandAr: "كابل مدرع سعودي", descAr: "كابل مدرع XLPE/SWA", category: "Cables & Wiring", wastage: 2 },
  { keywords: ["fire rated cable","fire resistant","lszh","frc","lsf","halogen"], unit: "m", supplyMin: 8.5, supplyStd: 14.0, supplyPremium: 22.0, brands: "Prysmian / Nexans / Saudi Cable", brandAr: "برايسميان / نيكسانس", descAr: "كابل مقاوم للحريق LSZH", category: "Cables & Wiring", wastage: 5 },
  { keywords: ["cat6","cat 6","utp","ftp","data cable","network cable"], unit: "m", supplyMin: 3.5, supplyStd: 5.5, supplyPremium: 9.0, brands: "Systimax / Panduit / Siemon / FINOSEL", brandAr: "سيستيماكس / فينوسل", descAr: "كابل داتا Cat6 UTP", category: "Data & Network", wastage: 5 },
  { keywords: ["cat6a","cat 6a","10gbe","augmented"], unit: "m", supplyMin: 5.5, supplyStd: 9.0, supplyPremium: 15.0, brands: "Systimax / Panduit / Siemon", brandAr: "سيستيماكس / باندويت", descAr: "كابل داتا Cat6A", category: "Data & Network", wastage: 5 },
  { keywords: ["fiber optic","fibre","fo cable","optical fiber","ألياف ضوئية"], unit: "m", supplyMin: 6.0, supplyStd: 10.0, supplyPremium: 18.0, brands: "Corning / Prysmian / FINOSEL", brandAr: "كورنينج / فينوسل", descAr: "كابل ألياف ضوئية", category: "Data & Network", wastage: 3 },
  { keywords: ["coaxial cable","coax","rg6","cctv cable","camera cable"], unit: "m", supplyMin: 2.5, supplyStd: 4.0, supplyPremium: 7.0, brands: "Belden / CommScope / Generic", brandAr: "بيلدن / جنيريك", descAr: "كابل كواكسيال CCTV", category: "CCTV & Security", wastage: 5 },

  // ══════════════════════════════════════════════
  //  CONDUITS & TRUNKING (مواسير وقنوات)
  // ══════════════════════════════════════════════
  { keywords: ["conduit 20mm","pvc conduit","ماسورة 20","pipe 20"], unit: "m", supplyMin: 1.8, supplyStd: 2.8, supplyPremium: 4.5, brands: "Crabtree / Legrand / OBO / Generic", brandAr: "كرابتري / ليجراند / عام", descAr: "ماسورة PVC 20 مم", category: "Conduits & Trunking", wastage: 8 },
  { keywords: ["conduit 25mm","pvc 25","ماسورة 25","pipe 25"], unit: "m", supplyMin: 2.5, supplyStd: 3.8, supplyPremium: 6.0, brands: "Crabtree / Legrand / Generic", brandAr: "كرابتري / ليجراند", descAr: "ماسورة PVC 25 مم", category: "Conduits & Trunking", wastage: 8 },
  { keywords: ["conduit 32mm","pvc 32","ماسورة 32","pipe 32"], unit: "m", supplyMin: 3.5, supplyStd: 5.2, supplyPremium: 8.0, brands: "Legrand / OBO / Generic", brandAr: "ليجراند / عام", descAr: "ماسورة PVC 32 مم", category: "Conduits & Trunking", wastage: 8 },
  { keywords: ["steel conduit","emi conduit","galvanised conduit","gi conduit","metal conduit"], unit: "m", supplyMin: 5.5, supplyStd: 9.0, supplyPremium: 14.0, brands: "Legrand / OBO / Generic", brandAr: "ليجراند / عام", descAr: "ماسورة فولاذية مجلفنة", category: "Conduits & Trunking", wastage: 5 },
  { keywords: ["cable tray","tray 100","tray 150","tray 200","tray 300","perforated tray","درج كابل"], unit: "m", supplyMin: 28.0, supplyStd: 45.0, supplyPremium: 70.0, brands: "Legrand / Niedax / OBO / Generic", brandAr: "ليجراند / نيداكس", descAr: "درج كابلات مثقب مجلفن", category: "Conduits & Trunking", wastage: 3 },
  { keywords: ["cable ladder","ladder tray","سلم كابل"], unit: "m", supplyMin: 45.0, supplyStd: 70.0, supplyPremium: 105.0, brands: "Legrand / Niedax / OBO", brandAr: "ليجراند / نيداكس", descAr: "سلم كابلات مجلفن", category: "Conduits & Trunking", wastage: 3 },
  { keywords: ["trunking","dado trunking","floor trunking","trunk 100","trunk 150","قناة كابل"], unit: "m", supplyMin: 22.0, supplyStd: 38.0, supplyPremium: 60.0, brands: "Legrand / Hager / OBO", brandAr: "ليجراند / هاجر", descAr: "قناة تمديد كابلات", category: "Conduits & Trunking", wastage: 3 },
  { keywords: ["flexible conduit","corrugated","flexible pipe","مرنة"], unit: "m", supplyMin: 3.0, supplyStd: 5.0, supplyPremium: 8.0, brands: "Flexa / Legrand / Generic", brandAr: "فليكسا / ليجراند", descAr: "ماسورة مرنة مموجة", category: "Conduits & Trunking", wastage: 10 },

  // ══════════════════════════════════════════════
  //  WIRING DEVICES (مفاتيح ومقابس)
  // ══════════════════════════════════════════════
  { keywords: ["single socket","13a socket","1 gang socket","مقبس مفرد","بريزة مفردة"], unit: "NO.", supplyMin: 18.0, supplyStd: 35.0, supplyPremium: 85.0, brands: "Legrand / Schneider / ABB / Crabtree", brandAr: "ليجراند / شنايدر / ABB", descAr: "مقبس أحادي 13 أمبير", category: "Wiring Devices" },
  { keywords: ["double socket","twin socket","2 gang socket","مقبس مزدوج","بريزة مزدوجة"], unit: "NO.", supplyMin: 22.0, supplyStd: 45.0, supplyPremium: 110.0, brands: "Legrand / Schneider / ABB / Crabtree", brandAr: "ليجراند / شنايدر / ABB", descAr: "مقبس مزدوج 13 أمبير", category: "Wiring Devices" },
  { keywords: ["1 gang switch","single switch","مفتاح مفرد"], unit: "NO.", supplyMin: 12.0, supplyStd: 22.0, supplyPremium: 65.0, brands: "Legrand / Schneider / ABB / Crabtree", brandAr: "ليجراند / شنايدر", descAr: "مفتاح إضاءة أحادي", category: "Wiring Devices" },
  { keywords: ["2 gang switch","double switch","مفتاح مزدوج"], unit: "NO.", supplyMin: 16.0, supplyStd: 28.0, supplyPremium: 78.0, brands: "Legrand / Schneider / ABB", brandAr: "ليجراند / شنايدر", descAr: "مفتاح إضاءة مزدوج", category: "Wiring Devices" },
  { keywords: ["3 gang switch","triple switch","مفتاح ثلاثي"], unit: "NO.", supplyMin: 20.0, supplyStd: 35.0, supplyPremium: 92.0, brands: "Legrand / Schneider / ABB", brandAr: "ليجراند / شنايدر", descAr: "مفتاح إضاءة ثلاثي", category: "Wiring Devices" },
  { keywords: ["dimmer switch","dimmer","مخفت ضوء"], unit: "NO.", supplyMin: 45.0, supplyStd: 95.0, supplyPremium: 220.0, brands: "Legrand / Schneider / ABB / Lutron", brandAr: "ليجراند / ليوترون", descAr: "مفتاح تخفيت إضاءة", category: "Wiring Devices" },
  { keywords: ["data socket","rj45","data outlet","نقطة داتا","مقبس داتا"], unit: "NO.", supplyMin: 35.0, supplyStd: 65.0, supplyPremium: 135.0, brands: "Panduit / Systimax / Legrand / FINOSEL", brandAr: "باندويت / سيستيماكس", descAr: "مقبس داتا RJ45 Cat6", category: "Data & Network" },
  { keywords: ["tv socket","tv outlet","مقبس تلفزيون","antenna socket"], unit: "NO.", supplyMin: 25.0, supplyStd: 45.0, supplyPremium: 95.0, brands: "Legrand / Schneider / Generic", brandAr: "ليجراند / شنايدر", descAr: "مقبس هوائي تلفزيون", category: "Wiring Devices" },
  { keywords: ["ac isolator","ac switch","ac disconnect","قاطع مكيف"], unit: "NO.", supplyMin: 55.0, supplyStd: 95.0, supplyPremium: 165.0, brands: "Legrand / Schneider / ABB / Hager", brandAr: "ليجراند / شنايدر / ABB", descAr: "قاطع مكيف هواء مقاوم للماء", category: "Wiring Devices" },
  { keywords: ["floor box","floor socket","floor outlet","علبة أرضية","مقبس أرضي"], unit: "NO.", supplyMin: 185.0, supplyStd: 320.0, supplyPremium: 650.0, brands: "Legrand / OBO / Wiremold", brandAr: "ليجراند / OBO", descAr: "علبة أرضية كهربائية", category: "Wiring Devices" },

  // ══════════════════════════════════════════════
  //  LIGHTING (إضاءة)
  // ══════════════════════════════════════════════
  { keywords: ["led downlight","downlight led","spot light","spotled","led spot","بقسبوت"], unit: "NO.", supplyMin: 35.0, supplyStd: 75.0, supplyPremium: 185.0, brands: "Philips / Osram / Havells / Generic", brandAr: "فيليبس / أوسرام / هافيلز", descAr: "ليد داونلايت مدمج", category: "Lighting" },
  { keywords: ["led panel","panel light","led panel 600","led panel 1200","60×60","120×60"], unit: "NO.", supplyMin: 65.0, supplyStd: 145.0, supplyPremium: 380.0, brands: "Philips / Osram / Cree / Havells", brandAr: "فيليبس / أوسرام / كري", descAr: "لوح LED مربع", category: "Lighting" },
  { keywords: ["led linear","linear led","led tube","tube light","أنبوب led"], unit: "NO.", supplyMin: 28.0, supplyStd: 55.0, supplyPremium: 130.0, brands: "Philips / Osram / Havells", brandAr: "فيليبس / أوسرام", descAr: "مصباح LED خطي", category: "Lighting" },
  { keywords: ["led strip","strip light","tape light","شريط led"], unit: "m", supplyMin: 18.0, supplyStd: 35.0, supplyPremium: 75.0, brands: "Philips / Osram / Havells / Generic", brandAr: "فيليبس / أوسرام", descAr: "شريط إضاءة LED", category: "Lighting" },
  { keywords: ["led high bay","high bay","warehouse light","مستودع ضوء"], unit: "NO.", supplyMin: 185.0, supplyStd: 350.0, supplyPremium: 750.0, brands: "Philips / Cree / Havells", brandAr: "فيليبس / كري", descAr: "كشاف LED صناعي high bay", category: "Lighting" },
  { keywords: ["flood light","floodlight","projector light","كشاف خارجي"], unit: "NO.", supplyMin: 95.0, supplyStd: 195.0, supplyPremium: 450.0, brands: "Philips / Osram / Havells", brandAr: "فيليبس / أوسرام", descAr: "كشاف إضاءة خارجي LED", category: "Lighting" },
  { keywords: ["street light","street lamp","أعمدة إضاءة","street luminaire"], unit: "NO.", supplyMin: 450.0, supplyStd: 850.0, supplyPremium: 1800.0, brands: "Philips / Osram / Havells", brandAr: "فيليبس / أوسرام", descAr: "مصباح طريق LED", category: "Lighting" },
  { keywords: ["emergency light","exit light","مصباح طوارئ","emergency fitting"], unit: "NO.", supplyMin: 65.0, supplyStd: 135.0, supplyPremium: 310.0, brands: "Schneider / Legrand / Philips / Beghelli", brandAr: "شنايدر / ليجراند / فيليبس", descAr: "مصباح طوارئ مع بطارية", category: "Lighting" },
  { keywords: ["exit sign","exit signage","لافتة مخرج"], unit: "NO.", supplyMin: 55.0, supplyStd: 110.0, supplyPremium: 250.0, brands: "Schneider / Legrand / Philips", brandAr: "شنايدر / ليجراند", descAr: "لافتة مخرج طوارئ", category: "Lighting" },

  // ══════════════════════════════════════════════
  //  PROTECTION DEVICES (أجهزة حماية)
  // ══════════════════════════════════════════════
  { keywords: ["mcb 6a","mcb 10a","mcb 16a","mcb 20a","mcb single","miniature circuit breaker","قاطع صغير"], unit: "NO.", supplyMin: 18.0, supplyStd: 38.0, supplyPremium: 85.0, brands: "Schneider / ABB / Hager / Legrand", brandAr: "شنايدر / ABB / هاجر", descAr: "قاطع MCB أحادي", category: "Protection Devices" },
  { keywords: ["mcb 3 pole","mcb 3p","three pole mcb","mcb tp","قاطع ثلاثي صغير"], unit: "NO.", supplyMin: 55.0, supplyStd: 115.0, supplyPremium: 260.0, brands: "Schneider / ABB / Hager / Legrand", brandAr: "شنايدر / ABB / هاجر", descAr: "قاطع MCB ثلاثي الأوجه", category: "Protection Devices" },
  { keywords: ["mccb 100a","mccb 160a","mccb 250a","mccb 400a","moulded case","قاطع قالبي"], unit: "NO.", supplyMin: 350.0, supplyStd: 750.0, supplyPremium: 1800.0, brands: "Schneider / ABB / Siemens / Hager", brandAr: "شنايدر / ABB / سيمنز", descAr: "قاطع MCCB قالبي", category: "Protection Devices" },
  { keywords: ["rcd","rcbo","residual current","قاطع تسرب أرضي"], unit: "NO.", supplyMin: 85.0, supplyStd: 175.0, supplyPremium: 395.0, brands: "Schneider / ABB / Hager / Legrand", brandAr: "شنايدر / ABB / هاجر", descAr: "قاطع تيار متبقي RCD", category: "Protection Devices" },
  { keywords: ["surge protector","spd","surge suppressor","واقي موجة"], unit: "NO.", supplyMin: 150.0, supplyStd: 310.0, supplyPremium: 720.0, brands: "Schneider / ABB / Phoenix Contact / Dehn", brandAr: "شنايدر / ABB / فينيكس", descAr: "واقي زيادة ضغط SPD", category: "Protection Devices" },
  { keywords: ["fuse","fuse base","cartridge fuse","فيوز"], unit: "NO.", supplyMin: 8.0, supplyStd: 15.0, supplyPremium: 32.0, brands: "Schneider / ABB / Siemens / Generic", brandAr: "شنايدر / ABB / عام", descAr: "فيوز خرطوشة", category: "Protection Devices" },
  { keywords: ["contactor","24v coil","230v coil","كونتاكتور"], unit: "NO.", supplyMin: 65.0, supplyStd: 140.0, supplyPremium: 320.0, brands: "Schneider / ABB / Siemens / Eaton", brandAr: "شنايدر / ABB / سيمنز", descAr: "كونتاكتور مغناطيسي", category: "Protection Devices" },
  { keywords: ["timer","time switch","مؤقت كهربائي"], unit: "NO.", supplyMin: 45.0, supplyStd: 95.0, supplyPremium: 220.0, brands: "Schneider / Legrand / Hager / ABB", brandAr: "شنايدر / ليجراند / هاجر", descAr: "مؤقت كهربائي زمني", category: "Protection Devices" },

  // ══════════════════════════════════════════════
  //  PANELS & DISTRIBUTION (لوحات التوزيع)
  // ══════════════════════════════════════════════
  { keywords: ["distribution board","db","consumer unit","local panel","لوحة توزيع فرعية","لوحة محلية"], unit: "NO.", supplyMin: 450.0, supplyStd: 1200.0, supplyPremium: 3500.0, brands: "Schneider / ABB / Legrand / Hager", brandAr: "شنايدر / ABB / ليجراند", descAr: "لوحة توزيع كهربائية", category: "Panels & Distribution" },
  { keywords: ["main distribution board","mdb","main switchboard","لوحة توزيع رئيسية","لوحة رئيسية"], unit: "NO.", supplyMin: 3500.0, supplyStd: 9500.0, supplyPremium: 28000.0, brands: "Schneider / ABB / Siemens / Eaton", brandAr: "شنايدر / ABB / سيمنز", descAr: "لوحة توزيع رئيسية MDB", category: "Panels & Distribution" },
  { keywords: ["sub main board","smdb","sub distribution","لوحة توزيع فرعية رئيسية"], unit: "NO.", supplyMin: 1800.0, supplyStd: 4500.0, supplyPremium: 12000.0, brands: "Schneider / ABB / Legrand", brandAr: "شنايدر / ABB / ليجراند", descAr: "لوحة توزيع فرعية رئيسية SMDB", category: "Panels & Distribution" },
  { keywords: ["acb","air circuit breaker","قاطع هوائي 630a","قاطع هوائي 800a","قاطع هوائي 1000"], unit: "NO.", supplyMin: 4500.0, supplyStd: 9500.0, supplyPremium: 22000.0, brands: "Schneider / ABB / Siemens", brandAr: "شنايدر / ABB / سيمنز", descAr: "قاطع هوائي ACB", category: "Panels & Distribution" },
  { keywords: ["busbar","bus bar","busduct","bus duct","قضيب موصل","باصبار"], unit: "m", supplyMin: 450.0, supplyStd: 850.0, supplyPremium: 1800.0, brands: "Schneider / Eaton / Siemens", brandAr: "شنايدر / إيتون / سيمنز", descAr: "قضيب موصل busbar", category: "Panels & Distribution" },

  // ══════════════════════════════════════════════
  //  EARTHING & BONDING (تأريض)
  // ══════════════════════════════════════════════
  { keywords: ["earth rod","grounding rod","copper rod","تأريض","قضيب أرضي"], unit: "NO.", supplyMin: 55.0, supplyStd: 95.0, supplyPremium: 185.0, brands: "Furse / DEHN / Generic", brandAr: "فورس / دين / عام", descAr: "قضيب تأريض نحاسي", category: "Earthing & Bonding" },
  { keywords: ["earth bar","earthing terminal","copper bar","شريط تأريض"], unit: "NO.", supplyMin: 35.0, supplyStd: 65.0, supplyPremium: 135.0, brands: "Legrand / ABB / Generic", brandAr: "ليجراند / ABB / عام", descAr: "شريط توزيع التأريض", category: "Earthing & Bonding" },

  // ══════════════════════════════════════════════
  //  POWER SYSTEMS (أنظمة الطاقة)
  // ══════════════════════════════════════════════
  { keywords: ["ups","uninterruptible power","طاقة لا انقطاعية","ups 1kva","ups 2kva","ups 3kva","ups 5kva","ups 6kva"], unit: "NO.", supplyMin: 850.0, supplyStd: 1800.0, supplyPremium: 4500.0, brands: "APC / Eaton / Schneider / Huawei", brandAr: "APC / إيتون / شنايدر / هواوي", descAr: "نظام طاقة لا انقطاعية UPS", category: "Power Systems" },
  { keywords: ["ups 10kva","ups 15kva","ups 20kva","ups 30kva","ups 40kva"], unit: "NO.", supplyMin: 4500.0, supplyStd: 9500.0, supplyPremium: 22000.0, brands: "APC / Eaton / Schneider / Huawei", brandAr: "APC / إيتون / شنايدر", descAr: "نظام UPS عالي الطاقة", category: "Power Systems" },
  { keywords: ["battery","vrla battery","gel battery","بطارية","agm battery"], unit: "NO.", supplyMin: 180.0, supplyStd: 350.0, supplyPremium: 750.0, brands: "Exide / Trojan / Yuasa / Vision", brandAr: "إكسايد / تروجان / يواسا", descAr: "بطارية ختومة VRLA", category: "Power Systems" },
  { keywords: ["generator","genset","diesel generator","مولد كهربائي","مجموعة توليد"], unit: "NO.", supplyMin: 15000.0, supplyStd: 35000.0, supplyPremium: 85000.0, brands: "Cummins / Caterpillar / Perkins / FG Wilson", brandAr: "كامنز / كاتربيلر / بيركنز", descAr: "مجموعة مولد ديزل", category: "Power Systems" },
  { keywords: ["solar panel","pv panel","photovoltaic","لوح شمسي"], unit: "NO.", supplyMin: 450.0, supplyStd: 850.0, supplyPremium: 1800.0, brands: "LONGi / JA Solar / Canadian Solar / Huawei", brandAr: "لونجي / JA / كندين سولار", descAr: "لوح طاقة شمسية PV", category: "Power Systems" },
  { keywords: ["transformer","dry transformer","11kv transformer","33kv transformer","محول كهربائي"], unit: "NO.", supplyMin: 18000.0, supplyStd: 45000.0, supplyPremium: 110000.0, brands: "ABB / Schneider / Siemens / AREVA", brandAr: "ABB / شنايدر / سيمنز", descAr: "محول كهربائي", category: "Transformers" },

  // ══════════════════════════════════════════════
  //  FIRE ALARM SYSTEM (نظام إنذار الحريق)
  // ══════════════════════════════════════════════
  { keywords: ["fire alarm panel","fap","facp","لوحة إنذار حريق","main fire panel","fire control panel"], unit: "NO.", supplyMin: 3500.0, supplyStd: 8500.0, supplyPremium: 22000.0, brands: "Siemens / Honeywell / Johnson Controls / Bosch / Hochiki", brandAr: "سيمنز / هانيويل / جونسون / بوش", descAr: "لوحة تحكم نظام إنذار الحريق", category: "Fire Alarm" },
  { keywords: ["heat detector","fixed heat","rate of rise","كاشف حراري","حساس حرارة"], unit: "NO.", supplyMin: 55.0, supplyStd: 120.0, supplyPremium: 285.0, brands: "Hochiki / Notifier / Bosch / Apollo / Siemens", brandAr: "هوشيكي / نوتيفير / أبولو", descAr: "كاشف حراري", category: "Fire Alarm" },
  { keywords: ["smoke detector","optical detector","كاشف دخان","حساس دخان"], unit: "NO.", supplyMin: 65.0, supplyStd: 135.0, supplyPremium: 320.0, brands: "Hochiki / Notifier / Bosch / Apollo / Siemens", brandAr: "هوشيكي / نوتيفير / بوش / أبولو", descAr: "كاشف دخان بصري", category: "Fire Alarm" },
  { keywords: ["manual call point","call point","break glass","بوش إنذار يدوي","نقطة إنذار يدوية"], unit: "NO.", supplyMin: 55.0, supplyStd: 110.0, supplyPremium: 250.0, brands: "Hochiki / Notifier / Bosch / Apollo", brandAr: "هوشيكي / نوتيفير / بوش", descAr: "نقطة إنذار يدوية", category: "Fire Alarm" },
  { keywords: ["fire alarm sounder","sounder","bell fire","جرس إنذار","صوت إنذار"], unit: "NO.", supplyMin: 65.0, supplyStd: 130.0, supplyPremium: 295.0, brands: "Hochiki / Notifier / Bosch / Apollo", brandAr: "هوشيكي / بوش / أبولو", descAr: "جرس/صافرة إنذار حريق", category: "Fire Alarm" },
  { keywords: ["sounder strobe","strobe light","beacon fire","منارة إنذار حريق","ستروب"], unit: "NO.", supplyMin: 85.0, supplyStd: 175.0, supplyPremium: 395.0, brands: "Hochiki / Notifier / Apollo / Siemens", brandAr: "هوشيكي / نوتيفير / سيمنز", descAr: "منارة صوت وضوء للإنذار", category: "Fire Alarm" },
  { keywords: ["addressable module","input module","output module","zone module","وحدة عناوينية"], unit: "NO.", supplyMin: 125.0, supplyStd: 250.0, supplyPremium: 580.0, brands: "Hochiki / Notifier / Bosch / Apollo", brandAr: "هوشيكي / نوتيفير / بوش", descAr: "وحدة تحكم عناوينية", category: "Fire Alarm" },
  { keywords: ["gas suppression","fm200","co2 system","novec","مطفأ غاز","إطفاء غاز"], unit: "LS.", supplyMin: 15000.0, supplyStd: 35000.0, supplyPremium: 85000.0, brands: "Tyco / Kidde / Hochiki / Ansul", brandAr: "تايكو / كيد / هوشيكي", descAr: "نظام إطفاء بالغاز FM200", category: "Fire Alarm" },

  // ══════════════════════════════════════════════
  //  PUBLIC ADDRESS & VOICE EVAC (نظام الإذاعة)
  // ══════════════════════════════════════════════
  { keywords: ["pa panel","pa amplifier","voice evacuation panel","public address panel","لوحة إذاعة عامة"], unit: "NO.", supplyMin: 2500.0, supplyStd: 6500.0, supplyPremium: 18000.0, brands: "Bosch / TOA / Valcom / Honeywell / Plena", brandAr: "بوش / TOA / فالكوم", descAr: "لوحة نظام الإذاعة والإخلاء", category: "Public Address" },
  { keywords: ["ceiling speaker","pa speaker","pa ceiling","سماعة سقف","سماعة إذاعة"], unit: "NO.", supplyMin: 65.0, supplyStd: 145.0, supplyPremium: 380.0, brands: "Bosch / TOA / Valcom / Plena / Atlas Sound", brandAr: "بوش / TOA / فالكوم", descAr: "سماعة سقف 6W نظام الإذاعة", category: "Public Address" },
  { keywords: ["pa horn speaker","horn speaker","wall speaker","سماعة بوق","سماعة جدار"], unit: "NO.", supplyMin: 95.0, supplyStd: 195.0, supplyPremium: 480.0, brands: "Bosch / TOA / Valcom / Plena", brandAr: "بوش / TOA / فالكوم", descAr: "سماعة بوق خارجية", category: "Public Address" },
  { keywords: ["volume control","attenuator","pa volume","ضبط صوت","مخفف صوت"], unit: "NO.", supplyMin: 45.0, supplyStd: 95.0, supplyPremium: 220.0, brands: "Bosch / TOA / Plena", brandAr: "بوش / TOA", descAr: "وحدة ضبط حجم الصوت PA", category: "Public Address" },
  { keywords: ["amplifier 120w","amplifier 240w","pa amp","مضخم صوت"], unit: "NO.", supplyMin: 850.0, supplyStd: 1800.0, supplyPremium: 4500.0, brands: "Bosch / TOA / Plena / Crown", brandAr: "بوش / TOA / بلينا", descAr: "مضخم صوت للإذاعة", category: "Public Address" },
  { keywords: ["zone controller","pa zone","zone amplifier","مسيطر منطقة صوت"], unit: "NO.", supplyMin: 650.0, supplyStd: 1400.0, supplyPremium: 3500.0, brands: "Bosch / TOA / Plena", brandAr: "بوش / TOA", descAr: "مسيطر منطقة نظام الإذاعة", category: "Public Address" },

  // ══════════════════════════════════════════════
  //  CCTV & SECURITY (كاميرات ومراقبة)
  // ══════════════════════════════════════════════
  { keywords: ["ip camera","cctv camera","dome camera","bullet camera","كاميرا مراقبة","كاميرا IP"], unit: "NO.", supplyMin: 185.0, supplyStd: 420.0, supplyPremium: 1100.0, brands: "Hikvision / Dahua / Axis / Bosch / Hanwha", brandAr: "هيكفيجن / داهوا / أكسس / بوش", descAr: "كاميرا مراقبة IP", category: "CCTV & Security" },
  { keywords: ["ptz camera","speed dome","ptz dome","كاميرا PTZ"], unit: "NO.", supplyMin: 850.0, supplyStd: 2200.0, supplyPremium: 6500.0, brands: "Axis / Bosch / Hanwha / Hikvision", brandAr: "أكسس / بوش / هيكفيجن", descAr: "كاميرا PTZ متحركة", category: "CCTV & Security" },
  { keywords: ["nvr","dvr","network video recorder","مسجل فيديو شبكي"], unit: "NO.", supplyMin: 850.0, supplyStd: 2200.0, supplyPremium: 6500.0, brands: "Hikvision / Dahua / Axis / Bosch", brandAr: "هيكفيجن / داهوا / أكسس", descAr: "مسجل فيديو شبكي NVR", category: "CCTV & Security" },
  { keywords: ["access control","card reader","hid reader","بطاقة دخول","قارئ بطاقة"], unit: "NO.", supplyMin: 350.0, supplyStd: 750.0, supplyPremium: 1800.0, brands: "HID / ASSA ABLOY / Honeywell / Lenel", brandAr: "HID / أسا أبلوي / هانيويل", descAr: "قارئ بطاقة تحكم بالدخول", category: "Access Control" },
  { keywords: ["magnetic lock","maglock","em lock","قفل مغناطيسي"], unit: "NO.", supplyMin: 195.0, supplyStd: 420.0, supplyPremium: 980.0, brands: "Maglock / ASSA ABLOY / Lenel", brandAr: "مجلوك / أسا أبلوي", descAr: "قفل مغناطيسي للأبواب", category: "Access Control" },
  { keywords: ["access control panel","door controller","access panel","لوحة تحكم بالدخول"], unit: "NO.", supplyMin: 1200.0, supplyStd: 2800.0, supplyPremium: 7500.0, brands: "HID / Honeywell / ASSA ABLOY / Lenel", brandAr: "HID / هانيويل / أسا أبلوي", descAr: "لوحة تحكم نظام الدخول", category: "Access Control" },

  // ══════════════════════════════════════════════
  //  BMS / AUTOMATION (أنظمة التحكم)
  // ══════════════════════════════════════════════
  { keywords: ["bms controller","ddc controller","bms panel","وحدة تحكم bms","مسيطر bms"], unit: "NO.", supplyMin: 1800.0, supplyStd: 4200.0, supplyPremium: 11000.0, brands: "Siemens / Johnson Controls / Honeywell / Schneider", brandAr: "سيمنز / جونسون / هانيويل / شنايدر", descAr: "وحدة تحكم BMS", category: "BMS & Automation" },
  { keywords: ["bms workstation","supervisor","scada workstation","محطة إدارة bms"], unit: "NO.", supplyMin: 4500.0, supplyStd: 9500.0, supplyPremium: 22000.0, brands: "Siemens / Johnson Controls / Honeywell", brandAr: "سيمنز / جونسون / هانيويل", descAr: "محطة إدارة نظام BMS", category: "BMS & Automation" },
  { keywords: ["knx module","knx actuator","knx dimmer","knx controller","وحدة knx"], unit: "NO.", supplyMin: 350.0, supplyStd: 750.0, supplyPremium: 1800.0, brands: "Schneider / ABB / Siemens / Weinzierl", brandAr: "شنايدر / ABB / سيمنز", descAr: "وحدة KNX للتحكم الذكي", category: "BMS & Automation" },

  // ══════════════════════════════════════════════
  //  DATA & NETWORK (شبكات البيانات)
  // ══════════════════════════════════════════════
  { keywords: ["patch panel","24 port patch","48 port patch","بانيل باتش"], unit: "NO.", supplyMin: 185.0, supplyStd: 380.0, supplyPremium: 850.0, brands: "Panduit / Systimax / Siemon / AMP", brandAr: "باندويت / سيستيماكس / سيمون", descAr: "بانيل باتش 24/48 منفذ Cat6", category: "Data & Network" },
  { keywords: ["network switch","managed switch","cisco switch","مبدل شبكة","سويتش شبكة"], unit: "NO.", supplyMin: 850.0, supplyStd: 2200.0, supplyPremium: 6500.0, brands: "Cisco / HP Aruba / Ubiquiti / Netgear", brandAr: "سيسكو / آروبا / يوبيكويتي", descAr: "مبدل شبكة مُدار", category: "Data & Network" },
  { keywords: ["wifi access point","wireless ap","wireless access point","نقطة وصول لاسلكية"], unit: "NO.", supplyMin: 350.0, supplyStd: 750.0, supplyPremium: 1900.0, brands: "Cisco / HP Aruba / Ubiquiti / Ruckus", brandAr: "سيسكو / آروبا / يوبيكويتي", descAr: "نقطة وصول WiFi لاسلكية", category: "Data & Network" },
  { keywords: ["fiber patch panel","odf","fiber distribution","بانيل ألياف ضوئية"], unit: "NO.", supplyMin: 280.0, supplyStd: 580.0, supplyPremium: 1350.0, brands: "Corning / Panduit / FINOSEL / CommScope", brandAr: "كورنينج / باندويت / فينوسل", descAr: "وحدة توزيع الألياف الضوئية ODF", category: "Data & Network" },
  { keywords: ["server rack","data rack","19 inch rack","rack cabinet","خزانة سيرفر"], unit: "NO.", supplyMin: 850.0, supplyStd: 1800.0, supplyPremium: 4500.0, brands: "APC / Rittal / Generic / Legrand", brandAr: "APC / ريتال / ليجراند", descAr: "خزانة سيرفر 19 بوصة", category: "Data & Network" },

  // ══════════════════════════════════════════════
  //  MEDICAL SYSTEMS (غازات وأنظمة طبية)
  // ══════════════════════════════════════════════
  { keywords: ["bed head unit","bed head panel","bhu","head wall","لوح رأس السرير"], unit: "NO.", supplyMin: 850.0, supplyStd: 1800.0, supplyPremium: 4500.0, brands: "Dräger / Amico / BeaconMedaes / Linde", brandAr: "دريجر / أميكو / بيكون", descAr: "وحدة رأس السرير الطبية", category: "Medical Systems" },
  { keywords: ["medical gas outlet","gas outlet","oxygen outlet","medical outlet","مخرج غاز طبي"], unit: "NO.", supplyMin: 350.0, supplyStd: 750.0, supplyPremium: 1800.0, brands: "Dräger / Amico / BeaconMedaes / BOC", brandAr: "دريجر / أميكو / بيكون", descAr: "مخرج غاز طبي", category: "Medical Systems" },
  { keywords: ["nurse call","nurse station","call system","جرس تمريض","نداء ممرضة"], unit: "NO.", supplyMin: 185.0, supplyStd: 420.0, supplyPremium: 1100.0, brands: "Ackermann / Intercall / Ascom / Siemens", brandAr: "أكرمان / إنتيركول / سيمنز", descAr: "وحدة نداء ممرضة", category: "Medical Systems" },

  // ══════════════════════════════════════════════
  //  CLOCK SYSTEMS (أنظمة المواقيت)
  // ══════════════════════════════════════════════
  { keywords: ["master clock","time server","ntp clock","لوحة توقيت مركزي"], unit: "NO.", supplyMin: 3500.0, supplyStd: 7500.0, supplyPremium: 18000.0, brands: "Bodet / Sapling / Primex / Mobatime", brandAr: "بوديت / سابلينج / موباتايم", descAr: "لوحة ساعة مركزية", category: "Clock Systems" },
  { keywords: ["slave clock","analog clock","digital clock","ساعة فرعية","ساعة رقمية"], unit: "NO.", supplyMin: 185.0, supplyStd: 420.0, supplyPremium: 1100.0, brands: "Bodet / Sapling / Primex", brandAr: "بوديت / سابلينج / بريمكس", descAr: "ساعة فرعية", category: "Clock Systems" },

  // ══════════════════════════════════════════════
  //  DIGITAL SIGNAGE & AV (شاشات وعروض)
  // ══════════════════════════════════════════════
  { keywords: ["digital signage","display screen","led screen","lcd display","شاشة عرض","شاشة إعلانية"], unit: "NO.", supplyMin: 1200.0, supplyStd: 2800.0, supplyPremium: 7500.0, brands: "Samsung / LG / NEC / Sony", brandAr: "سامسونج / LG / NEC / سوني", descAr: "شاشة عرض رقمية", category: "AV & Signage" },
  { keywords: ["video wall","video matrix","wall controller","جدار فيديو"], unit: "NO.", supplyMin: 15000.0, supplyStd: 35000.0, supplyPremium: 95000.0, brands: "Samsung / Barco / Christie / Planar", brandAr: "سامسونج / باركو / كريستي", descAr: "جدار عرض فيديو", category: "AV & Signage" },
  { keywords: ["projector","data projector","projection","بروجكتور","جهاز عرض"], unit: "NO.", supplyMin: 1800.0, supplyStd: 4200.0, supplyPremium: 12000.0, brands: "Epson / Panasonic / Christie / Barco", brandAr: "إبسون / باناسونيك / كريستي", descAr: "جهاز بروجكتور", category: "AV & Signage" },
];

// ── Price lookup function ──────────────────────────────────────────────────────
export function lookupKsaPrice(descriptionEn: string, category?: string): MarketItem | null {
  const text = (descriptionEn + " " + (category || "")).toLowerCase();
  let bestMatch: MarketItem | null = null;
  let bestScore = 0;

  for (const item of KSA_MARKET_PRICES) {
    let score = 0;
    for (const kw of item.keywords) {
      if (text.includes(kw.toLowerCase())) score += kw.split(" ").length;
    }
    if (score > bestScore) { bestScore = score; bestMatch = item; }
  }

  return bestScore >= 2 ? bestMatch : null;
}

// ── Normalize unit to LS. or NO. ─────────────────────────────────────────────
export function normalizeUnit(unit: string): string {
  const u = unit.toLowerCase().trim();
  if (u === "lot" || u === "ls" || u === "ls." || u === "lump" || u === "lumpsum" || u === "sum" || u === "item" || u === "job") return "LS.";
  if (u === "each" || u === "ea" || u === "no" || u === "no." || u === "nr" || u === "set" || u === "pc" || u === "pcs" || u === "point") return "NO.";
  if (u === "m" || u === "lm" || u === "rl" || u === "reel" || u === "linear") return "m";
  if (u === "m2" || u === "sqm") return "m²";
  if (u === "kg") return "kg";
  return u.toUpperCase();
}

// ── Brand mapping by category ─────────────────────────────────────────────────
const CATEGORY_BRANDS: Record<string, { brands: string; brandAr: string }> = {
  "Cables & Wiring":       { brands: "Saudi Cable / Prysmian / Nexans",                    brandAr: "كابل سعودي / برايسميان / نيكسانس" },
  "Conduits & Trunking":   { brands: "Legrand / OBO / Generic",                             brandAr: "ليجراند / OBO / عام" },
  "Wiring Devices":        { brands: "Legrand / Schneider / ABB / Crabtree",                brandAr: "ليجراند / شنايدر / ABB" },
  "Lighting":              { brands: "Philips / Osram / Havells",                            brandAr: "فيليبس / أوسرام / هافيلز" },
  "Protection Devices":    { brands: "Schneider / ABB / Hager / Siemens",                   brandAr: "شنايدر / ABB / هاجر / سيمنز" },
  "Panels & Distribution": { brands: "Schneider / ABB / Siemens / Legrand",                 brandAr: "شنايدر / ABB / سيمنز / ليجراند" },
  "Earthing & Bonding":    { brands: "Furse / DEHN / Generic",                              brandAr: "فورس / دين / عام" },
  "Fire Alarm":            { brands: "Hochiki / Notifier / Bosch / Siemens / Apollo",       brandAr: "هوشيكي / نوتيفير / بوش / سيمنز" },
  "Public Address":        { brands: "Bosch / TOA / Valcom / Plena",                        brandAr: "بوش / TOA / فالكوم" },
  "CCTV & Security":       { brands: "Hikvision / Dahua / Axis / Bosch",                   brandAr: "هيكفيجن / داهوا / أكسس / بوش" },
  "Access Control":        { brands: "HID / ASSA ABLOY / Honeywell / Lenel",                brandAr: "HID / أسا أبلوي / هانيويل" },
  "BMS & Automation":      { brands: "Siemens / Johnson Controls / Honeywell / Schneider",  brandAr: "سيمنز / جونسون / هانيويل / شنايدر" },
  "Data & Network":        { brands: "Cisco / Panduit / Systimax / FINOSEL",               brandAr: "سيسكو / باندويت / سيستيماكس" },
  "Power Systems":         { brands: "APC / Eaton / Schneider / Cummins",                   brandAr: "APC / إيتون / شنايدر / كامنز" },
  "Transformers":          { brands: "ABB / Schneider / Siemens",                           brandAr: "ABB / شنايدر / سيمنز" },
  "Medical Systems":       { brands: "Dräger / Amico / BeaconMedaes",                       brandAr: "دريجر / أميكو / بيكون" },
  "Clock Systems":         { brands: "Bodet / Sapling / Primex / Mobatime",                 brandAr: "بوديت / سابلينج / موباتايم" },
  "AV & Signage":          { brands: "Samsung / LG / Sony / NEC",                          brandAr: "سامسونج / LG / سوني / NEC" },
  "General Electrical":    { brands: "Schneider / ABB / Legrand / Generic",                 brandAr: "شنايدر / ABB / ليجراند / عام" },
};

export function getBrandsByCategory(category?: string | null): { brands: string; brandAr: string } {
  if (!category) return { brands: "Generic / OEM", brandAr: "عام / OEM" };
  return CATEGORY_BRANDS[category] || { brands: "Generic / OEM", brandAr: "عام / OEM" };
}

export function isInstallationItem(desc: string): boolean {
  const d = desc.toLowerCase();
  return d.includes("install") || d.includes("testing") || d.includes("commissioning") ||
    d.includes("تركيب") || d.includes("اختبار") || d.includes("تشغيل") ||
    d.includes("labour") || d.includes("labor") || d.includes("عمالة");
}
