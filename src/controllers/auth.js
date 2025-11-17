import axios from "axios";
import Booking from "../models/Booking.js";
import City from "../models/City.js";
import RentalPackage from "../models/RentalPackage.js";
import Transfer from "../models/Transfer.js";
import TravelQuery from "../models/TravelQuery.js";
import User from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";
import ErrorResponse from "../utils/ErrorResponse.js";
import generateToken from "../utils/generateToken.js";
import { calculateTax, generateOtp } from "../utils/helper.js";
import SuccessResponse from "../utils/SuccessResponse.js";
import redis from "../utils/redisClient.js";
import { sendOtpSms } from "../utils/smsService.js";

const cookieOptions = {
  maxAge: 1000 * 60 * 60 * 24 * 30,
  httpOnly: true,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  secure: process.env.NODE_ENV === "production",
};

// Get user statistics
const userStats = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ userId: req.user._id });
  const totalBookings = bookings.length;
  const inProgressBookings = bookings.filter(
    (booking) => booking.status === "inProgress"
  ).length;
  const completedBookings = bookings.filter(
    (booking) => booking.status === "completed"
  ).length;

  res.status(200).json(
    new SuccessResponse(200, "User stats retrieved successfully", {
      totalBookings,
      inProgressBookings,
      completedBookings,
    })
  );
});

// Get currently logged in user
const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return next(new ErrorResponse(404, "User not found"));
  }

  res
    .status(200)
    .json(new SuccessResponse(200, "User retrieved successfully", { user }));
});

// Register a new user
const register = asyncHandler(async (req, res, next) => {
  const { email, mobile } = req.body;

  const existingUser = await User.findOne({ $or: [{ mobile }, { email }] });
  if (existingUser) {
    return next(new ErrorResponse(409, "User already exists"));
  }

  const user = await User.create(req.body);

  if (!user) {
    return next(new ErrorResponse(400, "User registration failed"));
  }
  const userData = {
    _id: user._id,
    fullName: user.fullName,
    email: user.email,
    mobile: user.mobile,
    acceptedTerms: user.acceptedTerms,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };

  res
    .status(201)
    .cookie("cabnex_token", generateToken(user._id, "30d"), cookieOptions)
    .json(new SuccessResponse(201, "User registered successfully", userData));
});

// Login user
const login = asyncHandler(async (req, res, next) => {
  let { email, password, mobile } = req.body;
  email = email?.toLowerCase().trim();
  mobile = mobile?.trim();

  const user = await User.findOne({ $or: [{ mobile }, { email }] }).select(
    "+password"
  );

  if (!user) {
    return next(new ErrorResponse(401, "Invalid email or password"));
  }

  if (!(await user.isPasswordCorrect(password))) {
    return next(new ErrorResponse(401, "Invalid email or password"));
  }

  const userData = {
    _id: user._id,
    fullName: user.fullName,
    email: user.email,
    mobile: user.mobile,
    acceptedTerms: user.acceptedTerms,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };

  return res
    .cookie("cabnex_token", generateToken(user._id, "30d"), cookieOptions)
    .json(new SuccessResponse(200, "User logged in successfully", userData));
});

// Forget password - send OTP
const sendForgotPasswordOtp = asyncHandler(async (req, res, next) => {
  const { phone } = req.body;

  if (!phone || !/^[6-9]\d{9}$/.test(phone))
    return next(new ErrorResponse(400, "Invalid phone number"));

  const user = await User.findOne({ mobile: phone });
  if (!user) return next(new ErrorResponse(404, "User not found"));

  // Prevent resending too fast
  if (await redis.get(`forget_password_otp:${phone}`)) {
    return res
      .status(400)
      .json(new ErrorResponse(400, "OTP already sent. Please wait."));
  }

  const otp = generateOtp();
  await redis.setex(`forget_password_otp:${phone}`, 300, otp); // expires in 5 min

  await sendOtpSms(phone, otp, "password reset");
  res.status(200).json(new SuccessResponse(200, "OTP sent successfully"));
});

