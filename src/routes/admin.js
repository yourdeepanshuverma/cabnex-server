import { Router } from "express";
import {
  addCarCategory,
  addCarToCategory,
  addNewCategoryToCity,
  addNewCategoryToTransfer,
  addNewCity,
  addNewTransfer,
  adminLogin,
  adminLogout,
  allBookings,
  allUsers,
  allVendors,
  assignVendorToBooking,
  bookingStats,
  carStats,
  checkAdmin,
  contactUsFormSubmission,
  createUser,
  createVendor,
  createWebsiteSetting,
  dashboardStats,
  deleteCarCategory,
  getAllCarCategories,
  getAllCars,
  getAllTransfers,
  getBookingDetails,
  getCarDetails,
  getCities,
  getCityNames,
  getTravelQueries,
  getUserDetails,
  getVendorDetails,
  getWebsiteSetting,
  rejectBooking,
  toggleCategoryStatusFromCity,
  toggleCategoryStatusFromTransfer,
  updateACar,
  updateAVendor,
  updateCarCategory,
  updateCategoryFromCity,
  updateCategoryFromTransfer,
  updateWebsiteSettingBasics,
  userStats,
  vendorStats,
} from "../controllers/admin.js";
import { getAdminCookies } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/mutler.js";

const router = Router();

router.get("/website-setting", getWebsiteSetting);
router.post("/login", adminLogin);
router.get("/car-categories", getAllCarCategories);
router.post("/contact-us", contactUsFormSubmission);

router.use(getAdminCookies);

// Website settings routes
router
  .route("/website-setting")
  .post(createWebsiteSetting)
  .put(upload.any(), updateWebsiteSettingBasics);

router.get("/check", checkAdmin);

// Dashboard routes
router.get("/dashboard-stats", dashboardStats);

// User management routes
router.get("/user-stats", userStats);
router.get("/users", allUsers);
router.get("/users/:id", getUserDetails);

// Booking management routes
router.get("/booking-stats", bookingStats);
router.get("/bookings", allBookings);
router.get("/bookings/:id", getBookingDetails);
router.post("/bookings/:id/assign-vendor/:vendorId", assignVendorToBooking);
router.post("/bookings/:id/reject-booking", rejectBooking);

// Vendor management routes
router.get("/vendor-stats", vendorStats);
router.get("/vendors", allVendors);
router.route("/vendors/:id").get(getVendorDetails).patch(updateAVendor);

// City management routes
router.route("/cities-names").get(getCityNames);
router.route("/cities").get(getCities).post(addNewCity);
router.route("/cities/:cityId").put(addNewCategoryToCity);
router
  .route("/cities/:cityId/category/:categoryId")
  .put(updateCategoryFromCity)
  .patch(toggleCategoryStatusFromCity);

// Car categories management routes
router.route("/car-categories").post(
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "icon", maxCount: 1 },
  ]),
  addCarCategory
);
router
  .route("/car-categories/:id")
  .put(
    upload.fields([
      { name: "image", maxCount: 1 },
      { name: "icon", maxCount: 1 },
    ]),
    updateCarCategory
  )
  .patch(addCarToCategory)
  .delete(deleteCarCategory);

// Travel queries management routes
router.get("/travel-queries", getTravelQueries);

// Car management routes
router.get("/car-stats", carStats);
router.get("/cars", getAllCars);
router.route("/cars/:id").get(getCarDetails).patch(updateACar);

// Transfer management routes
router.route("/transfers").get(getAllTransfers).post(addNewTransfer);
router.route("/transfers/:transferId").put(addNewCategoryToTransfer);

router
  .route("/transfers/:transferId/category/:categoryId")
  .put(updateCategoryFromTransfer)
  .patch(toggleCategoryStatusFromTransfer);

router.post("/create-user", createUser);
router.post("/create-vendor", createVendor);

// Admin logout route
router.post("/logout", adminLogout);

export default router;
