import HotelBooking from "../models/HotelBookingQuery.js";
import asyncHandler from "../utils/asyncHandler.js";
import ErrorResponse from "../utils/ErrorResponse.js";
import SuccessResponse from "../utils/SuccessResponse.js";

/**
 * Create a new hotel booking query/enquiry
 */
const createHotelBookingQuery = asyncHandler(async (req, res, next) => {
  const { customer, hotel, selectedRoom, stayDetails } = req.body;

  // Basic validation for essential required fields
  if (!customer?.fullName || !customer?.email || !customer?.mobile) {
    return next(
      new ErrorResponse(400, "Customer full name, email, and mobile are required"),
    );
  }

  if (!hotel?.hotelId || !hotel?.name || !hotel?.destinationName) {
    return next(
      new ErrorResponse(400, "Hotel details (hotelId, name, destinationName) are required"),
    );
  }

  if (!selectedRoom?.rateId || !selectedRoom?.roomTypeId || !selectedRoom?.roomTypeName) {
    return next(
      new ErrorResponse(
        400,
        "Selected room details (rateId, roomTypeId, roomTypeName) are required",
      ),
    );
  }

  if (!stayDetails?.checkInDate || !stayDetails?.checkOutDate) {
    return next(
      new ErrorResponse(400, "Check-in and Check-out dates are required"),
    );
  }

  const newHotelBookingQuery = new HotelBooking(req.body);
  const savedQuery = await newHotelBookingQuery.save();

  return res
    .status(201)
    .json(
      new SuccessResponse(
        201,
        "Hotel booking query created successfully",
        savedQuery,
      ),
    );
});

/**
 * Get all hotel booking queries with optional search & filters (email, mobile, status, search)
 */
const getAllHotelBookingQueries = asyncHandler(async (req, res) => {
  const filter = {};
  const { email, mobile, status, search } = req.query || {};

  if (email) filter["customer.email"] = email.toLowerCase().trim();
  if (mobile) filter["customer.mobile"] = mobile.trim();
  if (status) filter.status = status;

  if (search) {
    filter.$or = [
      { "customer.fullName": { $regex: search, $options: "i" } },
      { "customer.email": { $regex: search, $options: "i" } },
      { "customer.mobile": { $regex: search, $options: "i" } },
      { "hotel.name": { $regex: search, $options: "i" } },
      { "hotel.destinationName": { $regex: search, $options: "i" } },
    ];
  }

  const queries = await HotelBooking.find(filter).sort({ createdAt: -1 });

  return res
    .status(200)
    .json(
      new SuccessResponse(
        200,
        "Hotel booking queries fetched successfully",
        queries,
      ),
    );
});

/**
 * Get a single hotel booking query by ID
 */
const getHotelBookingQueryById = asyncHandler(async (req, res, next) => {
  const { id } = req.params || req.query;

  const query = await HotelBooking.findById(id);

  if (!query) {
    return next(new ErrorResponse(404, "Hotel booking query not found"));
  }

  return res
    .status(200)
    .json(
      new SuccessResponse(
        200,
        "Hotel booking query fetched successfully",
        query,
      ),
    );
});

/**
 * Update status of a hotel booking query ("Pending", "Contacted", "Confirmed", "Cancelled")
 */
const updateHotelBookingQueryStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params || req.query;
  const { status } = req.body;

  const validStatuses = ["Pending", "Contacted", "Confirmed", "Cancelled"];

  if (!status || !validStatuses.includes(status)) {
    return next(
      new ErrorResponse(
        400,
        `Invalid status. Allowed values are: ${validStatuses.join(", ")}`,
      ),
    );
  }

  const updatedQuery = await HotelBooking.findByIdAndUpdate(
    id,
    { status },
    { new: true, runValidators: true },
  );

  if (!updatedQuery) {
    return next(new ErrorResponse(404, "Hotel booking query not found"));
  }

  return res
    .status(200)
    .json(
      new SuccessResponse(
        200,
        "Hotel booking query status updated successfully",
        updatedQuery,
      ),
    );
});

/**
 * Delete a hotel booking query by ID
 */
const deleteHotelBookingQuery = asyncHandler(async (req, res, next) => {
  const { id } = req.params || req.query;

  const deletedQuery = await HotelBooking.findByIdAndDelete(id);

  if (!deletedQuery) {
    return next(new ErrorResponse(404, "Hotel booking query not found"));
  }

  return res
    .status(200)
    .json(
      new SuccessResponse(
        200,
        "Hotel booking query deleted successfully",
        deletedQuery,
      ),
    );
});

export {
  createHotelBookingQuery,
  getAllHotelBookingQueries,
  getHotelBookingQueryById,
  updateHotelBookingQueryStatus,
  deleteHotelBookingQuery,
};
