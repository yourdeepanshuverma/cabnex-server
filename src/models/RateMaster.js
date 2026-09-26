import mongoose, { model, Schema, Types } from "mongoose";

const rateMasterSchema = new Schema(
  {
    vehicleCategory: {
      type: Types.ObjectId,
      ref: "CarCategory",
      required: [true, "Vehicle category is required."],
    },
    rateModel: {
      type: String,
      enum: [
        "daily-included-km",
        "daily-all-km",
        "package-fixed-km",
        "fixed-route",
      ],
      required: [true, "Rate model is required."],
    },
    city: {
      type: Types.ObjectId,
      ref: "City",
      required: [true, "City is required."],
    },
    baseRatePerDay: {
      type: Number,
      default: 0,
      min: 0,
    },
    includedKmPerDay: {
      type: Number,
      default: 0,
      min: 0,
    },
    extraKmRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    driverBataPerDay: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxSlab: {
      type: Number,
      default: 5,
      min: 0,
      max: 100,
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  },
);

// Compound unique index — one rate per vehicle/model/city combination
rateMasterSchema.index(
  { vehicleCategory: 1, rateModel: 1, city: 1 },
  { unique: true },
);

const RateMaster =
  mongoose.models.RateMaster || model("RateMaster", rateMasterSchema);

export default RateMaster;
