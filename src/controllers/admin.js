import Booking from "../models/Booking.js";
import Car from "../models/Car.js";
import CarCategory from "../models/CarCategory.js";
import City from "../models/City.js";
import ContactUsForm from "../models/ContactUsForm.js";
import Transfer from "../models/Transfer.js";
import TravelQuery from "../models/TravelQuery.js";
import User from "../models/User.js";
import Vendor from "../models/Vendor.js";
import WebsiteSetting from "../models/WebsiteSetting.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from "../utils/cloudinary.js";
import ErrorResponse from "../utils/ErrorResponse.js";
import generateToken from "../utils/generateToken.js";
import {
  generateBookingChartData,
  generateRevenueChartData,
  generateVendorCarChartData,
} from "../utils/helper.js";
import SuccessResponse from "../utils/SuccessResponse.js";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// Get website setting
const getWebsiteSetting = asyncHandler(async (req, res, next) => {
  const setting = await WebsiteSetting.findOne();
  if (!setting) {
    return next(new ErrorResponse(404, "Website setting not found"));
  }
  res.status(200).json(
    new SuccessResponse(200, "Website setting fetched successfully", {
      setting,
    })
  );
});

// Create website setting
const createWebsiteSetting = asyncHandler(async (req, res, next) => {
  const existingSetting = await WebsiteSetting.findOne();

  if (existingSetting) {
    return next(new ErrorResponse(400, "Website setting already exists"));
  }

  const setting = await WebsiteSetting.create(req.body);

  if (!setting) {
    return next(new ErrorResponse(400, "Failed to create website setting"));
  }

  res
    .status(201)
    .json(new SuccessResponse(201, "Website setting created successfully"));
});

// Update website setting basics
const updateWebsiteSettingBasics = asyncHandler(async (req, res, next) => {
  const setting = await WebsiteSetting.findOne();
  if (!setting) {
    return next(new ErrorResponse(404, "Website setting not found"));
  }

  // --- Upload Logo ---
  if (req.files?.logo?.[0]) {
    const logo = await uploadToCloudinary([req.files.logo[0]]);
    req.body.logo = logo[0];
    // Delete old logo from Cloudinary if exists
    if (setting.logo?.public_id) {
      await deleteFromCloudinary([setting.logo]);
    }
  }

  // --- Upload Favicon ---
  if (req.files?.favicon?.[0]) {
    const favicon = await uploadToCloudinary([req.files.favicon[0]]);
    req.body.favicon = favicon[0];
    // Delete old favicon from Cloudinary if exists
    if (setting.favicon?.public_id) {
      await deleteFromCloudinary([setting.favicon]);
    }
  }

  if (req.body) {
  }

  if (req?.files?.length) {
    for (const file of req.files) {
      const match = file.fieldname.match(/reviews\[(\d+)\]\[profile\]/);

      if (!match) continue;

      const index = parseInt(match[1], 10);

      // Ensure review exists
      if (setting.reviews[index]) {
        const uploaded = await uploadToCloudinary([file]);

        // Delete old profile image from Cloudinary if exists
        const existingProfile = setting.reviews[index]?.profile;
        if (existingProfile?.public_id) {
          await deleteFromCloudinary([existingProfile]);
        }

        setting.reviews[index] = {
          name: req.body.reviews[index].name,
          role: req.body.reviews[index].role,
          rating: req.body.reviews[index].rating,
          comment: req.body.reviews[index].comment,
          profile: {
            url: uploaded[0].url,
            public_id: uploaded[0].public_id,
          },
        };
      } else {
        const uploaded = await uploadToCloudinary([file]);
        setting.reviews[index] = {
          name:
            req.body.reviews &&
            req.body.reviews[index] &&
            req.body.reviews[index].name
              ? req.body.reviews[index].name
              : "Anonymous",
          role:
            req.body.reviews &&
            req.body.reviews[index] &&
            req.body.reviews[index].role
              ? req.body.reviews[index].role
              : "Customer",
          rating:
            req.body.reviews &&
            req.body.reviews[index] &&
            req.body.reviews[index].rating
              ? req.body.reviews[index].rating
              : 5,
          comment:
            req.body.reviews &&
            req.body.reviews[index] &&
            req.body.reviews[index].comment
              ? req.body.reviews[index].comment
              : "",
          profile: {
            url: uploaded[0].url,
            public_id: uploaded[0].public_id,
          },
        };
      }
    }
  } else if (req.body.reviews) {
    // If no files uploaded, just update reviews data
    setting.reviews.map((review, index) => {
      if (req.body.reviews[index]) {
        review.name = req.body.reviews[index].name || review.name;
        review.role = req.body.reviews[index].role || review.role;
        review.rating = req.body.reviews[index].rating || review.rating;
        review.comment = req.body.reviews[index].comment || review.comment;
      }
    });
  }

  // --- Update all other fields ---
  if (!req.body.reviews) setting.set(req.body);
  await setting.save({ validateBeforeSave: false });

  res
    .status(200)
    .json(new SuccessResponse(200, "Website setting updated successfully"));
});

