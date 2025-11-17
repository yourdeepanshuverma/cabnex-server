import bcrypt from "bcryptjs";
import mongoose, { model, Schema, Types } from "mongoose";

const vendorSchema = new Schema(
  {
    profile: {
      public_id: { type: String, default: "" },
      url: { type: String, default: "" },
    },
    contactPerson: {
      type: String,
      required: [true, "Contact person is required."],
      trim: true,
    },
    company: {
      type: String,
      trim: true,
      required: [true, "Company name is required."],
    },
    email: {
      type: String,
      required: [true, "Email is required."],
      unique: true,
      lowercase: true,
      trim: true,
    },
    contactPhone: {
      type: String,
      required: [true, "Contact phone is required."],
      unique: true,
      maxlength: [10, "Contact phone cannot exceed 10 digits."],
      minlength: [10, "Contact phone must be 10 digits."],
    },
    companyType: {
      type: String,
      enum: ["individual", "company"],
      default: "individual",
    },
    password: {
      type: String,
      required: [true, "Password is required."],
      select: false,
      minlength: [6, "Password must be at least 6 characters long."],
      maxlength: [64, "Password cannot exceed 64 characters."],
    },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" },
    country: { type: String, default: "" },
    cars: [{ type: Types.ObjectId, ref: "Car" }],
    pan: {
      type: String,
      required: [true, "PAN is required."],
    },
    gst: {
      type: String,
      default: "",
    },
    panImage: {
      public_id: { type: String, default: "" },
      url: { type: String, default: "" },
    },
    gstImage: {
      public_id: { type: String, default: "" },
      url: { type: String, default: "" },
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
  },
  {
    timestamps: true,
  }
);

vendorSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

vendorSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

const Vendor = mongoose.models.Vendor || model("Vendor", vendorSchema);

export default Vendor;
