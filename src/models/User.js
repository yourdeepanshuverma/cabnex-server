import bcrypt from "bcryptjs";
import mongoose, { model, Schema, Types } from "mongoose";

const userSchema = new Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required."],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required."],
      unique: true,
      lowercase: true,
      trim: true,
    },
    mobile: {
      type: String,
      required: [true, "Mobile number is required."],
      unique: true,
      maxlength: [10, "Mobile number cannot exceed 10 digits."],
      minlength: [10, "Mobile number must be 10 digits."],
    },
    password: {
      type: String,
      required: [true, "Password is required."],
      select: false,
      minlength: [6, "Password must be at least 6 characters long."],
      maxlength: [64, "Password cannot exceed 64 characters."],
    },
    pan: {
      type: String,
    },
    gst: {
      type: String,
    },
    bookings: [{ type: Types.ObjectId, ref: "Booking", default: [] }],
    isVerified: {
      type: String,
      enum: ["approved", "pending", "rejected"],
      default: "pending",
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    acceptedTerms: { type: Boolean, required: true },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

const User = mongoose.models.User || model("User", userSchema);

export default User;