// Check admin route
const checkAdmin = asyncHandler(async (_, res) => {
  res.status(200).json(new SuccessResponse(200, "You are admin"));
});

// Login admin
const adminLogin = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (
    email !== process.env.adminMail ||
    password !== process.env.adminPassword
  ) {
    return next(new ErrorResponse(401, "Invalid admin credentials"));
  }

  const token = generateToken(email);

  res
    .status(200)
    .cookie("cabnex-admin", token, cookieOptions)
    .json(new SuccessResponse(200, "Welcome Boss!", { token }));
});

// Logout admin
const adminLogout = asyncHandler(async (_, res) => {
  res
    .status(200)
    .clearCookie("cabnex-admin", cookieOptions)
    .json(new SuccessResponse(200, "Logged out successfully"));
});

// Get dashboard statistics
const dashboardStats = asyncHandler(async (_, res, next) => {
  const [bookings, vendors, cars] = await Promise.all([
    Booking.find()
      .populate("userId", "fullName")
      .populate("assignedVendor", "name")
      .sort({ bookingId: -1 }),
    Vendor.find(),
    Car.find(),
  ]);

  const now = new Date();

  // Total bookings
  const totalBookings = bookings.length;

  // Active bookings (pickup <= now <= return OR pickup <= now and no returnDate)
  const activeBookings = bookings.filter((b) => {
    const pickup = new Date(b.pickupDateTime);
    const returnDate = b.returnDateTime ? new Date(b.returnDateTime) : null;
    const active =
      b.status === "inProgress" &&
      pickup <= now &&
      (!returnDate || now <= returnDate);
    return active && b.assignedVendor != null;
  });

  const pendingBookings = bookings.filter((b) => b.status === "pending");

  const upcomingBookings = bookings.filter(
    (b) => new Date(b.pickupDateTime) > now && b.status === "inProgress"
  );

  const completedBookings = bookings.filter((b) => b.status === "completed");

  // ─────── BOOKING CHART ────────────────
  const bookingChartData = generateBookingChartData(bookings);

  // ─────── REVENUE CHART ────────────────
  const revenueChartData = generateRevenueChartData(bookings);

  // ─────── VENDOR-CAR CHART ─────────────
  const vendorCarChartData = generateVendorCarChartData(vendors, cars);

  // ──────────────── IN-PROGRESS TABLE DATA ────────────────
  const inProgressTable = activeBookings
    .map((b) => ({
      bookingId: b.bookingId,
      userName: b.userId?.fullName || "N/A",
      carCategory: b.carCategory || "N/A",
      serviceType: b.serviceType || "N/A",
      totalDays: b.returnDateTime
        ? Math.ceil(
            (new Date(b.returnDateTime) - new Date(b.pickupDateTime)) / 86400000
          )
        : 0,
      totalAmount: b.totalAmount,
      status: b.status,
    }))
    .slice(0, 10);

  // ──────────────── PENDING BOOKINGS TABLE DATA ────────────────

  const pendingBookingsTable = pendingBookings.map((b) => ({
    bookingId: b.bookingId,
    city: b.city,
    userName: b.userId?.fullName || "N/A",
    carCategory: b.carCategory || "N/A",
    serviceType: b.serviceType || "N/A",
    pickupDateTime: b.pickupDateTime,
    startLocation: b.startLocation?.address || "N/A",
    destinations: b.destinations?.map((d) => d.address) || [],
    type: b.tripType,
    totalAmount: b.totalAmount,
    status: b.status,
    createdAt: b.createdAt,
  }));

  return res.status(200).json(
    new SuccessResponse(200, "Dashboard statistics fetched successfully", {
      bookings: [
        { title: "Total Bookings", stats: totalBookings, tag: "total" },
        {
          title: "Active Bookings",
          stats: activeBookings.length,
          tag: "active",
        },
        {
          title: "Upcoming Bookings",
          stats: upcomingBookings.length,
          tag: "upcoming",
        },
        {
          title: "Completed Bookings",
          stats: completedBookings.length,
          tag: "completed",
        },
      ],
      charts: {
        bookingChartData,
        revenueChartData,
        vendorCarChartData,
      },
      inProgressTable,
      pendingBookingsTable,
    })
  );
});

