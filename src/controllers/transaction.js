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

    res.status(200).json(
      new SuccessResponse(200, "Payment verified successfully", {
        booking: newBooking,
      })
    );

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
                  } at ${newBooking?.pickupDateTime
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
  } catch (err) {
    console.error(err);
    next(new ErrorResponse(500, "Payment verification failed"));
  }
});

export { createRazorpayOrder, getRazorpayKey, verifyRazorpayPayment };
