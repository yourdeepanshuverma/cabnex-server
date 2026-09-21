import mongoose, { model, Schema, Types } from "mongoose";

const routeSchema = new Schema(
  {
    fromCity: {
      type: Types.ObjectId,
      ref: "City",
      required: [true, "From city is required."],
    },
    toCity: {
      type: Types.ObjectId,
      ref: "City",
      required: [true, "To city is required."],
    },
    distanceKm: {
      type: Number,
      required: [true, "Distance in KM is required."],
      min: [0, "Distance cannot be negative."],
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  },
);

// Compound unique index — one entry per directional route
routeSchema.index({ fromCity: 1, toCity: 1 }, { unique: true });

const Route = mongoose.models.Route || model("Route", routeSchema);

export default Route;