// Get user statistics
const userStats = asyncHandler(async (_, res) => {
  const [totalUsers, userWithBookings, userWithoutBookings] = await Promise.all(
    [
      User.countDocuments(),
      User.countDocuments({ bookings: { $exists: true, $ne: [] } }),
      User.countDocuments({ bookings: { $exists: true, $eq: [] } }),
    ]
  );

  res.status(200).json(
    new SuccessResponse(200, "User statistics fetched successfully", [
      { title: "Total Users", stats: totalUsers },
      { title: "User with Bookings", stats: userWithBookings },
      { title: "User without Bookings", stats: userWithoutBookings },
    ])
  );
});

// Get all users
const allUsers = asyncHandler(async (req, res) => {
  const { search, page = 1, resultPerPage = 10 } = req.query;
  const skip = (page - 1) * resultPerPage;

  const [users, totalCount] = await Promise.all([
    User.find(
      search
        ? {
            $or: [
              { fullName: { $regex: search, $options: "i" } },
              { email: { $regex: search, $options: "i" } },
              { mobile: { $regex: search, $options: "i" } },
            ],
          }
        : {}
    )
      .select("fullName email mobile createdAt")
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(resultPerPage),
    User.countDocuments(),
  ]);

  const totalPages = Math.ceil(totalCount / resultPerPage);

  res.status(200).json(
    new SuccessResponse(200, "Users fetched successfully", {
      totalCount,
      totalPages,
      currentPage: Number(page),
      data: users,
    })
  );
});

// Get user details
const getUserDetails = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const user = await User.findById(id).populate(
    "bookings",
    "bookingId serviceType pickupDateTime totalAmount recievedAmount status assignedVendor createdAt"
  );
  if (!user) {
    return next(new ErrorResponse(404, "User not found"));
  }
  res
    .status(200)
    .json(new SuccessResponse(200, "User fetched successfully", user));
});

// Get booking statistics
const bookingStats = asyncHandler(async (_, res) => {
  const bookings = await Booking.find();
  const totalBookings = bookings.length;
  const ActiveBookings = bookings.filter(
    (b) =>
      (b.status === "inProgress" ||
        new Date(b.returnDateTime) >= new Date(b.pickupDateTime)) &&
      b.assignedVendor != null
  ).length;
  const pendingBookings = bookings.filter((b) => b.status === "pending").length;
  const cancelledBookings = bookings.filter(
    (b) => b.status === "cancelled"
  ).length;

  res.status(200).json(
    new SuccessResponse(200, "Booking statistics fetched successfully", [
      {
        title: "Total Bookings",
        stats: totalBookings,
      },
      {
        title: "Active Bookings",
        stats: ActiveBookings,
      },
      {
        title: "Pending Bookings",
        stats: pendingBookings,
      },
      {
        title: "Cancelled Bookings",
        stats: cancelledBookings,
      },
    ])
  );
});

