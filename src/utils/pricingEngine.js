import RateMaster from "../models/RateMaster.js";
import SurchargeMaster from "../models/SurchargeMaster.js";
import AgentGrade from "../models/AgentGrade.js";
import City from "../models/City.js";
import CarCategory from "../models/CarCategory.js";
import StatePermitMaster from "../models/StatePermitMaster.js";
import StateMarkup from "../models/StateMarkup.js";
import WebsiteSetting from "../models/WebsiteSetting.js";

/**
 * Get the applicable surcharge percent for a given travel date.
 * Checks all active surcharge periods.
 *
 * @param {Date} travelDate - The travel/arrival date
 * @returns {Promise<{surchargePercent: number, matchedPeriod: string}>}
 */
export async function getApplicableSurcharge(travelDate, pickupCityId = null) {
  if (!travelDate) return { surchargePercent: 0, matchedPeriod: "NORMAL / NO SURCHARGE", cityId: null };

  const date = new Date(travelDate);
  if (isNaN(date.getTime())) {
    return { surchargePercent: 0, matchedPeriod: "NORMAL / NO SURCHARGE", cityId: null };
  }

  // Convert travelDate to YYYY-MM-DD in Indian Standard Time (UTC + 5:30)
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const travelDateIST = new Date(date.getTime() + istOffsetMs)
    .toISOString()
    .split("T")[0];

  const activeSurcharges = await SurchargeMaster.find({ isActive: true });

  const dateMatches = activeSurcharges.filter((surcharge) => {
    const startStr = new Date(surcharge.startDate).toISOString().split("T")[0];
    const endStr = new Date(surcharge.endDate).toISOString().split("T")[0];
    return travelDateIST >= startStr && travelDateIST <= endStr;
  });

  if (dateMatches.length === 0) {
    return { surchargePercent: 0, matchedPeriod: "NORMAL / NO SURCHARGE", cityId: null };
  }

  const pickupCityStr = pickupCityId ? pickupCityId.toString() : null;

  // 1. Check for city-specific matches (Highest Specificity)
  const cityMatches = pickupCityStr
    ? dateMatches.filter((s) => s.city && s.city.toString() === pickupCityStr)
    : [];

  if (cityMatches.length > 0) {
    // Strategy A: Highest surcharge rate wins among city rules
    cityMatches.sort((a, b) => (b.surchargePercent || 0) - (a.surchargePercent || 0));
    const best = cityMatches[0];
    return {
      surchargePercent: best.surchargePercent || 0,
      matchedPeriod: best.name,
      cityId: pickupCityStr,
    };
  }

  // 2. Fall back to global matches (city is null / All Cities)
  const globalMatches = dateMatches.filter((s) => !s.city);
  if (globalMatches.length > 0) {
    // Strategy A: Highest surcharge rate wins among global rules
    globalMatches.sort((a, b) => (b.surchargePercent || 0) - (a.surchargePercent || 0));
    const best = globalMatches[0];
    return {
      surchargePercent: best.surchargePercent || 0,
      matchedPeriod: best.name,
      cityId: null,
    };
  }

  return { surchargePercent: 0, matchedPeriod: "NORMAL / NO SURCHARGE", cityId: null };
}

/**
 * Default charges for trips. Toll/permit is handled dynamically via State Permit Master;
 * parking is at actuals (excluded from automatic base quote).
 *
 * @returns {Promise<Object>} Empty default charges
 */
export async function getDefaultCharges() {
  return {};
}

/**
 * Calculate permit charges for visited foreign states per vehicle category.
 *
 * Foreign States = All visited cities whose state differs from the vehicle base (garage) state.
 *
 * @param {Object} params
 * @param {string[]} params.foreignStates - Unique list of foreign state slugs (e.g. ['tamil-nadu'])
 * @returns {Promise<Map<string, number>>} Map of vehicleCategoryId -> totalPermitCharge
 */
export async function getCategoryPermitCharges({ foreignStates = [] }) {
  const permitMap = new Map();
  if (!foreignStates || foreignStates.length === 0) {
    return permitMap;
  }

  // Find all active permits for the foreign states
  const permits = await StatePermitMaster.find({
    state: { $in: foreignStates },
    isActive: true,
  });

  for (const permit of permits) {
    const catId = permit.vehicleCategory.toString();
    const current = permitMap.get(catId) || 0;
    permitMap.set(catId, current + (permit.permitCharge || 0));
  }

  return permitMap;
}

/**
 * Resolve the applicable system commission / markup for a given state & city.
 * Hierarchy:
 * 1. City-specific active StateMarkup rule
 * 2. State-wide active StateMarkup rule
 * 3. Dynamic defaultCommissionPercent in WebsiteSetting (fallback 0.05)
 *
 * @param {Object} params
 * @param {string} params.state - State slug or name
 * @param {string} [params.cityId] - City ObjectId
 * @param {number} [params.manualMarginPercent] - Optional override if caller explicitly passed a custom value
 * @returns {Promise<{marginPercent: number, source: string, rule: Object|null}>}
 */
