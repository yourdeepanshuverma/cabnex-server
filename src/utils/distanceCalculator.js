import Route from "../models/Route.js";
import City from "../models/City.js";

/**
 * Get the static distance between two cities from the Route (KM Master) collection.
 * Tries the exact direction first, then the reverse direction.
 *
 * @param {string} fromCityId - ObjectId of the origin city
 * @param {string} toCityId - ObjectId of the destination city
 * @returns {Promise<number>} distance in km, or 0 if same city
 * @throws {Error} if route not found in either direction
 */
export async function getRouteDistance(fromCityId, toCityId) {
  if (fromCityId.toString() === toCityId.toString()) return 0;

  // Try exact direction first
  let route = await Route.findOne({
    fromCity: fromCityId,
    toCity: toCityId,
    isActive: true,
  });

  // Fallback to reverse direction
  if (!route) {
    route = await Route.findOne({
      fromCity: toCityId,
      toCity: fromCityId,
      isActive: true,
    });
  }

  if (!route) {
    // Fetch city names for a better error message
    const [from, to] = await Promise.all([
      City.findById(fromCityId).select("city"),
      City.findById(toCityId).select("city"),
    ]);
    throw new Error(
      `Route not found: ${from?.city || fromCityId} → ${to?.city || toCityId}. Add this route to KM Master.`,
    );
  }

  return route.distanceKm;
}

/**
 * Calculate total intercity distance for a multi-city trip.
 * Each element in cityIds is an ObjectId of a City.
 * Distance is calculated leg-by-leg: [A, B, C] = A→B + B→C
 *
 * @param {string[]} cityIds - Ordered array of city ObjectIds
 * @returns {Promise<{totalIntercityKm: number, legs: Array, routeStatus: string}>}
 */
export async function calculateMultiCityDistance(cityIds) {
  if (!cityIds || cityIds.length < 2) {
    return { totalIntercityKm: 0, legs: [], routeStatus: "NO ROUTE" };
  }

  const legs = [];
  let totalIntercityKm = 0;
  let allRoutesFound = true;

  for (let i = 0; i < cityIds.length - 1; i++) {
    const fromId = cityIds[i];
    const toId = cityIds[i + 1];

    try {
      const distance = await getRouteDistance(fromId, toId);
      legs.push({
        fromCity: fromId,
        toCity: toId,
        distanceKm: distance,
        source: fromId.toString() === toId.toString() ? "SAME CITY" : "KM MASTER",
      });
      totalIntercityKm += distance;
    } catch (err) {
      allRoutesFound = false;
      legs.push({
        fromCity: fromId,
        toCity: toId,
        distanceKm: 0,
        source: "NOT FOUND",
        error: err.message,
      });
    }
  }

  return {
    totalIntercityKm,
    legs,
    routeStatus: allRoutesFound ? "ALL ROUTES FOUND" : "CHECK KM",
  };
}

/**
 * Calculate local/sightseeing KM for a city based on nights staying there.
 *
 * Logic:
 * - 0 nights or 1 night: No local sightseeing KM (just passing through or overnight stay)
 * - 2+ nights: localServiceDays = nightsAtCity - 1 (arrival & departure days = travel days, not sightseeing)
 * - Final Local KM = localKmPerDay × localServiceDays
 *
 * @param {string} cityId - ObjectId of the city
 * @param {number} nightsAtCity - Number of nights staying at this city
 * @returns {Promise<{localKm: number, localKmPerDay: number, localServiceDays: number}>}
 */
export async function getLocalKm(cityId, nightsAtCity) {
  if (!nightsAtCity || nightsAtCity < 2) {
    return { localKm: 0, localKmPerDay: 0, localServiceDays: 0 };
  }

  const city = await City.findById(cityId).select("localKmPerDay city");
  const localKmPerDay = city?.localKmPerDay || 100;

  // Arrival day = travel day (no local sightseeing)
  // Departure day = travel day (no local sightseeing)
  // Full sightseeing days = nightsAtCity - 1
  const localServiceDays = nightsAtCity - 1;
  const localKm = localKmPerDay * localServiceDays;

  return { localKm, localKmPerDay, localServiceDays };
}

/**
 * Calculate the complete trip distance including all components.
 *
 * From Excel Calculator:
 * - Garage → Pickup KM (from KM Master)
 * - Intercity KM (sum of all legs from KM Master)
 * - Local / Sightseeing KM (from Local KM Master × service days per city)
 * - Garage Return KM (drop city → garage city, from KM Master)
 * - Chargeable KM = all of the above
 *
 * @param {Object} params
 * @param {string} params.garageCityId - Garage city ObjectId
 * @param {string} params.pickupCityId - Pickup city ObjectId
 * @param {Array} params.legs - Array of { cityId, nightsAtCity }
 * @param {string} params.dropCityId - Final drop city ObjectId
 * @returns {Promise<Object>} Full distance breakdown
 */
export async function calculateTotalTripKm({
  garageCityId,
  pickupCityId,
  legs,
  dropCityId,
}) {
  // 1. Garage → Pickup KM
  let garageToPickupKm = 0;
  if (
    garageCityId &&
    pickupCityId &&
    garageCityId.toString() !== pickupCityId.toString()
  ) {
    try {
      garageToPickupKm = await getRouteDistance(garageCityId, pickupCityId);
    } catch {
      garageToPickupKm = 0; // If no route, default to 0
    }
  }

  // 2. Intercity KM — build ordered city list for leg-by-leg distance
  const orderedCityIds = [pickupCityId];
  const nightsPerCity = {};

  for (const leg of legs) {
    orderedCityIds.push(leg.cityId);
    nightsPerCity[leg.cityId.toString()] = leg.nightsAtCity || 0;
  }

  const { totalIntercityKm, legs: routeLegs, routeStatus } =
    await calculateMultiCityDistance(orderedCityIds);

  // 3. Local / Sightseeing KM — sum across all destination cities
  let totalLocalKm = 0;
  const localKmBreakdown = [];

  for (const leg of legs) {
    const { localKm, localKmPerDay } = await getLocalKm(
      leg.cityId,
      leg.nightsAtCity,
    );
    totalLocalKm += localKm;
    localKmBreakdown.push({
      cityId: leg.cityId,
      nightsAtCity: leg.nightsAtCity,
      localKmPerDay,
      totalLocalKm: localKm,
    });
  }

  // 4. Garage Return KM — drop city → garage city
  let garageReturnKm = 0;
  const finalDropCity = dropCityId || orderedCityIds[orderedCityIds.length - 1];
  if (
    garageCityId &&
    finalDropCity &&
    garageCityId.toString() !== finalDropCity.toString()
  ) {
    try {
      garageReturnKm = await getRouteDistance(finalDropCity, garageCityId);
    } catch {
      garageReturnKm = 0;
    }
  }

  // 5. Total chargeable KM
  const chargeableKm =
    garageToPickupKm + totalIntercityKm + totalLocalKm + garageReturnKm;

  return {
    garageCityId,
    garageToPickupKm,
    intercityKm: totalIntercityKm,
    localKm: totalLocalKm,
    garageReturnKm,
    chargeableKm,
    routeStatus,
    routeLegs,
    localKmBreakdown,
  };
}