// get all bookings
const allBookings = asyncHandler(async (req, res) => {
  const { search = "", status, page, resultPerPage = 10 } = req.query;
  const skip = (page - 1) * resultPerPage;

  const filter = {};

  if (search) {
    filter.$or = [
      { bookingId: { $regex: search, $options: "i" } },
      { status: { $regex: search, $options: "i" } },
      { carCategory: { $regex: search, $options: "i" } },
    ];
  }

  if (status) {
    filter.status = status;
  }

  const [bookings, totalCount] = await Promise.all([
    Booking.find(filter)
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(resultPerPage)
      .populate("userId", "fullName email mobile")
      .populate("assignedVendor", "contactPerson email company contactPhone"),
    Booking.countDocuments(),
  ]);

  const totalPages = Math.ceil(totalCount / resultPerPage);

  res.status(200).json(
    new SuccessResponse(200, "Bookings fetched successfully", {
      totalCount,
      totalPages,
      currentPage: Number(page),
      data: bookings,
    })
  );
});

// Assign vendor to booking
const assignVendorToBooking = asyncHandler(async (req, res, next) => {
  const { id, vendorId } = req.params;

  const booking = await Booking.findOne({ bookingId: id });
  if (!booking) {
    return next(new ErrorResponse(404, "Booking not found"));
  }
  const vendor = await Vendor.findById(vendorId);
  if (!vendor) {
    return next(new ErrorResponse(404, "Vendor not found"));
  }

  booking.assignedVendor = vendorId;
  booking.status = "inProgress";
  await booking.save();

  vendor.bookings.push(booking._id);
  await vendor.save();

  res
    .status(200)
    .json(new SuccessResponse(200, "Vendor assigned successfully"));
});

// Reject booking
const rejectBooking = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const booking = await Booking.findOne({ bookingId: id });
  if (!booking) {
    return next(new ErrorResponse(404, "Booking not found"));
  }

  booking.status = "cancelled";
  await booking.save();

  res
    .status(200)
    .json(new SuccessResponse(200, "Booking rejected successfully", booking));
});

// Get booking details
const getBookingDetails = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const booking = await Booking.findOne({ bookingId: id })
    .populate("userId", "fullName email mobile")
    .populate("assignedVendor", "contactPerson email company contactPhone");
  if (!booking) {
    return next(new ErrorResponse(404, "Booking not found"));
  }
  res
    .status(200)
    .json(new SuccessResponse(200, "Booking fetched successfully", booking));
});

// Get vendor statistics
const vendorStats = asyncHandler(async (_, res) => {
  const [approved, pending, isBlocked] = await Promise.all([
    Vendor.countDocuments({ isVerified: "approved" }),
    Vendor.countDocuments({ isVerified: "pending" }),
    Vendor.countDocuments({ isBlocked: true }),
  ]);

  res.status(200).json(
    new SuccessResponse(200, "Vendor statistics fetched successfully", [
      { title: "Total Approved", stats: approved },
      { title: "Total Pending", stats: pending },
      { title: "Total Blocked", stats: isBlocked },
    ])
  );
});

// get all vendors
const allVendors = asyncHandler(async (req, res) => {
  const { search = "", status, page = 1, resultPerPage = 10 } = req.query;
  const skip = (page - 1) * resultPerPage;

  // Build filter dynamically
  const filter = {};

  if (status) {
    filter.isVerified = status;
    filter.isBlocked = false;
  }

  if (search) {
    filter.$or = [
      { company: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { contactPerson: { $regex: search, $options: "i" } },
      { contactPhone: { $regex: search, $options: "i" } },
    ];
  }

  const [vendors, totalCount] = await Promise.all([
    Vendor.find({ ...filter })
      .select(
        "company companyType contactPerson email contactPhone isVerified isBlocked createdAt"
      )
      .populate(
        "cars",
        "make model registrationNumber fuelType isVerified status"
      )
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(resultPerPage)
      .populate("cars"),
    Vendor.countDocuments(),
  ]);

  const totalPages = Math.ceil(totalCount / resultPerPage);

  res.status(200).json(
    new SuccessResponse(200, "Vendors fetched successfully", {
      totalCount,
      totalPages,
      currentPage: Number(page),
      data: vendors,
    })
  );
});

// Get vendor details
const getVendorDetails = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const vendor = await Vendor.findById(id)
    .populate(
      "cars",
      "make model registrationNumber fuelType status isVerified "
    )
    .populate(
      "bookings",
      "bookingId serviceType pickupDateTime totalAmount recievedAmount status assignedVendor createdAt"
    );

  if (!vendor) {
    return next(new ErrorResponse(404, "Vendor not found"));
  }

  res.status(200).json(
    new SuccessResponse(200, "Vendor fetched successfully", {
      vendor,
    })
  );
});