export async function resolveApplicableCommission({
  state,
  cityId,
  manualMarginPercent,
}) {
  const normalizedState = state?.toLowerCase().trim().replace(/\s+/g, "-");

  // 1. Check for active city-specific rule first
  if (cityId) {
    const cityRule = await StateMarkup.findOne({
      state: { $regex: new RegExp(`^${normalizedState}$`, "i") },
      city: cityId,
      isActive: true,
    });
    if (cityRule) {
      return {
        marginPercent: cityRule.markupPercent,
        source: "city_markup",
        rule: cityRule,
      };
    }
  }

  // 2. Check for active state-wide rule (city is null)
  if (normalizedState) {
    const stateRule = await StateMarkup.findOne({
      state: { $regex: new RegExp(`^${normalizedState}$`, "i") },
      city: null,
      isActive: true,
    });
    if (stateRule) {
      return {
        marginPercent: stateRule.markupPercent,
        source: "state_markup",
        rule: stateRule,
      };
    }
  }

  // 3. Fallback to configurable default system commission in WebsiteSetting
  const setting = await WebsiteSetting.findOne().select(
    "defaultCommissionPercent",
  );
  const defaultCommissionPercent =
    setting?.defaultCommissionPercent ??
    (manualMarginPercent !== undefined && manualMarginPercent !== null
      ? manualMarginPercent
      : 0.05);

  return {
    marginPercent: defaultCommissionPercent,
    source: "system_default",
    rule: null,
  };
}

/**
 * Calculate the pricing for a single vehicle category using the full formula.
 *
 * LIVE COSTING
 * ─────────────────────────────────────────────────────────────
 * Chargeable KM = Garage→Pickup + Intercity + Local + Garage Return
 * Included KM   = rate.includedKmPerDay × serviceDays
 * Extra KM      = max(0, Chargeable KM - Included KM)
 *
 * Base Vehicle Cost = rate.baseRatePerDay × serviceDays
 * KM Cost          = Extra KM × rate.extraKmRate
 *   (for "daily-all-km": KM Cost = Chargeable KM × rate.extraKmRate)
 * Driver Bata      = rate.driverBataPerDay × serviceDays
 *
 * TOTAL TRANSPORT COST = Base + KM Cost + Driver Bata + Toll + Parking + Permit + Night Halt + Other
 *
 * COMMERCIAL / FINAL (Customer-facing)
 * ─────────────────────────────────────────────────────────────
 * Surcharge       = TOTAL TRANSPORT COST × surchargePercent
 * Cost After Surcharge = TOTAL TRANSPORT COST + Surcharge
 *
 * Cabnex Margin   = Cost After Surcharge × cabnexMarginPercent
 * Subtotal        = Cost After Surcharge + Cabnex Margin
 *
 * Tax (GST)       = Subtotal × taxSlab / 100
 * FINAL PRICE     = Subtotal + Tax
 *
 * Note: Agent markup is NOT included in customer-facing fare.
 *       It is applied separately when assigning a booking to a vendor.
 *
 * @param {Object} params
 * @returns {Object} Complete pricing breakdown
 */
