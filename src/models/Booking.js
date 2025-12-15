import { randomUUID } from "crypto";
import mongoose, { model, Schema, Types } from "mongoose";

const bookingSchema = new Schema(
  {
    bookingId: {
      type: String,
      unique: true,
    },
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required."],
    },
    city: {
      type: String,
    },
    carCategory: {
      type: String,
    },
    serviceType: {
      type: String,
      required: [true, "Service type is required."],
      enum: ["rental", "outstation", "transfer", "activity"],
    },
    packageType: {
      type: String,
      enum: ["ActivityPackage", "RentalPackage"],
    },
    packageId: {
      type: Types.ObjectId,
      refPath: "packageType",
    },
    exactLocation: {
      type: String,
      required: [true, "Exact location is required."],
    },
    pickupDateTime: {
      type: Date,
      required: [true, "Pickup date and time is required."],
    },
    startLocation: {
      place_id: {
        type: String,
        required: [true, "Start location place ID is required."],
      },
      address: {
        type: String,
        required: [true, "Start location address is required."],
      },
    },
    destinations: [
      {
        place_id: {
          type: String,
        },
        address: {
          type: String,
        },
      },
    ],
    returnDateTime: {
      type: Date,
    },
    distance: {
      type: Number,
      default: 0, // in kilometers
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    recievedAmount: {
      type: Number,
      default: 0,
    },
    tripType: {
      type: String,
      enum: ["one", "round", "multi"],
    },
    status: {
      type: String,
      enum: ["pending", "inProgress", "confirmed", "cancelled"],
      default: "pending",
    },
    assignedVendor: {
      type: Types.ObjectId,
      ref: "Vendor",
    },
    transaction: {
      type: Types.ObjectId,
      ref: "Transaction",
    },
    activities: [
      {
        type: Types.ObjectId,
        ref: "ActivityPackage",
      },
    ],
  },
  {
    timestamps: true,
  }
);

bookingSchema.pre("save", async function (next) {
  if (this.bookingId) return next();
  this.bookingId = `CN-${randomUUID().slice(0, 8).toUpperCase()}`;
  next();
});

const Booking = mongoose.models.Booking || model("Booking", bookingSchema);

export default Booking;
