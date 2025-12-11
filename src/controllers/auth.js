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
import {
  calculateTax,
  generateOtp,
  getCityFromPlaceId,
  getTotalDays,
} from "../utils/helper.js";
import redis from "../utils/redisClient.js";
import { sendOtpSms } from "../utils/smsService.js";
import SuccessResponse from "../utils/SuccessResponse.js";
import sendEmail from "../utils/sendEmail.js";

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

  await sendEmail(
    user.email,
    "Welcome to Cabnex!",
    `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" class="container" cellpadding="0" cellspacing="0">
          <tr>
            <td class="card">
              <!-- Logo -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align:left;">
                    <img src="https://res.cloudinary.com/dxmxn1uyb/image/upload/v1762762553/cabnex/61b6a9e1-45ff-40cd-98cc-3dae304e85db.png" alt="Cabnex" width="140" style="display:block;">
                  </td>
                  <td style="text-align:right; vertical-align:middle;">
                    <a href="https://www.cabnex.in" target="_blank" style="font-size:12px; color:#94a3b8;">www.cabnex.in</a>
                  </td>
                </tr>
              </table>

              <!-- Intro -->
              <hr style="border:none; border-top:1px solid #eef2f7; margin:18px 0 20px;">
              <h1>Dear Travel Partner,</h1>

              <p>
                We are pleased to confirm your successful registration as a valued partner with <strong>www.cabnex.in</strong>.
                Your profile is now active. You can access exclusive business offers, collaborate on tailored travel solutions, and stay updated on the latest deals.
              </p>

              <p class="meta">
                Our onboarding team will contact you soon to provide assistance and a product demo. In the meantime, if you have any questions or require help, please contact our partnership support team.
              </p>

              <!-- CTA & contact -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;">
                <tr>
                  <td style="padding-top:8px;">
                    <a href="https://www.cabnex.in" target="_blank" 
                    style="background-color:#0ea5a4; color:#ffffff; padding:12px 24px; text-decoration:none; border-radius:6px; display:inline-block; font-weight:bold;"
                    >Visit Cabnex</a>
                  </td>
                </tr>
              </table>

              <p style="margin-top:18px;">
                If you need immediate assistance, contact us at:
              </p>

              <p style="margin-bottom:4px;"><strong>Email:</strong> <a href="mailto:info@cabnex.in" target="_blank" style="color:#0ea5a4; text-decoration:none;">info@cabnex.in</a></p>
              <p style="margin-top:0;"><strong>Phone:</strong> <a href="tel:+919667284400" target="_blank" style="color:#0ea5a4; text-decoration:none;">+91 96672 84400</a></p>

              <p style="margin-top:18px;">
                We look forward to a successful and mutually beneficial collaboration.
              </p>

              <p style="margin-top:20px;"><strong>Best regards,<br>Team Cabnex</strong></p>

            </td>
          </tr>

          <tr>
            <td class="footer">
              © <strong>Cabnex</strong> — All rights reserved.<br>
              <a href="https://www.cabnex.in" target="_blank" style="color:#94a3b8; text-decoration:underline;">www.cabnex.in</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
    `
  );
});

