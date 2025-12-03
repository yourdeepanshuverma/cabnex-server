import mongoose, { model, Schema, Types } from "mongoose";

const citySchema = new Schema({
  city: { type: String, required: [true, "City is required."], unique: true },
  place_id: {
    type: String,
    required: [true, "Place ID is required."],
    unique: true,
  },
  category: [
    {
      type: {
        type: Types.ObjectId,
        ref: "CarCategory",
        required: [true, "Category type is required."],
      },
      baseFare: { type: Number, default: 0 },
      marketFare: { type: Number, default: 0 },
      perKmCharge: { type: Number, default: 0 },
      perHourCharge: { type: Number, default: 0 },
      freeKmPerDay: { type: Number, default: 0 },
      freeHoursPerDay: { type: Number, default: 0 },
      extraKmCharge: { type: Number, default: 0 },
      extraHourCharge: { type: Number, default: 0 },
      driverAllowance: { type: Number, default: 0 },
      nightCharge: { type: Number, default: 0 },
      permitCharge: { type: Number, default: 0 },
      taxSlab: { type: Number, default: 0 },
      isActive: { type: Boolean, default: true },
    },
  ],
  activities: [
    {
      type: Types.ObjectId,
      ref: "ActivityPackage",
    },
  ],
  state: {
    type: String,
    required: [true, "State is required."],
    unique: false,
  },
  hillCharge: { type: Number, default: 0 },
  bufferKm: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
});

// 🔥 Ensure no duplicate category type per city
citySchema.pre("save", function (next) {
  const typeIds = this.category.map((c) => c.type.toString());
  const uniqueIds = new Set(typeIds);
  if (uniqueIds.size !== typeIds.length) {
    return next(new Error("Duplicate category type found in city categories."));
  }
  next();
});

const City = mongoose.models.City || model("City", citySchema);

export default City;
