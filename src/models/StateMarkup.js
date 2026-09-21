import mongoose, { model, Schema, Types } from "mongoose";

const stateMarkupSchema = new Schema(
  {
    state: {
      type: String,
      required: [true, "State is required."],
      trim: true,
      set: (v) => v?.toLowerCase().trim().replace(/\s+/g, "-"),
    },
    city: {
      type: Types.ObjectId,
      ref: "City",
      default: null, // null means applies to all cities in this state
    },
    markupPercent: {
      type: Number,
      required: [true, "Markup percentage is required."],
      min: [0, "Markup percentage cannot be negative."],
      max: [1, "Markup percentage cannot exceed 100% (1.0)."],
      default: 0.05,
    },
    markupType: {
      type: String,
      enum: ["percentage", "flat"],
      default: "percentage",
    },
    flatAmount: {
      type: Number,
      min: [0, "Flat markup amount cannot be negative."],
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

// Compound index: Unique rule per state + city combination
stateMarkupSchema.index({ state: 1, city: 1 }, { unique: true });

const StateMarkup =
  mongoose.models.StateMarkup || model("StateMarkup", stateMarkupSchema);

export default StateMarkup;