// Verify OTP for forget password
const verifyForgotPasswordOtp = asyncHandler(async (req, res, next) => {
  const { phone, otp } = req.body;

  const storedOtp = await redis.get(`forget_password_otp:${phone}`);
  if (!storedOtp) return next(new ErrorResponse(400, "OTP expired or invalid"));
  if (storedOtp !== otp) return next(new ErrorResponse(400, "Invalid OTP"));

  // OTP verified → allow user to reset password
  await redis.del(`forget_password_otp:${phone}`);
  await redis.setex(`resetToken:${phone}`, 600, "verified"); // 10 min reset token

  res
    .status(200)
    .json(
      new SuccessResponse(200, "OTP verified, you may now reset your password.")
    );
});

// Reset password
const resetPassword = asyncHandler(async (req, res, next) => {
  const { phone, newPassword } = req.body;

  const verified = await redis.get(`resetToken:${phone}`);

  if (!verified)
    return next(
      new ErrorResponse(403, "Session expired. Please reverify OTP.")
    );

  const user = await User.findOne({ mobile: phone });
  if (!user) return next(new ErrorResponse(404, "User not found"));

  user.password = newPassword;
  await user.save();

  await redis.del(`resetToken:${phone}`); // invalidate token
  res.status(200).json(new SuccessResponse(200, "Password reset successfully"));
});

// Change password
const changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select("+password");

  if (!user) {
    return next(new ErrorResponse(404, "User not found"));
  }
  if (!(await user.isPasswordCorrect(currentPassword))) {
    return next(new ErrorResponse(401, "Current password is incorrect"));
  }
  user.password = newPassword;
  await user.save();
  res
    .status(200)
    .json(new SuccessResponse(200, "Password changed successfully"));
});

// Update user details
const updateDetails = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id).select("+password");

  if (!user) {
    return next(new ErrorResponse(404, "User not found"));
  }

  Object.assign(user, req.body);
  await user.save();

  res
    .status(200)
    .json(new SuccessResponse(200, "User profile updated successfully", user));
});

// Delete user account
const deleteUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return next(new ErrorResponse(404, "User not found"));
  }

  user.isActive = false;

  await user.save();

  res.status(200).json(new SuccessResponse(200, "User deleted successfully"));
});

// Get user bookings
const getBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ userId: req.user._id }).select(
    "-assignedVendor"
  );

  res
    .status(200)
    .json(
      new SuccessResponse(200, "User bookings retrieved successfully", bookings)
    );
});

// Cancel a booking
const cancelBooking = asyncHandler(async (req, res, next) => {
  const booking = await Booking.findOne({
    bookingId: req.params.id,
    userId: req.user._id,
  });

  if (!booking) {
    return next(new ErrorResponse(404, "Booking not found"));
  }

  if (booking.assignedVendor === null) {
    return next(new ErrorResponse(400, "Cannot cancel unassigned booking"));
  }

  booking.status = "cancelled";
  await booking.save();

  res
    .status(200)
    .json(new SuccessResponse(200, "Booking cancelled successfully"));
});

// Logout user
const logout = asyncHandler(async (req, res) => {
  res
    .status(200)
    .clearCookie("cabnex_token", cookieOptions)
    .json(new SuccessResponse(200, "Logged out successfully"));
});

