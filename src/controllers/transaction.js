import crypto from "crypto";
import Razorpay from "razorpay";
import Booking from "../models/Booking.js";
import asyncHandler from "../utils/asyncHandler.js  ";
import ErrorResponse from "../utils/ErrorResponse.js";
import SuccessResponse from "../utils/SuccessResponse.js";
import Transaction from "../models/Transaction.js";
import axios from "axios";
import User from "../models/User.js";

const getRazorpayKey = asyncHandler(async (req, res) => {
  res
    .status(200)
    .json(
      new SuccessResponse(
        200,
        "Razorpay Key fetched",
        process.env.RAZORPAY_KEY_ID
      )
    );
});

const createRazorpayOrder = asyncHandler(async (req, res, next) => {
  try {
    const instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const options = {
      amount: req.body.price * 100, // amount in paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await instance.orders.create(options);

    if (!order) return next(new ErrorResponse(500, "Some error occurred"));
    return res
      .status(200)
      .json(new SuccessResponse(200, "Order created", order));
  } catch (err) {
    console.error(err);
    return next(new ErrorResponse(500, "Failed to create order"));
  }
});

// Verify Razorpay Payment
const verifyRazorpayPayment = asyncHandler(async (req, res, next) => {
  try {
    const {
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature,
      serviceType,
    } = req.body;

    // ✅ Verify signature
    const sign = razorpayOrderId + "|" + razorpayPaymentId;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (razorpaySignature !== expectedSign) {
      return next(new ErrorResponse(400, "Invalid signature"));
    }

    // Fetch payment details from Razorpay API
    const paymentData = await axios.get(
      `https://api.razorpay.com/v1/payments/${razorpayPaymentId}`,
      {
        auth: {
          username: process.env.RAZORPAY_KEY_ID,
          password: process.env.RAZORPAY_KEY_SECRET,
        },
      }
    );

    const p = paymentData.data;

    let payload = {};

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
        recievedAmount: p.amount / 100,
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
        recievedAmount: p.amount / 100,
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
        recievedAmount: p.amount / 100,
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
        recievedAmount: p.amount / 100,
      };
    }

    const newBooking = await Booking.create(payload);

    if (!newBooking) {
      return next(new ErrorResponse(500, "Failed to create booking"));
    }

    // Create Transaction entry
    const transaction = await Transaction.create({
      user: req.user._id,
      booking: newBooking._id,
      city: req.body.city,
      razorpay: {
        order_id: razorpayOrderId,
        payment_id: razorpayPaymentId,
        signature: razorpaySignature,
      },
      amount: p.amount / 100,
      currency: p.currency,
      status: p.status,
      paymentMethod: p.method,
    });

    const user = await User.findById(req.user._id);

    newBooking.transaction = transaction._id;
    user.bookings.push(newBooking._id);

    await user.save();
    await newBooking.save();

    return res.status(200).json(
      new SuccessResponse(200, "Payment verified successfully", {
        booking: newBooking,
      })
    );
  } catch (err) {
    console.error(err);
    next(new ErrorResponse(500, "Payment verification failed"));
  }
});

export { createRazorpayOrder, getRazorpayKey, verifyRazorpayPayment };
