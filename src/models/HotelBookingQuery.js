import mongoose from "mongoose";

const HotelBookingSchema = new mongoose.Schema(
  {
    customer: {
      fullName: { type: String, required: true, trim: true },
      email: { type: String, required: true, lowercase: true, trim: true },
      mobile: { type: String, required: true, trim: true },
      countryCode: { type: String, default: "+91" },
      remarks: { type: String, default: "" },
    },
    hotel: {
      hotelId: { type: String, required: true },
      name: { type: String, required: true },
      destinationId: { type: String, default: "" },
      destinationName: { type: String, required: true },
      starRating: { type: Number, default: 4 },
      address: { type: String, default: "" },
    },
    selectedRoom: {
      rateId: { type: String, required: true },
      roomTypeId: { type: String, required: true },
      roomTypeName: { type: String, required: true },
      mealPlan: { type: String, default: "EP (Room Only)" },
      rates: {
        single: { type: Number, default: 0 },
        double: { type: Number, default: 0 },
        triple: { type: Number, default: 0 },
        quad: { type: Number, default: 0 },
        extraAdult: { type: Number, default: 0 },
        childWithBed: { type: Number, default: 0 },
      },
    },
    stayDetails: {
      checkInDate: { type: String, required: true },
      checkOutDate: { type: String, required: true },
      totalNights: { type: Number, default: 1 },
      rooms: { type: Number, default: 1 },
      adults: { type: Number, default: 1 },
      children: { type: Number, default: 0 },
      infants: { type: Number, default: 0 },
      purpose: {
        type: String,
        enum: ["Holiday", "Corporate", "Transit"],
        default: "Holiday",
      },
      isPetFriendly: { type: Boolean, default: false },
    },
    status: {
      type: String,
      enum: ["Pending", "Contacted", "Confirmed", "Cancelled"],
      default: "Pending",
    },
    source: { type: String, default: "Website" },
  },
  {
    timestamps: true, // Auto creates createdAt and updatedAt fields
  },
);

export default mongoose.model("HotelBooking", HotelBookingSchema);
