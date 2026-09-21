import mongoose, { model, Schema, Types } from "mongoose";

const garageSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Garage name is required."],
      trim: true,
      unique: true,
    },
    garageCity: {
      type: Types.ObjectId,
      ref: "City",
      required: [true, "Garage base city is required."],
    },
    assignedCities: [
      {
        type: Types.ObjectId,
        ref: "City",
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const Garage = mongoose.models.Garage || model("Garage", garageSchema);

export default Garage;