// Get all cities
const getCities = asyncHandler(async (req, res, next) => {
  const cities = await City.find({ isActive: true }).populate("category.type");

  if (!cities) {
    return next(new ErrorResponse(404, "No cities found"));
  }
  res
    .status(200)
    .json(new SuccessResponse(200, "Cities fetched successfully", { cities }));
});

// Add city
const addNewCity = asyncHandler(async (req, res, next) => {
  const { city, state, place_id, category } = req.body;

  const cityName = city.toLowerCase().split(" ").join("-");

  const cityExists = await City.findOne({
    city: cityName,
  });

  if (cityExists) {
    return next(new ErrorResponse(400, "City already exists"));
  }

  const newCity = await City.create({
    city: cityName,
    state: state.toLowerCase().split(" ").join("-"),
    place_id: place_id,
    category: category || [],
  });

  if (!newCity) {
    return next(new ErrorResponse(400, "Failed to add city"));
  }

  res.status(201).json(new SuccessResponse(201, "City added successfully"));
});

// Add new category to existing city
const addNewCategoryToCity = asyncHandler(async (req, res, next) => {
  const { cityId } = req.params;
  const categoryData = req.body;

  const city = await City.findById(cityId);

  if (!city) {
    return next(new ErrorResponse(404, "City not found"));
  }

  const categoryExists = city.category.find(
    (cat) => cat.type.toString() === categoryData.type
  );

  if (categoryExists) {
    return next(
      new ErrorResponse(400, "Category with same type already exists")
    );
  }

  city.category.push(categoryData);

  await city.save();

  res
    .status(201)
    .json(new SuccessResponse(201, "Category added to city successfully"));
});

// Update category from existing city
const updateCategoryFromCity = asyncHandler(async (req, res, next) => {
  const { cityId, categoryId } = req.params;

  const categoryData = req.body;
  const city = await City.findById(cityId);
  if (!city) {
    return next(new ErrorResponse(404, "City not found"));
  }
  const categoryIndex = city.category.findIndex(
    (cat) => cat._id.toString() === categoryId
  );
  if (categoryIndex === -1) {
    return next(new ErrorResponse(404, "Category not found in city"));
  }
  city.category[categoryIndex] = {
    ...city.category[categoryIndex]._doc,
    ...categoryData,
  };
  await city.save();
  res
    .status(200)
    .json(new SuccessResponse(200, "Category updated successfully in city"));
});

// Toggle category status from existing city
const toggleCategoryStatusFromCity = asyncHandler(async (req, res, next) => {
  const { cityId, categoryId } = req.params;
  const city = await City.findById(cityId);
  if (!city) {
    return next(new ErrorResponse(404, "City not found"));
  }
  const categoryIndex = city.category.findIndex(
    (cat) => cat._id.toString() === categoryId
  );

  if (categoryIndex === -1) {
    return next(new ErrorResponse(404, "Category not found in city"));
  }

  city.category[categoryIndex].isActive =
    !city.category[categoryIndex].isActive;

  await city.save();

  res
    .status(200)
    .json(new SuccessResponse(200, "Category status toggled successfully"));
});

