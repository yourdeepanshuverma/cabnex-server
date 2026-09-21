import { Router } from "express";
import {
  getAllRoutes,
  createRoute,
  updateRoute,
  deleteRoute,
  bulkCreateRoutes,
  getAllRates,
  createRate,
  updateRate,
  deleteRate,
  getAllCharges,
  createCharge,
  updateCharge,
  deleteCharge,
  getAllSurcharges,
  createSurcharge,
  updateSurcharge,
  deleteSurcharge,
  getAllAgentGrades,
  createAgentGrade,
  updateAgentGrade,
  deleteAgentGrade,
  getAllGarages,
  createGarage,
  updateGarage,
  deleteGarage,
  getAllStatePermits,
  createStatePermit,
  updateStatePermit,
  deleteStatePermit,
  getAllStateMarkups,
  createStateMarkup,
  updateStateMarkup,
  deleteStateMarkup,
  getDefaultCommission,
  updateDefaultCommission,
  getPublicCities,
  getPublicTransfers,
} from "../controllers/masterData.js";
import { getAdminCookies } from "../middlewares/authMiddleware.js";

const router = Router();

// ─── Public endpoints (no auth required) ───
router.get("/cities", getPublicCities);
router.get("/transfers", getPublicTransfers);

// ─── Admin-protected endpoints ───
router.use(getAdminCookies);

// Routes (KM Master)
router.route("/routes").get(getAllRoutes).post(createRoute);
router.route("/routes/bulk").post(bulkCreateRoutes);
router.route("/routes/:id").put(updateRoute).delete(deleteRoute);

// Rate Master
router.route("/rate-master").get(getAllRates).post(createRate);
router.route("/rate-master/:id").put(updateRate).delete(deleteRate);

// Charge Master
router.route("/charge-master").get(getAllCharges).post(createCharge);
router.route("/charge-master/:id").put(updateCharge).delete(deleteCharge);

// Surcharge Master
router.route("/surcharge-master").get(getAllSurcharges).post(createSurcharge);
router
  .route("/surcharge-master/:id")
  .put(updateSurcharge)
  .delete(deleteSurcharge);

// Agent Grades
router.route("/agent-grades").get(getAllAgentGrades).post(createAgentGrade);
router
  .route("/agent-grades/:id")
  .put(updateAgentGrade)
  .delete(deleteAgentGrade);

// Garage Master
router.route("/garages").get(getAllGarages).post(createGarage);
router
  .route("/garages/:id")
  .put(updateGarage)
  .delete(deleteGarage);

// State Permit Master
router.route("/state-permits").get(getAllStatePermits).post(createStatePermit);
router
  .route("/state-permits/:id")
  .put(updateStatePermit)
  .delete(deleteStatePermit);

// State Markup Master & Default Commission
router
  .route("/state-markups/default-commission")
  .get(getDefaultCommission)
  .put(updateDefaultCommission);

router.route("/state-markups").get(getAllStateMarkups).post(createStateMarkup);
router
  .route("/state-markups/:id")
  .put(updateStateMarkup)
  .delete(deleteStateMarkup);

export default router;
