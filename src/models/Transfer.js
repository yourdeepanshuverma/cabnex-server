import mongoose, { Schema } from "mongoose";

const transferSchema = new Schema({
  name: {
    type: String,
    required: [true, "Name is required."],
    unique: true,
  },
  distanceKm: {
    type: Number,
    default: 0,
    min: 0,
  },
  garageCity: {
    type: String,
  },
  garageReturnKm: {
    type: Number,
    default: 0,
    min: 0,
  },
  type: {
    type: String,
    required: [true, "Type is required."],
  },
  city: {
    type: String,
    required: [true, "City is required."],
  },
  state: {
    type: String,
    required: [true, "State is required."],
  },
  category: [
    {
      type: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CarCategory",
        required: [true, "Category type is required."],
      },
      baseFare: {
        type: Number,
        required: [true, "Base fare is required."],
      },
      baseKm: {
        type: Number,
        default: 20,
      },
      extraKmCharge: {
        type: Number,
        default: 15,
      },
      hillCharge: {
        type: Number,
        default: 0,
      },
      taxSlab: {
        type: Number,
        default: 0,
      },
      isActive: {
        type: Boolean,
        default: true,
      },
    },
  ],

  isActive: {
    type: Boolean,
    default: true,
  },
});

const Transfer =
  mongoose.models.Transfer || mongoose.model("Transfer", transferSchema);

export default Transfer;
