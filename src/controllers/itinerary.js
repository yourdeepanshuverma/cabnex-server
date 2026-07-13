import Itinerary from "../models/Itinerary.js";
import asyncHandler from "../utils/asyncHandler.js";
import ErrorResponse from "../utils/ErrorResponse.js";
import SuccessResponse from "../utils/SuccessResponse.js";

/**
 * Create a new custom travel itinerary query (Lead/Enquiry)
 */
const createItinerary = asyncHandler(async (req, res) => {
  const itineraryData = req.body;
  const newItinerary = new Itinerary(itineraryData);
  const savedItinerary = await newItinerary.save();

  return res
    .status(201)
    .json(
      new SuccessResponse(
        201,
        "Itinerary created successfully",
        savedItinerary,
      ),
    );
});

/**
 * Get a single custom itinerary details by ID
 */
const getItineraryById = asyncHandler(async (req, res, next) => {
  const { id } = req.params || req.query; // Compatible with Express & Next.js dynamic routing
  const itinerary = await Itinerary.findById(id);
  if (!itinerary) {
    return next(new ErrorResponse(404, "Itinerary query not found"));
  }
  return res
    .status(200)
    .json(
      new SuccessResponse(200, "Itinerary fetched successfully", itinerary),
    );
});

/**
 * Get all itineraries with optional search filter parameters (email, mobile, status)
 */
const getAllItineraries = asyncHandler(async (req, res) => {
  const filter = {};
  const { email, mobile, status } = req.query || {};

  if (email) filter["customer.email"] = email;
  if (mobile) filter["customer.mobile"] = mobile;
  if (status) filter.status = status;

  const itineraries = await Itinerary.find(filter).sort({ createdAt: -1 });
  return res
    .status(200)
    .json(
      new SuccessResponse(200, "Itineraries fetched successfully", itineraries),
    );
});

/**
 * Update the status of an itinerary inquiry (e.g. quoted, confirmed, cancelled)
 */
const updateItineraryStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params || req.query;
  const { status } = req.body;

  if (
    !["draft", "pending_quote", "quoted", "confirmed", "cancelled"].includes(
      status,
    )
  ) {
    return next(new ErrorResponse(400, "Invalid status value"));
  }

  const updated = await Itinerary.findByIdAndUpdate(
    id,
    { status },
    { new: true, runValidators: true },
  );

  if (!updated) {
    return next(new ErrorResponse(404, "Itinerary query not found"));
  }

  return res
    .status(200)
    .json(
      new SuccessResponse(
        200,
        "Itinerary status updated successfully",
        updated,
      ),
    );
});

export {
  createItinerary,
  getItineraryById,
  getAllItineraries,
  updateItineraryStatus,
};
