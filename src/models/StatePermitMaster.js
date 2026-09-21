import mongoose, { model, Schema, Types } from "mongoose";

const statePermitMasterSchema = new Schema(
  {
    state: {
      type: String,
      required: [true, "State is required."],
      trim: true,
      set: (v) => v?.toLowerCase().trim().replace(/\s+/g, "-"),
    },
    vehicleCategory: {
      type: Types.ObjectId,
      ref: "CarCategory",
      required: [true, "Vehicle category is required."],
    },
    permitCharge: {
      type: Number,
      required: [true, "Permit charge is required."],
      min: [0, "Permit charge cannot be negative."],
      default: 0,
    },
    remarks: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index: one permit charge per state + vehicle category combination
statePermitMasterSchema.index(
  { state: 1, vehicleCategory: 1 },
  { unique: true }
);

const StatePermitMaster =
  mongoose.models.StatePermitMaster ||
  model("StatePermitMaster", statePermitMasterSchema);

export default StatePermitMaster;