// Login user
const login = asyncHandler(async (req, res, next) => {
  let { email, password, mobile } = req.body;
  email = email?.toLowerCase().trim();
  mobile = mobile?.trim();

  const user = await User.findOne({ $or: [{ mobile }, { email }] }).select(
    "+password"
  );

  if (user.isVerified === "pending") {
    return next(
      new ErrorResponse(
        403,
        "Your account verification is still pending. Please wait for approval or contact support."
      )
    );
  }

  if (user.isVerified === "rejected") {
    return next(
      new ErrorResponse(
        403,
        "Your account verification has been rejected. Please contact support for further assistance."
      )
    );
  }

  if (user.isBlocked) {
    return next(
      new ErrorResponse(
        403,
        "Your account has been blocked. Please contact support for further assistance."
      )
    );
  }

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
    let [distance, time] = await Promise.all([
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

    let allCityCharges = {};
    let totalHillCharge = 0;

    await Promise.all(
      destinations.map(async (placeId) => {
        const cityName = await getCityFromPlaceId(placeId);
        const city = await City.findOne({
          isActive: true,
          city: {
            $regex: new RegExp(`^${cityName}`, "i"),
          },
        }).select("category bufferKm");

        if (!city) return null;

        distance += city?.bufferKm || 0;
        totalHillCharge += city?.hillCharge || 0;

        // format output — category wise permitCharge
        city.category.forEach((cat) => {
          const id = cat.type.toString();

          if (!allCityCharges[id]) {
            allCityCharges[id] = {
              permitCharge: 0,
            };
          }

          allCityCharges[id].permitCharge += cat.permitCharge || 0;
        });
      })
    );

    const updatedCategories = activeCategories.map((category) => {
      const id = category.type._id.toString();
      let totalAmount = 0;

      const totalPermitCharge =
        category.permitCharge + (allCityCharges[id]?.permitCharge || 0);

      const days = getTotalDays(pickupDateTime, returnDateTime) || 1;

      category.baseFare = category.freeKmPerDay * days * category.perKmCharge;

      totalAmount += category.baseFare;
      totalAmount += totalHillCharge;
      totalAmount += totalPermitCharge;

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
        totalHillCharge,
        totalPermitCharge,
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

const withoutPaymentBooking = asyncHandler(async (req, res, next) => {
  let payload = {};

  const user = await User.findById(req.user._id);
  if (!user) {
    return next(new ErrorResponse(404, "User not found"));
  }

  if (serviceType.toLowerCase() === "outstation") {
    payload = {
      userId: req.user._id,
      city: req.body.city,
      carCategory: req.body.carCategory,
      serviceType: req.body.serviceType,
      exactLocation: req.body.exactLocation,
      pickupDateTime: req.body.pickupDateTime,
      startLocation: req.body.startLocation,
      destinations: req.body.destinations,
      returnDateTime: req.body.returnDateTime,
      distance: req.body.distance,
      totalAmount: req.body.totalAmount,
      recievedAmount: 0,
      tripType: req.body.oneWay
        ? "one"
        : req.body.destinations.length > 1
        ? "multi"
        : "round",
    };
  } else if (serviceType.toLowerCase() === "rental") {
    payload = {
      userId: req.user._id,
      city: req.body.city,
      carCategory: req.body.carCategory,
      serviceType: req.body.serviceType,
      exactLocation: req.body.exactLocation,
      packageType: "RentalPackage",
      packageId: req.body.packageId,
      pickupDateTime: req.body.pickupDateTime,
      startLocation: req.body.startLocation,
      totalAmount: req.body.totalAmount,
      recievedAmount: 0,
    };
  } else if (serviceType.toLowerCase() === "transfer") {
    payload = {
      userId: req.user._id,
      city: req.body.city,
      carCategory: req.body.carCategory,
      serviceType: req.body.serviceType,
      exactLocation: req.body.exactLocation,
      pickupDateTime: req.body.pickupDateTime,
      startLocation: req.body.startLocation,
      destinations: req.body.destinations,
      totalAmount: req.body.totalAmount,
      recievedAmount: 0,
    };
  } else if (serviceType.toLowerCase() === "activity") {
    payload = {
      userId: req.user._id,
      city: req.body.city,
      serviceType: req.body.serviceType,
      packageType: "ActivityPackage",
      packageId: req.body.packageId,
      exactLocation: req.body.exactLocation,
      pickupDateTime: req.body.pickupDateTime,
      startLocation: req.body.startLocation,
      totalAmount: req.body.totalAmount,
      recievedAmount: 0,
    };
  }

  const newBooking = await Booking.create(payload);

  if (!newBooking) {
    return next(new ErrorResponse(500, "Failed to create booking"));
  }

  res
    .status(200)
    .json(new SuccessResponse(200, "Booking created successfully", newBooking));

  await sendEmail(
    user.email,
    "Welcome to Cabnex!",
    `<body style="margin:0; padding:0; background:#f4f6fb; font-family:Arial, Helvetica, sans-serif; color:#0f172a;">
        <!-- Outer wrapper -->
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px; background:#f4f6fb;">
          <tr>
            <td align="center">
    
              <!-- Container -->
              <table width="680" cellpadding="0" cellspacing="0" style="width:100%; max-width:680px; background:#ffffff; border-radius:8px; padding:24px; box-shadow:0 6px 18px rgba(15,23,42,0.06);">
    
                <!-- Header -->
                <tr>
                  <td style="padding-bottom:20px;">
    
                    <table width="100%">
                      <tr>
                        <td style="text-align:left;">
                          <img src="https://res.cloudinary.com/dxmxn1uyb/image/upload/v1762762553/cabnex/61b6a9e1-45ff-40cd-98cc-3dae304e85db.png"
                            width="140" alt="Cabnex" style="display:block; border:0;">
                        </td>
    
                        <td style="text-align:right; font-size:12px; color:#94a3b8;">
                          <a href="https://www.cabnex.in" target="_blank" style="color:#94a3b8; text-decoration:underline;">www.cabnex.in</a>
                        </td>
                      </tr>
                    </table>
    
                    <hr style="border:0; border-top:1px solid #eef2f7; margin-top:18px;">
                  </td>
                </tr>
    
                <!-- Greeting -->
                <tr>
                  <td>
                    <h1 style="margin:0 0 12px 0; font-size:20px; color:#0f172a;">Dear Travel Partner,</h1>
    
                    <p style="margin:0 0 14px 0; font-size:15px; line-height:1.6; color:#475569;">
                      Your ground transportation booking with <strong>Cabnex</strong> has been successfully confirmed.
                    </p>
                  </td>
                </tr>
    
                <!-- Booking Summary -->
                <tr>
                  <td>
                    <div style="background:#f8fafc; border-radius:6px; padding:14px; margin:12px 0; font-size:14px; color:#0f172a; line-height:1.6;">
                      
                      <p style="margin:6px 0;"><strong>Booking ID:</strong> ${
                        newBooking.bookingId
                      }</p>
                      <p style="margin:6px 0;"><strong>Pickup Location:</strong> ${
                        newBooking.exactLocation +
                        " ," +
                        newBooking.startLocation.address
                      }</p>
                      <p style="margin:6px 0;"><strong>Date &amp; Time:</strong> ${
                        newBooking?.pickupDateTime?.toISOString().split("T")[0]
                      } at 
                       ${newBooking?.pickupDateTime
                         ?.toISOString()
                         .split("T")[1]
                         .slice(0, 5)}</p>
                      ${
                        serviceType === "Transfer" &&
                        `<p style="margin:6px 0;"><strong>Drop Location:</strong> ${newBooking.dropAddress[0].address}</p>`
                      }
                      ${
                        serviceType === "Outstation" &&
                        `<p style="margin:6px 0;">
                      <strong>Destinations:</strong><br/>
                      ${newBooking.destinations
                        .map(
                          (d) =>
                            `<span style="display:block; margin:2px 0;">• ${d.address}</span>`
                        )
                        .join("")}
                    </p>`
                      }
                      <p style="margin:6px 0;"><strong>Vehicle:</strong> ${
                        newBooking.carCategory
                      }</p>
                      <p style="margin:6px 0;"><strong>Total Amount:</strong> ₹${
                        newBooking.totalAmount
                      } (Paid: ₹${newBooking.recievedAmount})</p>
                      <p style="margin:6px 0;"><strong>OPT for: Book now pay later</strong></p>
    
                    </div>
                  </td>
                </tr>
    
                <!-- Driver Info -->
                <tr>
                  <td>
                    <p style="margin:0 0 14px 0; font-size:14px; line-height:1.6; color:#475569;">
                      Driver details will be shared <strong>4 hours prior</strong> to the pickup for operational coordination.
                    </p>
    
                    <p style="margin:0 0 20px 0; font-size:14px; line-height:1.6; color:#475569;">
                      For assistance, contact our support desk:<br>
                      <a href="tel:+919667284400" style="color:#0ea5a4; text-decoration:none;" target="_blank">+91 96672 84400</a>
                    </p>
                  </td>
                </tr>
    
                <!-- Footer -->
                <tr>
                  <td>
                    <hr style="border:0; border-top:1px solid #eef2f7; margin:10px 0 16px;">
                    
                    <p style="margin:0 0 4px 0; font-size:14px; color:#475569;">
                      <strong>Cabnex</strong> | Nexfleet Tech Solutions Pvt Ltd
                    </p>
    
                    <p style="margin:0;">
                      <a href="https://www.cabnex.in" style="color:#0ea5a4; text-decoration:none;" target="_blank">www.cabnex.in</a>
                    </p>
    
                    <p style="margin:18px 0 0 0; font-size:13px; color:#94a3b8;">
                      Best regards,<br>
                      <strong>Team Cabnex</strong>
                    </p>
                  </td>
                </tr>
    
                <!-- Copyright -->
                <tr>
                  <td style="text-align:center; padding-top:24px; font-size:13px; color:#94a3b8;">
                    © Cabnex — All rights reserved.
                  </td>
                </tr>
    
              </table>
    
            </td>
          </tr>
        </table>
    
      </body>`
  );
});

export {
  withoutPaymentBooking,
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
};
