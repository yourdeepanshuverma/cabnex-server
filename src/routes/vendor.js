import { Router } from "express";
import {
  addVendorCar,
  completeBooking,
  dashboardStats,
  deleteVendorCar,
  getAVendorCar,
  getVendor,
  getVendorCars,
  logoutVendor,
  resetPassword,
  sendForgotPasswordOtp,
  updateVendorCar,
  updateVendorProfile,
  vendorBookings,
  vendorLogin,
  vendorRegister,
  vendorStats,
  verifyForgotPasswordOtp,
} from "../controllers/vendor.js";
import { getVendorCookies } from "../middlewares/authMiddleware.js";
import { createArrayUpload, upload } from "../middlewares/mutler.js";

const router = Router();

// Public routes
router.post("/register", vendorRegister);
router.post("/login", vendorLogin);
router.post("/send-forget-otp", sendForgotPasswordOtp);
router.post("/verify-forget-otp", verifyForgotPasswordOtp);
router.post("/reset-password", resetPassword);

// Protected routes
router.use(getVendorCookies);

router
  .route("/me")
  .get(getVendor)
  .put(
    upload.fields([
      { name: "profile", maxCount: 1 },
      { name: "panImage", maxCount: 1 },
      { name: "gstImage", maxCount: 1 },
    ]),
    updateVendorProfile
  );
router.get("/stats", vendorStats);

router.get("/dashboard", dashboardStats);

router
  .route("/cars")
  .get(getVendorCars)
  .post(createArrayUpload("images", 10), addVendorCar);

router
  .route("/cars/:id")
  .get(getAVendorCar)
  .put(createArrayUpload("images", 10), updateVendorCar)
  .delete(deleteVendorCar);

router.get("/bookings", vendorBookings);
router.put("/bookings/:id", completeBooking);

router.post("/logout", logoutVendor);

export default router;
