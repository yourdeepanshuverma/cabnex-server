import { Router } from "express";
import {
  cancelBooking,
  changePassword,
  deleteUser,
  getBookings,
  getUser,
  login,
  logout,
  register,
  searchCarsForTrip,
  travelQuery,
  updateDetails,
  userStats,
} from "../controllers/auth.js";
import { getAuthCookies } from "../middlewares/authMiddleware.js";

const router = Router();

// Public routes
router.post("/register", register);
router.post("/login", login);
router.post("/travel-query", travelQuery);
// router.put("/forget-password", forgetPassword);

// Protected routes
router.use(getAuthCookies);
router.post("/search", searchCarsForTrip);
router
  .route("/me")
  .get(getUser)
  .put(updateDetails)
  .patch(changePassword)
  .delete(deleteUser);
router.get("/stats", userStats);
router.get("/bookings", getBookings);
router.delete("/bookings/:id", cancelBooking);
router.post("/logout", logout);

export default router;
