import Booking from "../models/Booking.js";
import Car from "../models/Car.js";
import Vendor from "../models/Vendor.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from "../utils/cloudinary.js";
import ErrorResponse from "../utils/ErrorResponse.js";
import generateToken from "../utils/generateToken.js";
import { generateOtp, vendorMonthlyBookings } from "../utils/helper.js";
import redis from "../utils/redisClient.js";
import sendEmail from "../utils/sendEmail.js";
import { sendOtpSms } from "../utils/smsService.js";
import SuccessResponse from "../utils/SuccessResponse.js";

const cookieOptions = {
  maxAge: 1000 * 60 * 60 * 24 * 30,
  httpOnly: true,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  secure: process.env.NODE_ENV === "production",
};

// Get vendor statistics
const vendorStats = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ assignedVendor: req.vendorId });
  const totalBookings = bookings.length;
  const inProgressBookings = bookings.filter(
    (booking) => booking.status === "inProgress"
  ).length;
  const completedBookings = bookings.filter(
    (booking) => booking.status === "completed"
  ).length;

  res.status(200).json(
    new SuccessResponse(200, "Vendor stats retrieved successfully", {
      totalBookings,
      inProgressBookings,
      completedBookings,
    })
  );
});

// Get vendor details
const getVendor = asyncHandler(async (req, res, next) => {
  const vendorId = req.vendorId;

  const vendor = await Vendor.findById(vendorId);

  if (!vendor) {
    return next(new ErrorResponse(404, "Vendor not found"));
  }

  res
    .status(200)
    .json(
      new SuccessResponse(200, "Vendor retrieved successfully", { vendor })
    );
});

