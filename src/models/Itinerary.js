import mongoose from "mongoose";

// Schema for Day-by-Day Details
const DayPlanSchema = new mongoose.Schema(
  {
    day: {
      type: Number,
      required: true,
    },
    destinationId: {
      type: String,
      required: true,
    },
    destinationName: {
      type: String,
      required: true,
    },
    // Hotel Stay Configuration
    hotelId: {
      type: String,
      default: "",
    },
    hotelName: {
      type: String,
      default: "",
    },
    rateId: {
      type: String,
      default: "",
    },
    roomTypeId: {
      type: String,
      default: "",
    },
    roomTypeName: {
      type: String,
      default: "",
    },
    occupancyType: {
      type: String,
      enum: ["single", "double", "triple", "quad", ""],
      default: "double",
    },
    childWithBedSelected: {
      type: Boolean,
      default: false,
    },
    extraAdultSelected: {
      type: Boolean,
      default: false,
    },
    mealPlan: {
      type: String,
      default: "",
    },
    // Vehicle / Transport Configuration
    vehicleId: {
      type: String,
      default: "",
    },
    vehicleName: {
      type: String,
      default: "",
    },
    // Sightseeing / Activity Configuration
    activityId: {
      type: String,
      default: "",
    },
    activityName: {
      type: String,
      default: "",
    },
    // Auto-generated details & title
    title: {
      type: String,
      default: "",
    },
    details: {
      type: String,
      default: "",
    },
    // Cost breakdown for this specific day (snapshot of rates at the time of creation)
    costs: {
      hotelCost: { type: Number, default: 0 },
      vehicleCost: { type: Number, default: 0 },
      activityCost: { type: Number, default: 0 },
      dayTotal: { type: Number, default: 0 },
    },
  },
  { _id: false },
);

// Main Itinerary Schema
const ItinerarySchema = new mongoose.Schema(
  {
    // Customer / Lead Details
    customer: {
      fullName: {
        type: String,
        required: true,
        trim: true,
      },
      email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
      },
      mobile: {
        type: String,
        required: true,
        trim: true,
      },
      remarks: {
        type: String,
        default: "",
      },
    },

    // Trip Metadata
    trip: {
      destinations: [
        {
          id: { type: String },
          name: { type: String },
        },
      ],
      startDate: {
        type: Date,
        required: true,
      },
      endDate: {
        type: Date,
        required: true,
      },
      totalDays: {
        type: Number,
        required: true,
      },
      travelers: {
        adults: { type: Number, default: 2, min: 1 },
        children: { type: Number, default: 0, min: 0 },
        infants: { type: Number, default: 0, min: 0 },
      },
    },

    // Day-wise Itinerary Plans
    dayPlans: [DayPlanSchema],

    // Calculated Pricing Summary
    pricing: {
      totalHotels: {
        type: Number,
        required: true,
        default: 0,
      },
      totalTransfers: {
        type: Number,
        required: true,
        default: 0,
      },
      totalActivities: {
        type: Number,
        required: true,
        default: 0,
      },
      grandTotal: {
        type: Number,
        required: true,
        default: 0,
      },
      currency: {
        type: String,
        default: "INR",
      },
    },

    // Status and Tracking
    status: {
      type: String,
      enum: ["draft", "pending_quote", "quoted", "confirmed", "cancelled"],
      default: "pending_quote",
    },
    querySource: {
      type: String,
      default: "website_custom_planner",
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for fast query search
ItinerarySchema.index({ "customer.email": 1 });
ItinerarySchema.index({ "customer.mobile": 1 });
ItinerarySchema.index({ "trip.startDate": 1 });
ItinerarySchema.index({ status: 1 });

export default mongoose.models.Itinerary ||
  mongoose.model("Itinerary", ItinerarySchema);
