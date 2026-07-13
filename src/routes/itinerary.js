import { Router } from "express";
import {
  createItinerary,
  getItineraryById,
  getAllItineraries,
  updateItineraryStatus,
} from "../controllers/itinerary.js";

const route = Router();

route.get("/itineraries", getAllItineraries);
route.post("/itineraries", createItinerary);
route.get("/itineraries/:id", getItineraryById);
route.put("/itineraries/:id/status", updateItineraryStatus);

export default route;