// Register vendor
const vendorRegister = asyncHandler(async (req, res, next) => {
  const { contactPerson, company, email, contactPhone, password, pan, gst } =
    req.body;

  const vendorExists = await Vendor.findOne({
    email,
    contactPhone,
  });

  if (vendorExists) {
    return next(new ErrorResponse(400, "Vendor already exists"));
  }

  const newVendor = await Vendor.create({
    contactPerson,
    company,
    email,
    contactPhone,
    password,
    pan,
    gst,
  });

  if (!newVendor) {
    return next(new ErrorResponse(400, "Failed to create vendor"));
  }

  res
    .status(201)
    .cookie("cabnex_vendor", generateToken(newVendor._id), cookieOptions)
    .json(new SuccessResponse(201, "Vendor created successfully", newVendor));

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

// Login vendor
const vendorLogin = asyncHandler(async (req, res, next) => {
  let { email, contactPhone, password } = req.body;
  email = email?.toLowerCase().trim();
  contactPhone = contactPhone?.trim();

  const vendor = await Vendor.findOne({
    $or: [{ email }, { contactPhone }],
  }).select("+password");

  if (!vendor) {
    return next(new ErrorResponse(401, "Invalid email or password"));
  }

  if (!(await vendor.isPasswordCorrect(password))) {
    return next(new ErrorResponse(401, "Invalid email or password"));
  }

  res
    .status(200)
    .cookie("cabnex_vendor", generateToken(vendor._id), cookieOptions)
    .json(new SuccessResponse(200, "Vendor logged in successfully", vendor));
});

// Update vendor profile
const updateVendorProfile = asyncHandler(async (req, res, next) => {
  const vendor = await Vendor.findById(req.vendorId).select("+password");

  if (req.files.profile) {
    const profile = await uploadToCloudinary([req.files.profile[0]]);
    req.body.profile = profile[0];
    if (vendor.profile?.public_id) {
      await deleteFromCloudinary([vendor.profile]);
    }
  }
  if (req.files.panImage) {
    const panImage = await uploadToCloudinary([req.files.panImage[0]]);
    req.body.panImage = panImage[0];
    if (vendor.panImage?.public_id) {
      await deleteFromCloudinary([vendor.panImage]);
    }
  }
  if (req.files.gstImage) {
    const gstImage = await uploadToCloudinary([req.files.gstImage[0]]);
    req.body.gstImage = gstImage[0];
    if (vendor.gstImage?.public_id) {
      await deleteFromCloudinary([vendor.gstImage]);
    }
  }

  Object.assign(vendor, req.body);
  await vendor.save({ validateBeforeSave: false });

  res
    .status(200)
    .json(
      new SuccessResponse(200, "Vendor profile updated successfully", vendor)
    );
});

// Logout vendor
const logoutVendor = asyncHandler(async (req, res, next) => {
  res
    .status(200)
    .clearCookie("cabnex_vendor", cookieOptions)
    .json(new SuccessResponse(200, "Vendor logged out successfully"));
});

// Forget password - send OTP
const sendForgotPasswordOtp = asyncHandler(async (req, res, next) => {
  const { phone } = req.body;

  if (!phone || !/^[6-9]\d{9}$/.test(phone))
    return next(new ErrorResponse(400, "Invalid phone number"));

  const vendor = await Vendor.findOne({ contactPhone: phone });
  if (!vendor) return next(new ErrorResponse(404, "Vendor not found"));

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
  await redis.setex(`resetVendorToken:${phone}`, 600, "verified"); // 10 min reset token

  res
    .status(200)
    .json(
      new SuccessResponse(200, "OTP verified, you may now reset your password.")
    );
});

// Reset password
const resetPassword = asyncHandler(async (req, res, next) => {
  const { phone, newPassword } = req.body;

  const verified = await redis.get(`resetVendorToken:${phone}`);

  if (!verified)
    return next(
      new ErrorResponse(403, "Session expired. Please reverify OTP.")
    );

  const vendor = await Vendor.findOne({ contactPhone: phone });
  if (!vendor) return next(new ErrorResponse(404, "Vendor not found"));

  vendor.password = newPassword;
  await vendor.save();

  await redis.del(`resetVendorToken:${phone}`); // invalidate token
  res.status(200).json(new SuccessResponse(200, "Password reset successfully"));
});

// Get vendor cars
const getVendorCars = asyncHandler(async (req, res, next) => {
  const vendorId = req.vendorId;

  const cars = await Car.find({ vendor: vendorId });

  res
    .status(200)
    .json(new SuccessResponse(200, "Vendor cars retrieved successfully", cars));
});

// Get a vendor car
const getAVendorCar = asyncHandler(async (req, res, next) => {
  const vendorId = req.vendorId;
  const { id } = req.params;
  const car = await Car.findOne({ _id: id, vendor: vendorId });
  if (!car) {
    return next(new ErrorResponse(404, "Car not found"));
  }
  res
    .status(200)
    .json(new SuccessResponse(200, "Vendor car retrieved successfully", car));
});

// Add vendor car
const addVendorCar = asyncHandler(async (req, res, next) => {
  const vendorId = req.vendorId;

  const vendor = await Vendor.findById(vendorId);

  if (!vendor.isVerified) {
    return next(
      new ErrorResponse(404, "Cannot add car. You're not verified yet.")
    );
  }

  const carExists = await Car.findOne({
    registrationNumber: req.body.registrationNumber,
  });

  if (carExists) {
    return next(new ErrorResponse(400, "Car already exists"));
  }

  const images = await uploadToCloudinary(req.files);

  const newCar = await Car.create({ ...req.body, vendor: vendorId, images });

  if (!newCar) {
    return next(new ErrorResponse(400, "Failed to add car"));
  }

  await vendor.cars.push(newCar._id);
  await vendor.save({ validateBeforeSave: false });

  res
    .status(201)
    .json(new SuccessResponse(201, "Car added successfully", newCar));
});

// Update vendor car
const updateVendorCar = asyncHandler(async (req, res, next) => {
  const vendorId = req.vendorId;
  const { id } = req.params;

  const car = await Car.findOne({ _id: id, vendor: vendorId });

  if (!car) {
    return next(new ErrorResponse(404, "Car not found"));
  }

  if (req.files && req.files.length > 0) {
    const images = await uploadToCloudinary(req.files);
    req.body.images = images;
    await deleteFromCloudinary(car.images);
  }

  const updatedCar = await Car.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!updatedCar) {
    return next(new ErrorResponse(400, "Failed to update car"));
  }

  res
    .status(200)
    .json(new SuccessResponse(200, "Car updated successfully", updatedCar));
});

// Delete vendor car
const deleteVendorCar = asyncHandler(async (req, res, next) => {
  const vendorId = req.vendorId;
  const { id } = req.params;

  const car = await Car.findOne({ _id: id, vendor: vendorId });

  if (!car) {
    return next(new ErrorResponse(404, "Car not found"));
  }

  await deleteFromCloudinary(car.images);

  await car.deleteOne();

  res.status(200).json(new SuccessResponse(200, "Car deleted successfully"));
});

// Get vendor dashboard statistics
const dashboardStats = asyncHandler(async (req, res, next) => {
  const [bookings, cars] = await Promise.all([
    Booking.find({ assignedVendor: req.vendorId }).populate("userId").sort({
      createdAt: -1,
    }),
    Car.find({ vendor: req.vendorId }),
  ]);

  const totalCars = cars.length;

  const approvedCars = cars.filter(
    (car) => car.isVerified === "approved"
  ).length;

  const pendingCars = cars.filter((car) => car.isVerified === "pending").length;

  const assignedBookings = bookings.filter(
    (booking) => booking.status === "inProgress"
  ).length;

  const completedBookings = bookings.filter(
    (booking) => booking.status === "completed"
  ).length;

  const upcomingBookings = bookings.filter(
    (booking) =>
      booking.status === "inProgress" &&
      new Date(booking.pickupDateTime) > new Date()
  ).length;

  const recentBookings = bookings.slice(0, 5);

  const monthlyBookings = vendorMonthlyBookings(bookings, 6);

  res.status(200).json(
    new SuccessResponse(200, "Vendor dashboard Statistics", {
      totalCars,
      approvedCars,
      pendingCars,
      assignedBookings,
      completedBookings,
      upcomingBookings,
      recentBookings,
      monthlyBookings,
    })
  );
});

// Get vendor bookings
const vendorBookings = asyncHandler(async (req, res, next) => {
  const bookings = await Booking.find({ assignedVendor: req.vendorId })
    .populate("userId")
    .sort({
      createdAt: -1,
    });

  res
    .status(200)
    .json(
      new SuccessResponse(
        200,
        "Vendor bookings retrieved successfully",
        bookings
      )
    );
});

// Complete booking
const completeBooking = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const booking = await Booking.findOne({
    bookingId: id,
    assignedVendor: req.vendorId,
  });

  if (!booking) {
    return next(new ErrorResponse(404, "Booking not found"));
  }
  booking.status = "completed";
  await booking.save({ validateBeforeSave: false });
  res
    .status(200)
    .json(new SuccessResponse(200, "Booking completed successfully", booking));
});

export {
  completeBooking,
  vendorStats,
  getAVendorCar,
  addVendorCar,
  deleteVendorCar,
  vendorBookings,
  getVendor,
  getVendorCars,
  logoutVendor,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPassword,
  updateVendorCar,
  updateVendorProfile,
  vendorLogin,
  vendorRegister,
  dashboardStats,
};
