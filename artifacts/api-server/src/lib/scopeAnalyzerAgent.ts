/**
 * Agent 7 — Scope Analyzer (Gap Detection)
 * Detects required electrical systems that are MISSING from the BOQ
 * Uses AI + a comprehensive required-systems database for KSA projects
 */
import { db } from "@workspace/db";
import { boqItemsTable, scopeGapsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logger } from "./logger.js";

type GapRisk = "low" | "medium" | "high" | "critical";

interface RequiredSystem {
  id: string;
  nameEn: string;
  nameAr: string;
  keywords: string[];
  riskLevel: GapRisk;
  estimatedMin: number;
  estimatedMax: number;
  recommendationEn: string;
  recommendationAr: string;
  section: string;
  mandatoryFor: string[];
}

const REQUIRED_SYSTEMS: RequiredSystem[] = [
  // ── Mandatory KSA/SEC Systems ──────────────────────────────────────────────
  {
    id: "earthing",
    nameEn: "Earthing & Bonding System",
    nameAr: "نظام التأريض والربط الكهربائي",
    keywords: ["earthing","earth electrode","bonding","grounding","أرضي","تأريض"],
    riskLevel: "critical", estimatedMin: 15000, estimatedMax: 45000,
    recommendationEn: "Add complete earthing system per IEC 60364 & SEC regulations: earth electrodes, bonding conductors, earth bars, test links.",
    recommendationAr: "أضف نظام تأريض كامل وفق IEC 60364 ولوائح شركة الكهرباء السعودية: أقطاب أرضية، موصلات ربط، قضبان أرضية، نقاط اختبار.",
    section: "Earthing", mandatoryFor: ["all"],
  },
  {
    id: "lightning_protection",
    nameEn: "Lightning Protection System",
    nameAr: "نظام الحماية من الصواعق",
    keywords: ["lightning","lightning rod","air terminal","down conductor","صواعق","برق","مانعة صواعق"],
    riskLevel: "high", estimatedMin: 12000, estimatedMax: 35000,
    recommendationEn: "Add lightning protection system per IEC 62305: air termination network, down conductors, earth termination system.",
    recommendationAr: "أضف نظام حماية من الصواعق وفق IEC 62305: شبكة نهايات هوائية، موصلات هابطة، نظام تأريض.",
    section: "Lightning Protection", mandatoryFor: ["all"],
  },
  {
    id: "emergency_lighting",
    nameEn: "Emergency & Exit Lighting",
    nameAr: "إضاءة الطوارئ والمخارج",
    keywords: ["emergency light","exit sign","exit light","evacuation","طوارئ","مخرج طوارئ","مصباح طوارئ"],
    riskLevel: "critical", estimatedMin: 18000, estimatedMax: 65000,
    recommendationEn: "Add emergency lighting per IEC 60598-2-22 & civil defense requirements: central battery system or self-contained units, minimum 1-hour duration.",
    recommendationAr: "أضف إضاءة طوارئ وفق IEC 60598-2-22 ومتطلبات الدفاع المدني: نظام بطارية مركزي أو وحدات مستقلة، بحد أدنى ساعة واحدة.",
    section: "Emergency Lighting", mandatoryFor: ["commercial","industrial","hospital","school"],
  },
  {
    id: "testing_commissioning",
    nameEn: "Testing & Commissioning",
    nameAr: "اختبار وتشغيل المنظومة",
    keywords: ["testing","commissioning","t&c","test certificate","اختبار","تشغيل","فحص","شهادة"],
    riskLevel: "high", estimatedMin: 8000, estimatedMax: 50000,
    recommendationEn: "Add Testing & Commissioning allowance: insulation resistance tests, earth continuity, load flow test, protection relay testing, PAT testing.",
    recommendationAr: "أضف بند اختبار وتشغيل: اختبار مقاومة العزل، استمرارية الأرضي، اختبار تدفق الحمل، اختبار رلايات الحماية.",
    section: "Testing & Commissioning", mandatoryFor: ["all"],
  },
  {
    id: "cable_management",
    nameEn: "Cable Management (Trays, Ladders, Supports)",
    nameAr: "أنظمة إدارة الكابلات (أدراج، سلالم، حوامل)",
    keywords: ["cable tray","cable ladder","cable support","cable management","drj","درج","سلم كابل","حامل كابل"],
    riskLevel: "medium", estimatedMin: 15000, estimatedMax: 80000,
    recommendationEn: "Add cable management system: perforated cable trays, cable ladders, supports, brackets, and fixings. Minimum 30% spare capacity.",
    recommendationAr: "أضف منظومة إدارة الكابلات: أدراج كابلات مثقبة، سلالم كابلات، حوامل، أقواس وتثبيتات. بحد أدنى 30% سعة احتياطية.",
    section: "Cable Management", mandatoryFor: ["all"],
  },
  {
    id: "generator_connection",
    nameEn: "Emergency Generator Connection & ATS",
    nameAr: "توصيل مولد الطوارئ ووحدة التحويل التلقائي ATS",
    keywords: ["generator","genset","ats","automatic transfer","standby power","مولد","مولدة","تحويل تلقائي"],
    riskLevel: "high", estimatedMin: 25000, estimatedMax: 120000,
    recommendationEn: "Add emergency generator connection: ATS panel, generator cable supply, earthing, fuel system connection, load testing.",
    recommendationAr: "أضف توصيل مولد الطوارئ: لوحة تحويل تلقائي ATS، كابلات إمداد المولد، تأريض، توصيل منظومة الوقود، اختبار الحمل.",
    section: "Standby Power", mandatoryFor: ["commercial","industrial","hospital"],
  },
  {
    id: "as_built_drawings",
    nameEn: "As-Built Drawings & O&M Manuals",
    nameAr: "الرسومات التنفيذية النهائية ودليل التشغيل والصيانة",
    keywords: ["as built","as-built","o&m","operation manual","maintenance manual","record drawing","رسومات تنفيذية","دليل تشغيل"],
    riskLevel: "medium", estimatedMin: 5000, estimatedMax: 25000,
    recommendationEn: "Add as-built drawings preparation (CAD/BIM) and O&M manuals compilation with all equipment data sheets, warranties, and maintenance schedules.",
    recommendationAr: "أضف إعداد الرسومات التنفيذية النهائية (CAD/BIM) وتجميع دليل التشغيل والصيانة مع جداول البيانات والضمانات وجدول الصيانة.",
    section: "Documentation", mandatoryFor: ["all"],
  },
  {
    id: "bms_integration",
    nameEn: "Building Management System (BMS) Integration",
    nameAr: "ربط نظام إدارة المبنى BMS",
    keywords: ["bms","building management","bacnet","modbus","scada","smart building","إدارة مبنى","بي إم إس"],
    riskLevel: "medium", estimatedMin: 35000, estimatedMax: 180000,
    recommendationEn: "Add BMS integration points for all major electrical systems: power meters, HVAC interfaces, lighting control, access control tie-in.",
    recommendationAr: "أضف نقاط ربط BMS لجميع الأنظمة الكهربائية الرئيسية: عدادات طاقة، واجهات تكييف، تحكم إضاءة، ربط التحكم في الدخول.",
    section: "BMS Integration", mandatoryFor: ["commercial","hotel"],
  },
  {
    id: "ups_system",
    nameEn: "UPS System (Uninterruptible Power Supply)",
    nameAr: "نظام التغذية اللانقطاعية UPS",
    keywords: ["ups","uninterruptible","battery backup","critical load","ups panel","يو بي إس","تغذية لانقطاعية"],
    riskLevel: "high", estimatedMin: 20000, estimatedMax: 150000,
    recommendationEn: "Add UPS system for critical loads: servers, CCTV, fire alarm panel, emergency communications. Minimum 30-minute battery backup.",
    recommendationAr: "أضف نظام UPS للأحمال الحرجة: خوادم، CCTV، لوحة إنذار الحريق، الاتصالات الطارئة. حد أدنى 30 دقيقة احتياطي.",
    section: "UPS", mandatoryFor: ["commercial","hospital","data_center"],
  },
  {
    id: "power_quality",
    nameEn: "Power Quality Meters & Energy Monitoring",
    nameAr: "أجهزة قياس جودة الطاقة ومراقبة الاستهلاك",
    keywords: ["power quality","energy meter","pq analyzer","harmonic","power factor","جودة طاقة","عداد طاقة","محلل توافقيات"],
    riskLevel: "medium", estimatedMin: 8000, estimatedMax: 40000,
    recommendationEn: "Add power quality meters on main incoming and critical feeders. Required for SEC billing compliance and energy efficiency reporting.",
    recommendationAr: "أضف عدادات جودة الطاقة على التغذية الرئيسية والمغذيات الحرجة. مطلوب للامتثال لشركة الكهرباء والتقارير المتعلقة بكفاءة الطاقة.",
    section: "Metering", mandatoryFor: ["commercial","industrial"],
  },
  {
    id: "containment_main",
    nameEn: "Main LV Containment (Busbars / Rising Mains)",
    nameAr: "قنوات التوزيع الرئيسية (الحوامل الكهربائية / المراسي الصاعدة)",
    keywords: ["busbar","busduct","rising main","bus duct","شريط طاقة","حاملة كهربائية","بوسبار"],
    riskLevel: "medium", estimatedMin: 30000, estimatedMax: 200000,
    recommendationEn: "Add LV busbar trunking or rising mains for multi-floor distribution. Required for buildings > 4 floors with central riser shafts.",
    recommendationAr: "أضف قنوات الشرائح الكهربائية أو المراسي الصاعدة لتوزيع متعدد الطوابق. مطلوب للمباني الأكثر من 4 طوابق.",
    section: "Main Distribution", mandatoryFor: ["multi_floor"],
  },
];