export function calculateVehiclePrice({
  rate,
  serviceDays,
  chargeableKm,
  charges = {},
  surchargePercent = 0,
  cabnexMarginPercent = 0.05,
  taxSlab = 5,
  fixedRouteBase = 0,
}) {
  const totalNights = Math.max(serviceDays - 1, 0);

  // ─── KM Calculation ───
  let includedKm = 0;
  let extraKm = 0;
  let baseVehicleCost = 0;
  let kmCost = 0;

  switch (rate.rateModel) {
    case "daily-included-km":
      // Base per day, included KM per day, extra KM charged separately
      includedKm = rate.includedKmPerDay * serviceDays;
      extraKm = Math.max(0, chargeableKm - includedKm);
      baseVehicleCost = rate.baseRatePerDay * serviceDays;
      kmCost = extraKm * rate.extraKmRate;
      break;

    case "daily-all-km":
      // Base per day, ALL km charged at per-km rate (no included km)
      includedKm = 0;
      extraKm = chargeableKm;
      baseVehicleCost = rate.baseRatePerDay * serviceDays;
      kmCost = chargeableKm * rate.extraKmRate;
      break;

    case "package-fixed-km":
      // Package base rate, with included KM for the package
      includedKm = rate.includedKmPerDay; // for package, this is total included (not per day)
      extraKm = Math.max(0, chargeableKm - includedKm);
      baseVehicleCost = rate.baseRatePerDay; // package price (not per day)
      kmCost = extraKm * rate.extraKmRate;
      break;

    case "fixed-route":
      // Fixed price for a specific route — no km calculation
      includedKm = chargeableKm;
      extraKm = 0;
      baseVehicleCost = fixedRouteBase;
      kmCost = 0;
      break;

    default:
      // Fallback to daily-included-km
      includedKm = rate.includedKmPerDay * serviceDays;
      extraKm = Math.max(0, chargeableKm - includedKm);
      baseVehicleCost = rate.baseRatePerDay * serviceDays;
      kmCost = extraKm * rate.extraKmRate;
  }

  // ─── Driver Bata ───
  const driverBata = rate.driverBataPerDay * serviceDays;

  // ─── Manual / Border Permit Charges ───
  // Note: Toll and permit are treated as the same inter-state road tax/permit,
  // calculated automatically via State Permit Master. Parking is at actuals / excluded.
  const permit = charges.permit || 0;
  const toll = 0;
  const parking = 0;
  const nightHalt = charges["night-halt"] || 0;
  const otherCharges = charges["other-charges"] || 0;

  // ─── Total Transport Cost ───
  const totalTransportCost =
    baseVehicleCost +
    kmCost +
    driverBata +
    permit +
    nightHalt +
    otherCharges;

  // ─── Surcharge ───
  const surchargeAmount = Math.round(totalTransportCost * surchargePercent);
  const costAfterSurcharge = totalTransportCost + surchargeAmount;

  // ─── Cabnex Margin (Platform Fee) ───
  const cabnexMargin = Math.round(costAfterSurcharge * cabnexMarginPercent);
  const subtotal = costAfterSurcharge + cabnexMargin;

  // ─── Tax (GST) ───
  const taxAmount = taxSlab > 0 ? Math.round(subtotal * taxSlab / 100) : 0;
  const totalAmount = subtotal + taxAmount;

  return {
    // KM breakdown
    chargeableKm,
    includedKm,
    extraKm,

    // Cost breakdown
    baseVehicleCost,
    kmCost,
    driverBata,

    // Charges
    toll,
    parking,
    permit,
    nightHalt,
    otherCharges,

    // Totals
    totalTransportCost,

    // Surcharge
    surchargePercent,
    surchargeAmount,
    costAfterSurcharge,

    // Commercial
    cabnexMarginPercent,
    cabnexMargin,

    // Tax
    taxSlab,
    taxAmount,

    // Final
    totalAmount,

    // Meta
    serviceDays,
    totalNights,
    rateModel: rate.rateModel,
  };
}

/**
 * Calculate pricing for all active vehicle categories for a trip.
 * Fetches rate data from Rate Master based on pickup city.
 *
 * @param {Object} params
 * @param {string} [params.garageCityId] - Garage base city ObjectId
 * @param {string} params.pickupCityId - Pickup city ObjectId
 * @param {Array<string>} [params.destinationCityIds] - Destination city ObjectIds
 * @param {string} [params.dropCityId] - Drop city ObjectId (optional)
 * @param {string} params.rateModel - Rate model to use
 * @param {number} params.serviceDays - Number of service days
 * @param {number} params.chargeableKm - Total chargeable km
 * @param {Object} [params.charges] - Manual charges { toll, parking, permit, ... }
 * @param {Date} params.travelDate - Travel/arrival date (for surcharge check)
 * @param {string} [params.agentGradeId] - Agent grade ObjectId (optional, stored for vendor assignment)
 * @param {number} [params.cabnexMarginPercent] - Cabnex margin % (default 0.05)
 * @param {number} [params.fixedRouteBase] - Fixed route base price (for fixed-route model only)
 * @returns {Promise<Object>} Categories with pricing
 */