// Get all car categories
const getAllCarCategories = asyncHandler(async (_, res) => {
  const categories = await CarCategory.find({ isActive: true });
  const totalCount = await CarCategory.countDocuments();

  if (!categories) {
    return next(new ErrorResponse(404, "No car categories found"));
  }

  res.status(200).json(
    new SuccessResponse(200, "Car categories fetched successfully", {
      totalCount,
      categories,
    })
  );
});

// Add car category
const addCarCategory = asyncHandler(async (req, res, next) => {
  const category = req.body.category.toLowerCase().split(" ").join("-");

  const categoryExists = await CarCategory.findOne({
    category,
  });

  if (categoryExists) {
    return next(new ErrorResponse(400, "Car category already exists"));
  }

  if (!req.files) {
    return next(new ErrorResponse(400, "Images are required"));
  }

  if (req.files.image) {
    const image = await uploadToCloudinary([req.files.image[0]]);
    req.body.image = image[0];
  }

  if (req.files.icon) {
    const icon = await uploadToCloudinary([req.files.icon[0]]);
    req.body.icon = icon[0];
  }

  req.body.category = category;

  const addedCategory = await CarCategory.create(req.body);

  if (!addedCategory) {
    await deleteFromCloudinary([
      req.body.image.public_id,
      req.body.icon.public_id,
    ]);
    return next(new ErrorResponse(400, "Failed to add car category"));
  }

  res
    .status(201)
    .json(
      new SuccessResponse(201, "Car category added successfully", addedCategory)
    );
});

// Update car category
const updateCarCategory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const categoryExists = await CarCategory.findById(id);

  if (!categoryExists) {
    return next(new ErrorResponse(404, "Car category not found"));
  }

  if (req.files.image) {
    const image = await uploadToCloudinary([req.files.image[0]]);
    req.body.image = image[0];
    if (categoryExists.image.public_id) {
      await deleteFromCloudinary([categoryExists.image]);
    }
  }

  if (req.files.icon) {
    const icon = await uploadToCloudinary([req.files.icon[0]]);
    req.body.icon = icon[0];
    if (categoryExists.icon.public_id) {
      await deleteFromCloudinary([categoryExists.icon]);
    }
  }

  req.body.category = req.body.category.toLowerCase().split(" ").join("-");

  const updatedCategory = await CarCategory.findOneAndUpdate(
    { _id: id },
    req.body,
    { new: true }
  );

  res.status(200).json(
    new SuccessResponse(200, "Car category updated successfully", {
      updatedCategory,
    })
  );
});

// Add car to category
const addCarToCategory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { carNames } = req.body;

  const categoryExists = await CarCategory.findById(id);

  if (!categoryExists) {
    return next(new ErrorResponse(404, "Car category not found"));
  }

  categoryExists.carNames.push(...carNames);
  await categoryExists.save();

  res
    .status(201)
    .json(new SuccessResponse(201, "Car added to category successfully"));
});

// Delete car category
const deleteCarCategory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const categoryExists = await CarCategory.findById(id);

  if (!categoryExists) {
    return next(new ErrorResponse(404, "Car category not found"));
  }

  await deleteFromCloudinary([categoryExists.image, categoryExists.icon]);

  await categoryExists.deleteOne();

  res
    .status(200)
    .json(new SuccessResponse(200, "Car category deleted successfully"));
});

// Get car statistics
const carStats = asyncHandler(async (req, res, next) => {
  const cars = await Car.find();
  const totalCars = cars.length;
  const approvedCars = cars.filter(
    (car) => car.isVerified === "approved"
  ).length;
  const pendingCars = cars.filter((car) => car.isVerified === "pending").length;

  res.status(200).json(
    new SuccessResponse(200, "Car statistics fetched successfully", [
      { title: "Total Cars", stats: totalCars },
      { title: "Pending Cars", stats: pendingCars },
      { title: "Approved Cars", stats: approvedCars },
    ])
  );
});

