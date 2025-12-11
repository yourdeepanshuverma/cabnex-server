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
  resetPassword,
  searchCarsForTrip,
  sendForgotPasswordOtp,
  travelQuery,
  updateDetails,
  userStats,
  verifyForgotPasswordOtp,
  withoutPaymentBooking,
} from "../controllers/auth.js";
import { getAuthCookies } from "../middlewares/authMiddleware.js";

const router = Router();

// Public routes
router.post("/register", register);
router.post("/login", login);
router.post("/travel-query", travelQuery);

router.post("/send-forget-otp", sendForgotPasswordOtp);
router.post("/verify-forget-otp", verifyForgotPasswordOtp);
router.post("/reset-password", resetPassword);

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

router.post("/bookings/without-payment", withoutPaymentBooking);

router.post("/logout", logout);

export default router;