export async function calculatePricingForAllCategories({
  garageCityId,
  pickupCityId,
  destinationCityIds = [],
  dropCityId,
  rateModel,
  serviceDays,
  chargeableKm,
  charges = {},
  travelDate,
  agentGradeId,
  cabnexMarginPercent = 0.05,
  fixedRouteBase = 0,
}) {
  // Get the pickup city's state for permit logic
  const pickupCity = await City.findById(pickupCityId).select("state city");
  if (!pickupCity) {
    throw new Error("Pickup city not found");
  }

  const state = pickupCity.state;

  // Determine vehicle base state (Garage city's state, fallback to pickup city)
  let baseState = pickupCity.state;
  if (garageCityId && garageCityId.toString() !== pickupCityId.toString()) {
    const garageCity = await City.findById(garageCityId).select("state city");
    if (garageCity?.state) {
      baseState = garageCity.state;
    }
  }
  const normalizedBaseState = baseState?.toLowerCase().trim().replace(/\s+/g, "-");

  // Determine all unique states visited across the complete trip
  const allTripCityIds = [
    pickupCityId,
    ...(destinationCityIds || []),
    dropCityId,
  ].filter(Boolean);

  const visitedCities = await City.find({
    _id: { $in: allTripCityIds },
  }).select("state city");

  const visitedStates = visitedCities
    .map((c) => c.state?.toLowerCase().trim().replace(/\s+/g, "-"))
    .filter(Boolean);

  // Foreign states entered: any state visited that differs from vehicle base (garage) state
  const foreignStates = [
    ...new Set(visitedStates.filter((s) => s && s !== normalizedBaseState)),
  ];

  // Lookup permit charges per vehicle category for foreign states
  const manualPermitOverride =
    charges.permit !== undefined && charges.permit !== null;
  let categoryPermitMap = new Map();
  if (!manualPermitOverride && foreignStates.length > 0) {
    categoryPermitMap = await getCategoryPermitCharges({ foreignStates });
  }

  // Get all active rates for this city and rate model
  const rates = await RateMaster.find({
    rateModel,
    city: pickupCityId,
    isActive: true,
  }).populate("vehicleCategory");

  if (!rates || rates.length === 0) {
    throw new Error(
      `No rates found for city "${pickupCity.city}" with rate model "${rateModel}". Add rates to Rate Master.`,
    );
  }

  // Get surcharge for travel date and pickup city (Strategy A: City overrides Global; Highest rate wins)
  const { surchargePercent, matchedPeriod } =
    await getApplicableSurcharge(travelDate, pickupCityId);

  // Get agent grade info (stored for later vendor assignment, NOT included in customer fare)
  let agentGradeName = null;
  if (agentGradeId) {
    const grade = await AgentGrade.findById(agentGradeId);
    if (grade) {
      agentGradeName = grade.grade;
    }
  }

  // Get default charges from Charge Master (toll, parking, etc.)
  const defaultCharges = await getDefaultCharges();

  // Resolve system commission / markup: State-wise markup overrides system default
  const commissionInfo = await resolveApplicableCommission({
    state: pickupCity.state,
    cityId: pickupCity._id,
    manualMarginPercent: cabnexMarginPercent,
  });
  const effectiveCabnexMarginPercent = commissionInfo.marginPercent;

  // Calculate pricing for each vehicle category
  const categories = rates.map((rate) => {
    const catId = (rate.vehicleCategory?._id || rate.vehicleCategory).toString();

    // Determine category permit: manual override > auto calculated from StatePermitMaster > 0 (intra-state)
    let permitAmount = 0;
    if (manualPermitOverride) {
      permitAmount = Number(charges.permit) || 0;
    } else if (foreignStates.length > 0) {
      permitAmount = categoryPermitMap.get(catId) || 0;
    } else {
      permitAmount = 0; // Same state / intra-state = 0
    }

    const mergedCharges = {
      ...defaultCharges,
      ...charges,
      permit: permitAmount,
    };

    const pricing = calculateVehiclePrice({
      rate: {
        rateModel: rate.rateModel,
        baseRatePerDay: rate.baseRatePerDay,
        includedKmPerDay: rate.includedKmPerDay,
        extraKmRate: rate.extraKmRate,
        driverBataPerDay: rate.driverBataPerDay,
      },
      serviceDays,
      chargeableKm,
      charges: mergedCharges,
      surchargePercent,
      cabnexMarginPercent: effectiveCabnexMarginPercent,
      taxSlab: rate.taxSlab || 0,
      fixedRouteBase,
    });

    return {
      _id: (rate.vehicleCategory?._id || rate.vehicleCategory).toString(),
      vehicleCategory: rate.vehicleCategory,
      type: rate.vehicleCategory,
      rateId: rate._id,
      baseFare: pricing.baseVehicleCost,
      extraKmCharges: pricing.kmCost,
      totalDriverAllowance: pricing.driverBata,
      totalNightCharge: pricing.nightHalt,
      totalPermitCharge: pricing.permit,
      totalDays: pricing.serviceDays,
      freeKmPerDay: rate.includedKmPerDay,
      extraKmRate: rate.extraKmRate,
      surchargeName: matchedPeriod,
      foreignStatesEntered: foreignStates,
      ...pricing,
    };
  });

  return {
    categories,
    state,
    baseState,
    foreignStatesEntered: foreignStates,
    pickupCity: pickupCity.city,
    surchargeInfo: {
      percent: surchargePercent,
      matchedPeriod,
    },
    agentGrade: agentGradeName,
    markupInfo: {
      appliedMarkupPercent: effectiveCabnexMarginPercent,
      source: commissionInfo.source,
      ruleId: commissionInfo.rule?._id || null,
    },
  };
}
