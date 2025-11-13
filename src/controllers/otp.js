import asyncHandler from "../utils/asyncHandler.js";
import ErrorResponse from "../utils/ErrorResponse.js";
import { generateOtp } from "../utils/helper.js";
import redis from "../utils/redisClient.js";
import { sendOtpSms } from "../utils/smsService.js";
import SuccessResponse from "../utils/SuccessResponse.js";

/**
 * @route   POST /api/otp/send
 * @desc    Send OTP to user's phone
 */
const sendOtp = asyncHandler(async (req, res, next) => {
  const { phone, forWhat } = req.body;

  if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
    return next(new ErrorResponse(400, "Invalid phone number"));
  }

  try {
    if (await redis.get(`otp:${phone}`)) {
      return res
        .status(200)
        .json(new SuccessResponse(200, "OTP already sent. Please wait."));
    }

    const otp = generateOtp();

    // 1️⃣ Store OTP in Redis (expire in 5 min)
    await redis.setex(`otp:${phone}`, 300, otp);

    // 2️⃣ Send SMS
    await sendOtpSms(phone, otp, forWhat);

    console.log(`📤 OTP ${otp} sent to ${phone}`);
    res.status(200).json(new SuccessResponse(200, "OTP sent successfully"));
  } catch (err) {
    console.error("OTP Send Error:", err.message);
    res.status(500).json(new ErrorResponse(500, "Failed to send OTP"));
  }
});

/**
 * @route   POST /api/otp/verify
 * @desc    Verify OTP entered by user
 */
const verifyOtp = asyncHandler(async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res
        .status(400)
        .json({ success: false, message: "Phone and OTP are required" });
    }

    // 1️⃣ Retrieve OTP from Redis
    const storedOtp = await redis.get(`otp:${phone}`);

    if (!storedOtp) {
      return res
        .status(400)
        .json({ success: false, message: "OTP expired or not found" });
    }

    // 2️⃣ Compare
    if (storedOtp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    // 3️⃣ OTP valid — delete it
    await redis.del(`otp:${phone}`);

    res.json({ success: true, message: "OTP verified successfully" });
  } catch (err) {
    console.error("OTP Verify Error:", err.message);
    res.status(500).json({ success: false, message: "Failed to verify OTP" });
  }
});

export { sendOtp, verifyOtp };