// Get all cars
const getAllCars = asyncHandler(async (req, res, next) => {
  const { search = "", page = 1, resultPerPage = 10 } = req.query;
  const skip = (page - 1) * resultPerPage;

  const [cars, totalCount] = await Promise.all([
    Car.find(
      search
        ? {
            $or: [
              { make: { $regex: search, $options: "i" } },
              { model: { $regex: search, $options: "i" } },
              { registrationNumber: { $regex: search, $options: "i" } },
            ],
          }
        : {}
    )
      .select(
        "make model vendor registrationNumber fuelType year status isVerified createdAt"
      )
      .populate("vendor", "company isVerified")
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(resultPerPage),
    Car.countDocuments(),
  ]);

  const totalPages = Math.ceil(totalCount / resultPerPage);

  res.status(200).json(
    new SuccessResponse(200, "Cars fetched successfully", {
      totalCount,
      totalPages,
      currentPage: Number(page),
      data: cars,
    })
  );
});

// Get car details
const getCarDetails = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const car = await Car.findById(id).populate(
    "vendor",
    "company contactPerson email contactPhone companyType isVerified"
  );

  if (!car) {
    return next(new ErrorResponse(404, "Car not found"));
  }
  res
    .status(200)
    .json(new SuccessResponse(200, "Car fetched successfully", car));
});

// Update a vendor
const updateAVendor = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const vendor = await Vendor.findByIdAndUpdate(id, req.body);

  if (!vendor) {
    return next(new ErrorResponse(404, "Vendor not found"));
  }

  res.status(200).json(new SuccessResponse(200, "Vendor updated successfully"));
});

// Update a car
const updateACar = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const car = await Car.findByIdAndUpdate(id, req.body);

  if (!car) {
    return next(new ErrorResponse(404, "Car not found"));
  }

  res.status(200).json(new SuccessResponse(200, "Car updated successfully"));
});

// Add new transfer
const addNewTransfer = asyncHandler(async (req, res, next) => {
  const { name, place_id, type, city, state, category } = req.body;

  req.body.name = name.toLowerCase().split(" ").join("-");
  req.body.city = city.toLowerCase().split(" ").join("-");
  req.body.state = state.toLowerCase().split(" ").join("-");

  const transferExists = await Transfer.findOne({
    $or: [{ place_id }, { name }],
  });

  if (transferExists) {
    return next(
      new ErrorResponse(400, "Place with same name or place ID already exists")
    );
  }

  const transfer = await Transfer.create({
    name,
    place_id,
    type,
    city,
    state,
    category,
  });

  if (!transfer) {
    return next(new ErrorResponse(400, "Failed to create transfer"));
  }

  res
    .status(201)
    .json(new SuccessResponse(201, "Transfer created successfully"));
});

// Get all transfers
const getAllTransfers = asyncHandler(async (req, res, next) => {
  const transfers = await Transfer.find()
    .populate("category.type")
    .sort({ name: 1 });

  res
    .status(200)
    .json(
      new SuccessResponse(200, "Transfers fetched successfully", transfers)
    );
});

// Add new category to existing transfer
const addNewCategoryToTransfer = asyncHandler(async (req, res, next) => {
  const { transferId } = req.params;
  const categoryData = req.body;

  const transfer = await Transfer.findById(transferId);

  if (!transfer) {
    return next(new ErrorResponse(404, "Transfer not found"));
  }

  const categoryExists = transfer.category.find(
    (cat) => cat.type.toString() === categoryData.type
  );

  if (categoryExists) {
    return next(
      new ErrorResponse(400, "Category with same type already exists")
    );
  }

  transfer.category.push(categoryData);

  await transfer.save();

  res
    .status(201)
    .json(new SuccessResponse(201, "Category added to transfer successfully"));
});

// Update category from existing transfer
const updateCategoryFromTransfer = asyncHandler(async (req, res, next) => {
  const { transferId, categoryId } = req.params;

  const categoryData = req.body;
  const transfer = await Transfer.findById(transferId);
  if (!transfer) {
    return next(new ErrorResponse(404, "Transfer not found"));
  }
  const categoryIndex = transfer.category.findIndex(
    (cat) => cat._id.toString() === categoryId
  );
  if (categoryIndex === -1) {
    return next(new ErrorResponse(404, "Category not found in transfer"));
  }
  transfer.category[categoryIndex] = {
    ...transfer.category[categoryIndex]._doc,
    ...categoryData,
  };
  await transfer.save();
  res
    .status(200)
    .json(
      new SuccessResponse(200, "Category updated successfully in transfer")
    );
});

