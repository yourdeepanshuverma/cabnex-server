import crypto from "crypto";
import Razorpay from "razorpay";
import Booking from "../models/Booking.js";
import asyncHandler from "../utils/asyncHandler.js  ";
import ErrorResponse from "../utils/ErrorResponse.js";
import SuccessResponse from "../utils/SuccessResponse.js";
import Transaction from "../models/Transaction.js";
import axios from "axios";
import User from "../models/User.js";
import sendEmail from "../utils/sendEmail.js";
import {
  renderActivityInfo,
  renderItinerary,
  renderRentalInfo,
} from "../utils/helper.js";

const getRazorpayKey = asyncHandler(async (req, res) => {
  res
    .status(200)
    .json(
      new SuccessResponse(
        200,
        "Razorpay Key fetched",
        process.env.RAZORPAY_KEY_ID,
      ),
    );
});

const createRazorpayOrder = asyncHandler(async (req, res, next) => {
  try {
    const price = Number(req.body.price);

    if (!price || price <= 0) {
      return next(new ErrorResponse(400, "Invalid price amount"));
    }

    const amountInPaise = Number((price * 100).toFixed(0));

    const instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const options = {
      amount: amountInPaise, // amount in paise
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
      },
    );

    const p = paymentData.data;

    let payload = {};

    const activities = req.body.addons?.map((addon) => addon.activityId);

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
        activities,
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

    const bookingObj = newBooking.toObject();

    const populatedBooking = await Booking.findById(newBooking._id)
      .select("activities packageId packageType")
      .populate("activities", "name price duration -_id")
      .populate("packageId", "kilometer duration title description")
      .lean();

    res.status(200).json(
      new SuccessResponse(200, "Payment verified successfully", {
        booking: { ...bookingObj, paymentStatus: p.status },
      }),
    );

    const isFull =
      Number(newBooking.recievedAmount) >= Number(newBooking.totalAmount);

    await sendEmail(
      user.email,
      "Welcome to Cabnex!",
      `<body style="margin:0; padding:0; background:#f4f6fb; font-family:Arial, Helvetica, sans-serif; color:#0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px;">
      <tr>
        <td align="center">
          <table width="680" cellpadding="0" cellspacing="0"
            style="width:100%; max-width:680px; background:#ffffff; border-radius:8px; padding:24px;">

            <!-- Header -->
            <tr>
              <td>
                <table width="100%">
                  <tr>
                    <td>
                      <img src="https://res.cloudinary.com/dxmxn1uyb/image/upload/v1762762553/cabnex/61b6a9e1-45ff-40cd-98cc-3dae304e85db.png"
                        width="140" alt="Cabnex" />
                    </td>
                    <td align="right" style="font-size:12px; color:#94a3b8;">
                      <a href="https://www.cabnex.in" style="color:#94a3b8;">www.cabnex.in</a>
                    </td>
                  </tr>
                </table>
                <hr style="border:0; border-top:1px solid #eef2f7; margin:18px 0;">
              </td>
            </tr>

            <!-- Greeting -->
            <tr>
              <td>
                <h2 style="margin:0 0 10px;">Dear Travel Partner,</h2>

                <p style="color:#475569; line-height:1.6;">
                  Thank you for choosing <strong>Cabnex</strong>.
                </p>

                <p style="color:#475569; line-height:1.6;">
                  We have successfully received your booking request,
                  along with the <strong>${
                    isFull ? "full payment" : "part payment"
                  }</strong> for the same.
                  Your request is currently under process and our operations team is reviewing the details.
                </p>
              </td>
            </tr>

            <!-- Booking Summary -->
            <tr>
              <td>
                <div style="background:#f8fafc; padding:14px; border-radius:6px; padding:14px; margin:16px 0; font-size:14px;">
                <p><strong>Booking ID:</strong> ${newBooking.bookingId}</p>
                <p><strong>Pickup Location:</strong> ${newBooking.startLocation.address}</p>
                <p><strong>Date & Time:</strong>
                  ${newBooking.pickupDateTime.toISOString().split("T")[0]}
                  at ${newBooking.pickupDateTime.toISOString().split("T")[1].slice(0, 5)}
                </p>

                ${
                  newBooking.serviceType
                    ? `<p><strong>Service Type:</strong> ${newBooking.serviceType.toUpperCase()}</p>`
                    : ""
                }
                ${
                  newBooking.carCategory
                    ? `<p><strong>Vehicle Type:</strong> ${newBooking.carCategory}</p>`
                    : ""
                }

                <p><strong>Total Amount:</strong> ₹${newBooking.totalAmount}</p>

                ${
                  isFull
                    ? `<p><strong>Payment Status:</strong> Fully Paid</p>`
                    : `<p><strong>Amount Paid:</strong> ₹${newBooking.recievedAmount}</p>
                       <p><strong>Payment Type:</strong> Part Payment</p>`
                }

                ${
                  serviceType.toLowerCase() === "outstation" ||
                  serviceType.toLowerCase() === "transfer"
                    ? renderItinerary(newBooking.destinations)
                    : ""
                }

                ${
                  serviceType.toLowerCase() === "rental"
                    ? renderRentalInfo(populatedBooking)
                    : ""
                }

                ${
                  serviceType.toLowerCase() === "activity"
                    ? renderActivityInfo(populatedBooking)
                    : ""
                }

                ${
                  populatedBooking?.activities?.length > 0
                    ? renderAddons(populatedBooking.activities)
                    : ""
                }

              </div>
              </td>
            </tr>

            <!-- Info -->
            <tr>
              <td>
                <p style="font-size:14px; line-height:1.6; color:#475569;">
                  Once the booking is confirmed, driver and vehicle details
                  will be shared approximately <strong>4 hours prior</strong>
                  to pickup.
                </p>

                <p style="font-size:14px; line-height:1.6; color:#475569;">
                  For any assistance, please contact us:<br>
                  📞 <a href="tel:+919667284400">+91 96672 84400</a><br>
                  📧 <a href="mailto:sales@cabnex.in">sales@cabnex.in</a>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td>
                <hr style="border:0; border-top:1px solid #eef2f7; margin:16px 0;">
                <p style="font-size:13px; color:#94a3b8;">
                  Warm regards,<br>
                  <strong>Team Cabnex</strong><br>
                  Seamless B2B Mobility Solutions
                </p>
              </td>
            </tr>

            <tr>
              <td align="center" style="font-size:12px; color:#94a3b8;">
                © Cabnex — All rights reserved.
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>`,
    );
  } catch (err) {
    console.error(err);
    next(new ErrorResponse(500, "Payment verification failed"));
  }
});

export { createRazorpayOrder, getRazorpayKey, verifyRazorpayPayment };