export interface ScopeAnalysisResult {
  projectId: number;
  boqItemsCount: number;
  systemsChecked: number;
  missingCount: number;
  gapsByCriticality: { critical: number; high: number; medium: number; low: number };
  estimatedGapCostMin: number;
  estimatedGapCostMax: number;
  gaps: Array<{
    system: string;
    systemAr: string;
    riskLevel: GapRisk;
    estimatedMin: number;
    estimatedMax: number;
    recommendation: string;
    recommendationAr: string;
  }>;
}

export async function runScopeAnalysis(projectId: number): Promise<ScopeAnalysisResult> {
  logger.info({ projectId }, "Agent 7: Starting scope gap analysis");

  const items = await db.select().from(boqItemsTable)
    .where(eq(boqItemsTable.projectId, projectId));

  if (items.length === 0) {
    return {
      projectId, boqItemsCount: 0, systemsChecked: REQUIRED_SYSTEMS.length,
      missingCount: 0, gapsByCriticality: { critical: 0, high: 0, medium: 0, low: 0 },
      estimatedGapCostMin: 0, estimatedGapCostMax: 0, gaps: [],
    };
  }

  // Build searchable corpus from all BOQ descriptions
  const boqCorpus = items.map(i =>
    `${i.descriptionEn} ${i.descriptionAr || ""} ${i.categoryLevel1 || ""} ${i.sectionName || ""}`
  ).join(" ").toLowerCase();

  // Clear previous gaps
  await db.delete(scopeGapsTable).where(eq(scopeGapsTable.projectId, projectId));

  // Step 1: Keyword-based fast scan
  const missingByKeyword: RequiredSystem[] = [];
  for (const sys of REQUIRED_SYSTEMS) {
    const found = sys.keywords.some(kw => boqCorpus.includes(kw.toLowerCase()));
    if (!found) missingByKeyword.push(sys);
  }

  // Step 2: AI confirmation for borderline cases (verify the keyword misses are real gaps)
  let confirmedMissing: RequiredSystem[] = missingByKeyword;

  if (missingByKeyword.length > 0 && items.length > 3) {
    try {
      const boqSummary = items.slice(0, 60).map(i => i.descriptionEn.slice(0, 80)).join(", ");
      const systemsToCheck = missingByKeyword.map(s => ({ id: s.id, name: s.nameEn }));

      const msg = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        system: `You are an electrical BOQ auditor for Saudi Arabia. Your task is to identify which required systems are genuinely missing from a BOQ.
Return ONLY a JSON array of system IDs that are CONFIRMED missing. Be conservative — only flag if truly absent.`,
        messages: [{
          role: "user",
          content: `BOQ items (sample): ${boqSummary}

Systems suspected missing (check if really missing or just named differently):
${JSON.stringify(systemsToCheck)}

Return JSON array of IDs that are genuinely missing: ["earthing","ups_system"]
Return [] if all present.`,
        }],
      });

      const text = msg.content[0].type === "text" ? msg.content[0].text : "";
      const match = text.match(/\[[\s\S]*?\]/);
      if (match) {
        const confirmedIds: string[] = JSON.parse(match[0]);
        confirmedMissing = missingByKeyword.filter(s => confirmedIds.includes(s.id));
      }
    } catch (err) {
      logger.warn({ err }, "Agent 7 AI confirmation failed, using keyword results");
    }
  }

  // Persist gaps
  if (confirmedMissing.length > 0) {
    await db.insert(scopeGapsTable).values(
      confirmedMissing.map(sys => ({
        projectId,
        system: sys.nameEn,
        systemAr: sys.nameAr,
        description: sys.recommendationEn,
        descriptionAr: sys.recommendationAr,
        riskLevel: sys.riskLevel,
        estimatedCostMin: sys.estimatedMin,
        estimatedCostMax: sys.estimatedMax,
        recommendation: sys.recommendationEn,
        recommendationAr: sys.recommendationAr,
        boqSection: sys.section,
        status: "open",
      }))
    );
  }

  const gapsByCriticality = {
    critical: confirmedMissing.filter(s => s.riskLevel === "critical").length,
    high: confirmedMissing.filter(s => s.riskLevel === "high").length,
    medium: confirmedMissing.filter(s => s.riskLevel === "medium").length,
    low: confirmedMissing.filter(s => s.riskLevel === "low").length,
  };

  const result: ScopeAnalysisResult = {
    projectId,
    boqItemsCount: items.length,
    systemsChecked: REQUIRED_SYSTEMS.length,
    missingCount: confirmedMissing.length,
    gapsByCriticality,
    estimatedGapCostMin: confirmedMissing.reduce((s, g) => s + g.estimatedMin, 0),
    estimatedGapCostMax: confirmedMissing.reduce((s, g) => s + g.estimatedMax, 0),
    gaps: confirmedMissing.map(s => ({
      system: s.nameEn, systemAr: s.nameAr, riskLevel: s.riskLevel,
      estimatedMin: s.estimatedMin, estimatedMax: s.estimatedMax,
      recommendation: s.recommendationEn, recommendationAr: s.recommendationAr,
    })),
  };

  logger.info({ projectId, missing: result.missingCount }, "Agent 7 scope analysis complete");
  return result;
}