// Search cars for trip
const searchCarsForTrip = asyncHandler(async (req, res, next) => {
  const {
    pickupLocation,
    serviceType,
    pickupDateTime,
    returnDateTime,
    packageId,
    destinations,
    oneWay,
    transferDirection,
  } = req.body;

  // Validate pickup location using Google Places API
  const { data: placeDetails } = await axios.get(
    "https://maps.googleapis.com/maps/api/place/details/json?",
    {
      params: {
        place_id:
          serviceType === "transfer"
            ? transferDirection === "home-to-station"
              ? destinations[0]
              : pickupLocation
            : pickupLocation,
        key: process.env.GOOGLE_MAPS_API_KEY,
        fields: "name,place_id,address_component",
      },
    }
  );

  if (placeDetails.status !== "OK") {
    return next(new ErrorResponse(400, "Invalid pickup location"));
  }

  // Format the pickup location to match city naming conventions
  const formattedPickupLocation = placeDetails.result.address_components
    .find(
      (comp) =>
        comp.types.includes("locality") ||
        comp.types.includes("administrative_area_level_1")
    )
    ?.long_name.trim()
    .toLowerCase()
    .replace(/\s+/g, "-");

  // Handle transfer service type separately
  if (serviceType === "transfer") {
    let transfer = await Transfer.findOne({
      $or: [
        { place_id: placeDetails?.result?.place_id },
        {
          name: {
            $regex: new RegExp(
              `^${placeDetails?.result?.name
                ?.toLowerCase()
                .split(" ")
                .join("-")}`,
              "i"
            ),
          },
        },
      ],
    }).populate("category.type", "-carNames");

    if (!transfer) {
      transfer = await Transfer.findOne({
        name: "default",
      }).populate("category.type", "-carNames");
    }

    const activeCategories =
      transfer?.category?.filter((cat) => cat.isActive) || [];

    const { data: distanceData } = await axios.get(
      "https://maps.googleapis.com/maps/api/directions/json",
      {
        params: {
          origin: `place_id:${pickupLocation}`,
          destination: `place_id:${destinations[0]}`,
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
      }
    );

    if (distanceData.status !== "OK") {
      return next(new ErrorResponse(400, "Error fetching distance data"));
    }

    // Sum up distances from origin to destination
    // Convert meters to kilometers and round up
    const [distance, time] = await Promise.all([
      Math.ceil(
        distanceData.routes[0].legs.reduce((acc, elem) => {
          acc += elem.distance.value;
          return acc;
        }, 0) / 1000
      ),
      Math.ceil(
        distanceData.routes[0].legs.reduce((acc, elem) => {
          acc += elem.duration.value;
          return acc;
        }, 0) / 60
      ),
    ]);

    const updatedCategories = activeCategories.map((category) => {
      let totalAmount = category.baseFare || 0;
      let extraKmCharges = 0;

      if (distance > category.baseKm) {
        const extraKm = distance - category.baseKm;
        extraKmCharges = extraKm * category.extraKmCharge;
        totalAmount += extraKmCharges;
      }

      const tax = calculateTax(totalAmount, category.taxSlab);

      totalAmount += tax;

      return {
        ...(category.toObject?.() || category), // handle both Mongoose docs or plain JS objects
        totalAmount,
        extraKmCharges,
        tax,
      };
    });

    return res.status(200).json(
      new SuccessResponse(200, "Cars retrieved successfully", {
        city: formattedPickupLocation,
        distance,
        time,
        categories: updatedCategories,
      })
    );
  }

  // Find car categories available in the pickup city
  let categoriesInCity = await City.findOne({
    isActive: true,
    city: {
      $regex: new RegExp(`^${formattedPickupLocation}`, "i"),
    },
  })
    .populate("category.type", "-carNames")
    .select("-activities");

  // Fallback to default city
  if (!categoriesInCity) {
    categoriesInCity = await City.findOne({
      isActive: true,
      city: "default",
    }).populate("category.type", "-carNames");
  }

  const activeCategories =
    categoriesInCity?.category?.filter((cat) => cat.isActive) || [];

  if (destinations && destinations.length > 0) {
    const destinationsParams = oneWay
      ? destinations
      : [...destinations, pickupLocation];

    const origin = `place_id:${pickupLocation}`;
    const destination = `place_id:${
      destinationsParams[destinationsParams.length - 1]
    }`;
    const waypoints = destinationsParams
      .slice(0, -1)
      .map((p) => `place_id:${p}`)
      .join("|");

    // Calculate total distance using Google Distance Matrix API
    const { data: distanceData } = await axios.get(
      "https://maps.googleapis.com/maps/api/directions/json",
      {
        params: {
          origin,
          destination,
          waypoints: waypoints || undefined,
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
      }
    );

    if (distanceData.status !== "OK") {
      return next(new ErrorResponse(400, "Error fetching distance data"));
    }

    // Sum up distances from origin to all destinations
    // Convert meters to kilometers and round up
    const [distance, time] = await Promise.all([
      Math.ceil(
        distanceData.routes[0].legs.reduce((acc, elem) => {
          acc += elem.distance.value;
          return acc;
        }, 0) / 1000
      ),
      Math.ceil(
        distanceData.routes[0].legs.reduce((acc, elem) => {
          acc += elem.duration.value;
          return acc;
        }, 0) / 60
      ),
    ]);

    const updatedCategories = activeCategories.map((category) => {
      let totalAmount = 0;

      const days =
        Math.ceil(
          (new Date(returnDateTime) - new Date(pickupDateTime)) /
            (1000 * 60 * 60 * 24)
        ) || 1;

      category.baseFare = category.freeKmPerDay * days * category.perKmCharge;

      totalAmount += category.baseFare;
      totalAmount += category.hillCharge;

      const totalDriverAllowance = category.driverAllowance * days;
      const totalNightCharge = category.nightCharge * Math.max(days - 1, 0);
      totalAmount += totalDriverAllowance + totalNightCharge;

      const extraKmCharges =
        Math.max(0, distance - category.freeKmPerDay * days) *
        category.extraKmCharge;

      totalAmount += extraKmCharges;

      const tax = calculateTax(totalAmount, category.taxSlab);

      totalAmount += tax;

      return {
        ...(category.toObject?.() || category), // handle both Mongoose docs or plain JS objects
        totalAmount,
        extraKmCharges,
        totalDriverAllowance,
        totalNightCharge,
        totalDays: days,
        totalNights: Math.max(days - 1, 0),
        tax,
      };
    });

    return res.status(200).json(
      new SuccessResponse(200, "Cars retrieved successfully", {
        city: formattedPickupLocation,
        distance,
        time,
        categories: updatedCategories,
      })
    );
  } else {
    if (serviceType === "rental") {
      const rental = await RentalPackage.findById(packageId);

      if (!rental) {
        return next(
          new ErrorResponse(404, "Selected rental package not found")
        );
      }

      const updatedCategories = activeCategories.map((category) => {
        const perHourTotal = rental.duration * category.perHourCharge;
        const perKmTotal = rental.kilometer * category.perKmCharge;

        let totalAmount = Math.max(perHourTotal, perKmTotal);
        category.baseFare = totalAmount;

        const tax = calculateTax(totalAmount, category.taxSlab);

        totalAmount += tax;

        return {
          ...(category.toObject?.() || category), // handle both Mongoose docs or plain JS objects
          totalAmount,
          tax,
        };
      });

      return res.status(200).json(
        new SuccessResponse(200, "Cars retrieved successfully", {
          city: formattedPickupLocation,
          distance: rental.kilometer,
          time: rental.duration * 60,
          categories: updatedCategories,
        })
      );
    }

    if (serviceType === "activity") {
      const activitiesInCity = await City.findOne({
        isActive: true,
        city: {
          $regex: new RegExp(`^${formattedPickupLocation}`, "i"),
        },
      })
        .select("-category")
        .populate("activities");

      const ActiveActivities = activitiesInCity?.activities
        ?.filter((act) => act.isActive)
        .map((activity) => ({ ...activity, totalAmount: activity?.price }));

      return res.status(200).json(
        new SuccessResponse(200, "Activities retrieved successfully", {
          city: formattedPickupLocation,
          activities: ActiveActivities,
        })
      );
    }

    return res.status(200).json(
      new SuccessResponse(200, "Cars retrieved successfully", {
        city: formattedPickupLocation,
        distance: 0,
        time: 0,
        categories: activeCategories,
      })
    );
  }
});

// Submit travel query
const travelQuery = asyncHandler(async (req, res, next) => {
  const newTravelQuery = await TravelQuery.create(req.body);
  if (!newTravelQuery) {
    return next(new ErrorResponse(500, "Failed to submit travel query"));
  }
  res
    .status(201)
    .json(new SuccessResponse(201, "Travel query submitted successfully"));
});

export {
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPassword,
  changePassword,
  userStats,
  cancelBooking,
  deleteUser,
  getBookings,
  getUser,
  login,
  logout,
  register,
  searchCarsForTrip,
  travelQuery,
  updateDetails,
};