// Toggle transfer visibility
const toggleCategoryStatusFromTransfer = asyncHandler(
  async (req, res, next) => {
    const { transferId, categoryId } = req.params;
    const transfer = await Transfer.findById(transferId);
    if (!transfer) {
      return next(new ErrorResponse(404, "Transfer not found"));
    }
    const categoryIndex = transfer.category.findIndex(
      (cat) => cat._id.toString() === categoryId
    );

    if (categoryIndex === -1) {
      return next(new ErrorResponse(404, "Category not found in transfer"));
    }

    transfer.category[categoryIndex].isActive =
      !transfer.category[categoryIndex].isActive;

    await transfer.save();

    res
      .status(200)
      .json(new SuccessResponse(200, "Category status toggled successfully"));
  }
);

// Get all cities
const getCityNames = asyncHandler(async (req, res) => {
  let cities = await City.find().select("city");

  cities = cities.filter((city) => city.city !== "default");

  res
    .status(200)
    .json(new SuccessResponse(200, "Cities fetched successfully", cities));
});

const createUser = asyncHandler(async (req, res, next) => {
  const { email, mobile } = req.body;
  const userExists = await User.findOne({ $or: [{ email }, { mobile }] });

  if (userExists) {
    return next(new ErrorResponse(400, "User already exists"));
  }

  const user = await User.create(req.body);

  if (!user) {
    return next(new ErrorResponse(400, "Failed to create user"));
  }
  res
    .status(201)
    .json(new SuccessResponse(201, `${user.fullName} created successfully`));
});

const createVendor = asyncHandler(async (req, res, next) => {
  const { company, contactPerson, email, contactPhone, companyType, password } =
    req.body;
  const vendorExists = await Vendor.findOne({
    $or: [{ email }, { contactPhone }],
  });
  if (vendorExists) {
    return next(new ErrorResponse(400, "Vendor already exists"));
  }
  const vendor = await Vendor.create({
    company,
    contactPerson,
    email,
    contactPhone,
    companyType,
    password,
  });

  if (!vendor) {
    return next(new ErrorResponse(400, "Failed to create vendor"));
  }

  res
    .status(201)
    .json(new SuccessResponse(201, `${vendor.company} created successfully`));
});

const getTravelQueries = asyncHandler(async (req, res, next) => {
  const queries = await TravelQuery.find().sort({ createdAt: -1 });
  res
    .status(200)
    .json(
      new SuccessResponse(200, "Travel queries fetched successfully", queries)
    );
});

const contactUsFormSubmission = asyncHandler(async (req, res, next) => {
  const { name, email, subject, message } = req.body;
  await ContactUsForm.create({ name, email, subject, message });

  res
    .status(201)
    .json(new SuccessResponse(201, "Contact us form submitted successfully"));
});

export {
  contactUsFormSubmission,
  getTravelQueries,
  createUser,
  createVendor,
  getCityNames,
  getWebsiteSetting,
  updateCategoryFromTransfer,
  addNewCategoryToTransfer,
  addCarCategory,
  addCarToCategory,
  addNewCategoryToCity,
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
  dashboardStats,
  deleteCarCategory,
  getAllCarCategories,
  getAllCars,
  getAllTransfers,
  getBookingDetails,
  getCarDetails,
  getCities,
  getUserDetails,
  getVendorDetails,
  rejectBooking,
  toggleCategoryStatusFromCity,
  toggleCategoryStatusFromTransfer,
  updateACar,
  updateAVendor,
  updateCarCategory,
  updateCategoryFromCity,
  userStats,
  vendorStats,
  createWebsiteSetting,
  updateWebsiteSettingBasics,
};
