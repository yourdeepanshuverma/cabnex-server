import { Router } from "express";
import {
  createHotelBookingQuery,
  getAllHotelBookingQueries,
  getHotelBookingQueryById,
  updateHotelBookingQueryStatus,
  deleteHotelBookingQuery,
} from "../controllers/hotelBookingQuery.js";

const route = Router();

// Full path / explicit routes
route.post("/hotel-booking-queries", createHotelBookingQuery);
route.get("/hotel-booking-queries", getAllHotelBookingQueries);
route.get("/hotel-booking-queries/:id", getHotelBookingQueryById);
route.put("/hotel-booking-queries/:id/status", updateHotelBookingQueryStatus);
route.patch("/hotel-booking-queries/:id/status", updateHotelBookingQueryStatus);
route.delete("/hotel-booking-queries/:id", deleteHotelBookingQuery);

// Aliases / Short routes under /api/v1/hotel-booking
route.post("/queries", createHotelBookingQuery);
route.get("/queries", getAllHotelBookingQueries);
route.get("/queries/:id", getHotelBookingQueryById);
route.put("/queries/:id/status", updateHotelBookingQueryStatus);
route.patch("/queries/:id/status", updateHotelBookingQueryStatus);
route.delete("/queries/:id", deleteHotelBookingQuery);

route.post("/", createHotelBookingQuery);
route.get("/", getAllHotelBookingQueries);
route.get("/:id", getHotelBookingQueryById);

export default route;
