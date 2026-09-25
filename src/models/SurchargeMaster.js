import mongoose, { model, Schema, Types } from "mongoose";

const surchargeMasterSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Surcharge name is required."],
    },
    city: {
      type: Types.ObjectId,
      ref: "City",
      default: null, // null means applies to all cities (Global)
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required."],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required."],
    },
    surchargePercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 1, // stored as decimal, e.g., 0.10 = 10%
    },
    isActive: { type: Boolean, default: true },
    remarks: { type: String, default: "" },
  },
  {
    timestamps: true,
  },
);

// Validate that endDate is after startDate
surchargeMasterSchema.pre("save", function (next) {
  if (this.endDate <= this.startDate) {
    return next(new Error("End date must be after start date."));
  }
  next();
});

const SurchargeMaster =
  mongoose.models.SurchargeMaster ||
  model("SurchargeMaster", surchargeMasterSchema);

export default SurchargeMaster;
