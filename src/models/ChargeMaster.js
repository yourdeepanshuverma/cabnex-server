import mongoose, { model, Schema } from "mongoose";

const chargeMasterSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Charge name is required."],
      unique: true,
      enum: ["toll", "parking", "permit", "night-halt", "other-charges"],
    },
    type: {
      type: String,
      enum: ["manual", "auto"],
      default: "manual",
    },
    defaultAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  },
);

const ChargeMaster =
  mongoose.models.ChargeMaster || model("ChargeMaster", chargeMasterSchema);

export default ChargeMaster;
