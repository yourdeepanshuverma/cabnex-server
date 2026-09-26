import Route from "../models/Route.js";
import RateMaster from "../models/RateMaster.js";
import ChargeMaster from "../models/ChargeMaster.js";
import SurchargeMaster from "../models/SurchargeMaster.js";
import AgentGrade from "../models/AgentGrade.js";
import City from "../models/City.js";
import Transfer from "../models/Transfer.js";
import Garage from "../models/Garage.js";
import StatePermitMaster from "../models/StatePermitMaster.js";
import StateMarkup from "../models/StateMarkup.js";
import WebsiteSetting from "../models/WebsiteSetting.js";
import asyncHandler from "../utils/asyncHandler.js";
import ErrorResponse from "../utils/ErrorResponse.js";
import SuccessResponse from "../utils/SuccessResponse.js";

// ═══════════════════════════════════════════════════
// ROUTES (KM Master) CRUD
// ═══════════════════════════════════════════════════

const getAllRoutes = asyncHandler(async (req, res, next) => {
  const routes = await Route.find()
    .populate("fromCity", "city state")
    .populate("toCity", "city state")
    .sort({ createdAt: -1 });

  res.status(200).json(
    new SuccessResponse(200, "Routes fetched successfully", { routes }),
  );
});

const createRoute = asyncHandler(async (req, res, next) => {
  const { fromCity, toCity, distanceKm } = req.body;

  if (!fromCity || !toCity || distanceKm === undefined) {
    return next(
      new ErrorResponse(400, "fromCity, toCity, and distanceKm are required."),
    );
  }

  if (fromCity === toCity) {
    return next(
      new ErrorResponse(400, "From city and To city cannot be the same."),
    );
  }

  // Check if route already exists
  const existingRoute = await Route.findOne({ fromCity, toCity });
  if (existingRoute) {
    return next(
      new ErrorResponse(400, "This route already exists. Update it instead."),
    );
  }

  const route = await Route.create({ fromCity, toCity, distanceKm });

  res
    .status(201)
    .json(new SuccessResponse(201, "Route created successfully", { route }));
});

const updateRoute = asyncHandler(async (req, res, next) => {
  const route = await Route.findById(req.params.id);
  if (!route) {
    return next(new ErrorResponse(404, "Route not found"));
  }

  const { distanceKm, isActive } = req.body;
  if (distanceKm !== undefined) route.distanceKm = distanceKm;
  if (isActive !== undefined) route.isActive = isActive;

  await route.save();

  res
    .status(200)
    .json(new SuccessResponse(200, "Route updated successfully", { route }));
});

const deleteRoute = asyncHandler(async (req, res, next) => {
  const route = await Route.findByIdAndDelete(req.params.id);
  if (!route) {
    return next(new ErrorResponse(404, "Route not found"));
  }

  res
    .status(200)
    .json(new SuccessResponse(200, "Route deleted successfully"));
});

// Bulk create routes (for seeding)
const bulkCreateRoutes = asyncHandler(async (req, res, next) => {
  const { routes } = req.body;

  if (!routes || !Array.isArray(routes) || routes.length === 0) {
    return next(new ErrorResponse(400, "Routes array is required."));
  }

  const results = await Route.insertMany(routes, { ordered: false }).catch(
    (err) => {
      // Handle duplicate key errors gracefully
      if (err.code === 11000) {
        return err.insertedDocs || [];
      }
      throw err;
    },
  );

  res
    .status(201)
    .json(
      new SuccessResponse(201, `${results.length} routes created successfully`),
    );
});

// ═══════════════════════════════════════════════════
// RATE MASTER CRUD
// ═══════════════════════════════════════════════════

const getAllRates = asyncHandler(async (req, res, next) => {
  const rates = await RateMaster.find()
    .populate("vehicleCategory", "category")
    .populate("city", "city state")
    .sort({ city: 1, rateModel: 1 });

  res.status(200).json(
    new SuccessResponse(200, "Rates fetched successfully", { rates }),
  );
});

const createRate = asyncHandler(async (req, res, next) => {
  const { vehicleCategory, rateModel, city, baseRatePerDay, includedKmPerDay, extraKmRate, driverBataPerDay, taxSlab } = req.body;

  if (!vehicleCategory || !rateModel || !city) {
    return next(
      new ErrorResponse(
        400,
        "vehicleCategory, rateModel, and city are required.",
      ),
    );
  }

  const existing = await RateMaster.findOne({
    vehicleCategory,
    rateModel,
    city,
  });
  if (existing) {
    return next(
      new ErrorResponse(
        400,
        "Rate for this vehicle/model/city already exists.",
      ),
    );
  }

  const rate = await RateMaster.create({
    vehicleCategory,
    rateModel,
    city,
    baseRatePerDay: baseRatePerDay || 0,
    includedKmPerDay: includedKmPerDay || 0,
    extraKmRate: extraKmRate || 0,
    driverBataPerDay: driverBataPerDay || 0,
    taxSlab: taxSlab ?? 5,
  });

  res
    .status(201)
    .json(new SuccessResponse(201, "Rate created successfully", { rate }));
});

const updateRate = asyncHandler(async (req, res, next) => {
  const rate = await RateMaster.findById(req.params.id);
  if (!rate) {
    return next(new ErrorResponse(404, "Rate not found"));
  }

  const allowedFields = [
    "baseRatePerDay",
    "includedKmPerDay",
    "extraKmRate",
    "driverBataPerDay",
    "taxSlab",
    "isActive",
  ];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      rate[field] = req.body[field];
    }
  });

  await rate.save();

  res
    .status(200)
    .json(new SuccessResponse(200, "Rate updated successfully", { rate }));
});

const deleteRate = asyncHandler(async (req, res, next) => {
  const rate = await RateMaster.findByIdAndDelete(req.params.id);
  if (!rate) {
    return next(new ErrorResponse(404, "Rate not found"));
  }

  res
    .status(200)
    .json(new SuccessResponse(200, "Rate deleted successfully"));
});

// ═══════════════════════════════════════════════════
// CHARGE MASTER CRUD
// ═══════════════════════════════════════════════════

const getAllCharges = asyncHandler(async (req, res, next) => {
  const charges = await ChargeMaster.find().sort({ name: 1 });

  res.status(200).json(
    new SuccessResponse(200, "Charges fetched successfully", { charges }),
  );
});

const createCharge = asyncHandler(async (req, res, next) => {
  const { name, type, defaultAmount } = req.body;

  if (!name) {
    return next(new ErrorResponse(400, "Charge name is required."));
  }

  const charge = await ChargeMaster.create({
    name,
    type: type || "manual",
    defaultAmount: defaultAmount || 0,
  });

  res
    .status(201)
    .json(
      new SuccessResponse(201, "Charge created successfully", { charge }),
    );
});

const updateCharge = asyncHandler(async (req, res, next) => {
  const charge = await ChargeMaster.findById(req.params.id);
  if (!charge) {
    return next(new ErrorResponse(404, "Charge not found"));
  }

  if (req.body.defaultAmount !== undefined)
    charge.defaultAmount = req.body.defaultAmount;
  if (req.body.isActive !== undefined) charge.isActive = req.body.isActive;

  await charge.save();

  res
    .status(200)
    .json(
      new SuccessResponse(200, "Charge updated successfully", { charge }),
    );
});

const deleteCharge = asyncHandler(async (req, res, next) => {
  const charge = await ChargeMaster.findByIdAndDelete(req.params.id);
  if (!charge) {
    return next(new ErrorResponse(404, "Charge not found"));
  }

  res
    .status(200)
    .json(new SuccessResponse(200, "Charge deleted successfully"));
});

// ═══════════════════════════════════════════════════
// SURCHARGE MASTER CRUD
// ═══════════════════════════════════════════════════

const getAllSurcharges = asyncHandler(async (req, res, next) => {
  const surcharges = await SurchargeMaster.find()
    .populate("city", "city state")
    .sort({ startDate: 1 });

  res.status(200).json(
    new SuccessResponse(200, "Surcharges fetched successfully", { surcharges }),
  );
});

const createSurcharge = asyncHandler(async (req, res, next) => {
  const { name, city, startDate, endDate, surchargePercent, remarks } = req.body;

  if (!name || !startDate || !endDate) {
    return next(
      new ErrorResponse(400, "name, startDate, and endDate are required."),
    );
  }

  const surcharge = await SurchargeMaster.create({
    name,
    city: city || null,
    startDate,
    endDate,
    surchargePercent: surchargePercent || 0,
    remarks: remarks || "",
  });

  const populated = await SurchargeMaster.findById(surcharge._id).populate(
    "city",
    "city state",
  );

  res
    .status(201)
    .json(
      new SuccessResponse(201, "Surcharge created successfully", {
        surcharge: populated || surcharge,
      }),
    );
});

const updateSurcharge = asyncHandler(async (req, res, next) => {
  const surcharge = await SurchargeMaster.findById(req.params.id);
  if (!surcharge) {
    return next(new ErrorResponse(404, "Surcharge not found"));
  }

  const allowedFields = [
    "name",
    "city",
    "startDate",
    "endDate",
    "surchargePercent",
    "isActive",
    "remarks",
  ];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      surcharge[field] = req.body[field] || null;
    }
  });

  await surcharge.save();
  const populated = await SurchargeMaster.findById(surcharge._id).populate(
    "city",
    "city state",
  );

  res
    .status(200)
    .json(
      new SuccessResponse(200, "Surcharge updated successfully", {
        surcharge,
      }),
    );
});

const deleteSurcharge = asyncHandler(async (req, res, next) => {
  const surcharge = await SurchargeMaster.findByIdAndDelete(req.params.id);
  if (!surcharge) {
    return next(new ErrorResponse(404, "Surcharge not found"));
  }

  res
    .status(200)
    .json(new SuccessResponse(200, "Surcharge deleted successfully"));
});

// ═══════════════════════════════════════════════════
// AGENT GRADE CRUD
// ═══════════════════════════════════════════════════

const getAllAgentGrades = asyncHandler(async (req, res, next) => {
  const grades = await AgentGrade.find().sort({ grade: 1 });

  res.status(200).json(
    new SuccessResponse(200, "Agent grades fetched successfully", { grades }),
  );
});

const createAgentGrade = asyncHandler(async (req, res, next) => {
  const { grade, cabMarkupPercent, cashbackPercent } = req.body;

  if (!grade) {
    return next(new ErrorResponse(400, "Grade is required."));
  }

  const existing = await AgentGrade.findOne({
    grade: grade.toUpperCase().trim(),
  });
  if (existing) {
    return next(new ErrorResponse(400, "This grade already exists."));
  }

  const agentGrade = await AgentGrade.create({
    grade,
    cabMarkupPercent: cabMarkupPercent || 0,
    cashbackPercent: cashbackPercent || 0,
  });

  res
    .status(201)
    .json(
      new SuccessResponse(201, "Agent grade created successfully", {
        agentGrade,
      }),
    );
});

const updateAgentGrade = asyncHandler(async (req, res, next) => {
  const agentGrade = await AgentGrade.findById(req.params.id);
  if (!agentGrade) {
    return next(new ErrorResponse(404, "Agent grade not found"));
  }

  if (req.body.cabMarkupPercent !== undefined)
    agentGrade.cabMarkupPercent = req.body.cabMarkupPercent;
  if (req.body.cashbackPercent !== undefined)
    agentGrade.cashbackPercent = req.body.cashbackPercent;
  if (req.body.isActive !== undefined)
    agentGrade.isActive = req.body.isActive;

  await agentGrade.save();

  res
    .status(200)
    .json(
      new SuccessResponse(200, "Agent grade updated successfully", {
        agentGrade,
      }),
    );
});

const deleteAgentGrade = asyncHandler(async (req, res, next) => {
  const agentGrade = await AgentGrade.findByIdAndDelete(req.params.id);
  if (!agentGrade) {
    return next(new ErrorResponse(404, "Agent grade not found"));
  }

  res
    .status(200)
    .json(new SuccessResponse(200, "Agent grade deleted successfully"));
});

// ═══════════════════════════════════════════════════
// PUBLIC CITIES API (for frontend autocomplete)
// ═══════════════════════════════════════════════════

const getPublicCities = asyncHandler(async (req, res, next) => {
  const cities = await City.find({ isActive: true })
    .select("city state localKmPerDay")
    .sort({ city: 1 });

  res.status(200).json(
    new SuccessResponse(200, "Cities fetched successfully", { cities }),
  );
});

const getPublicTransfers = asyncHandler(async (req, res, next) => {
  const { city } = req.query;
  const filter = {};
  if (city) {
    filter.city = new RegExp(`^${city}$`, "i");
  }
  const transfers = await Transfer.find(filter)
    .populate("category.type", "name")
    .sort({ name: 1 });

  res.status(200).json(
    new SuccessResponse(200, "Transfers fetched successfully", { transfers }),
  );
});

// ═══════════════════════════════════════════════════
// GARAGE MASTER CRUD
// ═══════════════════════════════════════════════════

const getAllGarages = asyncHandler(async (req, res, next) => {
  const garages = await Garage.find()
    .populate("garageCity", "city state")
    .populate("assignedCities", "city state")
    .sort({ createdAt: -1 });

  res.status(200).json(
    new SuccessResponse(200, "Garages fetched successfully", { garages }),
  );
});

const createGarage = asyncHandler(async (req, res, next) => {
  const { name, garageCity, assignedCities = [], isActive } = req.body;

  if (!name || !garageCity) {
    return next(new ErrorResponse(400, "Garage name and base city are required."));
  }

  // Ensure no assigned city is already assigned to another garage
  if (assignedCities && assignedCities.length > 0) {
    const conflict = await Garage.findOne({
      assignedCities: { $in: assignedCities },
    }).populate("assignedCities", "city");

    if (conflict) {
      return next(
        new ErrorResponse(
          400,
          `One or more cities are already assigned to garage "${conflict.name}". Each city can only belong to one garage.`
        ),
      );
    }
  }

  const garage = await Garage.create({
    name: name.trim(),
    garageCity,
    assignedCities,
    isActive: isActive !== undefined ? isActive : true,
  });

  const populated = await Garage.findById(garage._id)
    .populate("garageCity", "city state")
    .populate("assignedCities", "city state");

  res.status(201).json(
    new SuccessResponse(201, "Garage created successfully", { garage: populated }),
  );
});

const updateGarage = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { name, garageCity, assignedCities, isActive } = req.body;

  const garage = await Garage.findById(id);
  if (!garage) {
    return next(new ErrorResponse(404, "Garage not found."));
  }

  // Check conflicts with other garages if assignedCities is being updated
  if (assignedCities && assignedCities.length > 0) {
    const conflict = await Garage.findOne({
      _id: { $ne: id },
      assignedCities: { $in: assignedCities },
    });

    if (conflict) {
      return next(
        new ErrorResponse(
          400,
          `One or more cities are already assigned to garage "${conflict.name}". Each city can only belong to one garage.`
        ),
      );
    }
  }

  if (name !== undefined) garage.name = name.trim();
  if (garageCity !== undefined) garage.garageCity = garageCity;
  if (assignedCities !== undefined) garage.assignedCities = assignedCities;
  if (isActive !== undefined) garage.isActive = isActive;

  await garage.save();

  const populated = await Garage.findById(garage._id)
    .populate("garageCity", "city state")
    .populate("assignedCities", "city state");

  res.status(200).json(
    new SuccessResponse(200, "Garage updated successfully", { garage: populated }),
  );
});

const deleteGarage = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const garage = await Garage.findByIdAndDelete(id);
  if (!garage) {
    return next(new ErrorResponse(404, "Garage not found."));
  }
  res.status(200).json(
    new SuccessResponse(200, "Garage deleted successfully"),
  );
});

// ═══════════════════════════════════════════════════
// STATE PERMIT MASTER CRUD
// ═══════════════════════════════════════════════════

const getAllStatePermits = asyncHandler(async (req, res, next) => {
  const permits = await StatePermitMaster.find()
    .populate("vehicleCategory", "category seats")
    .sort({ state: 1, createdAt: -1 });

  res.status(200).json(
    new SuccessResponse(200, "State permits fetched successfully", { permits }),
  );
});

const createStatePermit = asyncHandler(async (req, res, next) => {
  const { state, vehicleCategory, permitCharge, remarks, isActive } = req.body;

  if (!state || !vehicleCategory || permitCharge === undefined) {
    return next(
      new ErrorResponse(
        400,
        "State, vehicle category, and permit charge are required.",
      ),
    );
  }

  const normalizedState = state.toLowerCase().trim().replace(/\s+/g, "-");

  const existing = await StatePermitMaster.findOne({
    state: normalizedState,
    vehicleCategory,
  });
  if (existing) {
    return next(
      new ErrorResponse(
        400,
        `Permit charge already exists for state "${state}" and this vehicle category. Please update the existing entry.`,
      ),
    );
  }

  const permit = await StatePermitMaster.create({
    state: normalizedState,
    vehicleCategory,
    permitCharge: Number(permitCharge) || 0,
    remarks: remarks || "",
    isActive: isActive !== undefined ? isActive : true,
  });

  const populated = await StatePermitMaster.findById(permit._id).populate(
    "vehicleCategory",
    "category seats",
  );

  res.status(201).json(
    new SuccessResponse(201, "State permit created successfully", {
      permit: populated,
    }),
  );
});

const updateStatePermit = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const permit = await StatePermitMaster.findById(id);

  if (!permit) {
    return next(new ErrorResponse(404, "State permit not found."));
  }

  const { state, vehicleCategory, permitCharge, remarks, isActive } = req.body;

  if (state && vehicleCategory) {
    const normalizedState = state.toLowerCase().trim().replace(/\s+/g, "-");
    const duplicate = await StatePermitMaster.findOne({
      _id: { $ne: id },
      state: normalizedState,
      vehicleCategory,
    });
    if (duplicate) {
      return next(
        new ErrorResponse(
          400,
          `Permit charge already exists for state "${state}" and this vehicle category.`,
        ),
      );
    }
    permit.state = normalizedState;
    permit.vehicleCategory = vehicleCategory;
  } else if (state) {
    permit.state = state.toLowerCase().trim().replace(/\s+/g, "-");
  } else if (vehicleCategory) {
    permit.vehicleCategory = vehicleCategory;
  }

  if (permitCharge !== undefined) permit.permitCharge = Number(permitCharge);
  if (remarks !== undefined) permit.remarks = remarks;
  if (isActive !== undefined) permit.isActive = isActive;

  await permit.save();

  const populated = await StatePermitMaster.findById(permit._id).populate(
    "vehicleCategory",
    "category seats",
  );

  res.status(200).json(
    new SuccessResponse(200, "State permit updated successfully", {
      permit: populated,
    }),
  );
});

const deleteStatePermit = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const permit = await StatePermitMaster.findByIdAndDelete(id);

  if (!permit) {
    return next(new ErrorResponse(404, "State permit not found."));
  }

  res.status(200).json(
    new SuccessResponse(200, "State permit deleted successfully"),
  );
});

// ═══════════════════════════════════════════════════
// STATE MARKUP MASTER CRUD & DEFAULT COMMISSION
// ═══════════════════════════════════════════════════

const getAllStateMarkups = asyncHandler(async (req, res, next) => {
  const markups = await StateMarkup.find()
    .populate("city", "city state")
    .sort({ state: 1, createdAt: -1 });

  res.status(200).json(
    new SuccessResponse(200, "State markups fetched successfully", { markups }),
  );
});

const createStateMarkup = asyncHandler(async (req, res, next) => {
  const { state, city, markupPercent, markupType, flatAmount, remarks, isActive } =
    req.body;

  if (!state || markupPercent === undefined) {
    return next(
      new ErrorResponse(400, "State and markup percentage are required."),
    );
  }

  const normalizedState = state.toLowerCase().trim().replace(/\s+/g, "-");
  const cityVal = city && city !== "all" && city !== "" ? city : null;

  const existing = await StateMarkup.findOne({
    state: normalizedState,
    city: cityVal,
  });

  if (existing) {
    return next(
      new ErrorResponse(
        400,
        `A markup rule already exists for state "${state}" ${cityVal ? "and selected city" : "(state-wide)"}. Please update the existing rule.`,
      ),
    );
  }

  const markup = await StateMarkup.create({
    state: normalizedState,
    city: cityVal,
    markupPercent:
      Number(markupPercent) > 1
        ? Number(markupPercent) / 100
        : Number(markupPercent),
    markupType: markupType || "percentage",
    flatAmount: flatAmount ? Number(flatAmount) : 0,
    remarks: remarks || "",
    isActive: isActive !== undefined ? isActive : true,
  });

  const populated = await StateMarkup.findById(markup._id).populate(
    "city",
    "city state",
  );

  res.status(201).json(
    new SuccessResponse(201, "State markup created successfully", {
      markup: populated,
    }),
  );
});

const updateStateMarkup = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const markup = await StateMarkup.findById(id);

  if (!markup) {
    return next(new ErrorResponse(404, "State markup rule not found."));
  }

  const { state, city, markupPercent, markupType, flatAmount, remarks, isActive } =
    req.body;

  const nextState = state
    ? state.toLowerCase().trim().replace(/\s+/g, "-")
    : markup.state;
  const nextCity =
    city !== undefined
      ? city && city !== "all" && city !== ""
        ? city
        : null
      : markup.city;

  const duplicate = await StateMarkup.findOne({
    _id: { $ne: id },
    state: nextState,
    city: nextCity,
  });

  if (duplicate) {
    return next(
      new ErrorResponse(
        400,
        `A markup rule already exists for state "${nextState}" ${nextCity ? "and this city" : "(state-wide)"}.`,
      ),
    );
  }

  if (state) markup.state = nextState;
  if (city !== undefined) markup.city = nextCity;
  if (markupPercent !== undefined) {
    markup.markupPercent =
      Number(markupPercent) > 1
        ? Number(markupPercent) / 100
        : Number(markupPercent);
  }
  if (markupType !== undefined) markup.markupType = markupType;
  if (flatAmount !== undefined) markup.flatAmount = Number(flatAmount);
  if (remarks !== undefined) markup.remarks = remarks;
  if (isActive !== undefined) markup.isActive = isActive;

  await markup.save();

  const populated = await StateMarkup.findById(markup._id).populate(
    "city",
    "city state",
  );

  res.status(200).json(
    new SuccessResponse(200, "State markup updated successfully", {
      markup: populated,
    }),
  );
});

const deleteStateMarkup = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const markup = await StateMarkup.findByIdAndDelete(id);

  if (!markup) {
    return next(new ErrorResponse(404, "State markup rule not found."));
  }

  res.status(200).json(
    new SuccessResponse(200, "State markup deleted successfully"),
  );
});

const getDefaultCommission = asyncHandler(async (req, res, next) => {
  const setting = await WebsiteSetting.findOne().select("defaultCommissionPercent");
  const defaultCommissionPercent = setting?.defaultCommissionPercent ?? 0.05;

  res.status(200).json(
    new SuccessResponse(200, "Default commission fetched successfully", {
      defaultCommissionPercent,
    }),
  );
});

const updateDefaultCommission = asyncHandler(async (req, res, next) => {
  const { defaultCommissionPercent } = req.body;

  if (defaultCommissionPercent === undefined || defaultCommissionPercent === null) {
    return next(new ErrorResponse(400, "Default commission percent is required."));
  }

  const rate =
    Number(defaultCommissionPercent) > 1
      ? Number(defaultCommissionPercent) / 100
      : Number(defaultCommissionPercent);

  if (isNaN(rate) || rate < 0 || rate > 1) {
    return next(
      new ErrorResponse(400, "Commission percent must be between 0% and 100%."),
    );
  }

  let setting = await WebsiteSetting.findOne();
  if (!setting) {
    setting = await WebsiteSetting.create({ defaultCommissionPercent: rate });
  } else {
    setting.defaultCommissionPercent = rate;
    await setting.save();
  }

  res.status(200).json(
    new SuccessResponse(200, "Default commission updated successfully", {
      defaultCommissionPercent: setting.defaultCommissionPercent,
    }),
  );
});

export async function getApplicableStateMarkup({ state, cityId }) {
  if (!state) return null;
  const normalizedState = state.toLowerCase().trim().replace(/\s+/g, "-");

  // 1. Check for active city-specific rule first
  if (cityId) {
    const cityRule = await StateMarkup.findOne({
      state: { $regex: new RegExp(`^${normalizedState}$`, "i") },
      city: cityId,
      isActive: true,
    });
    if (cityRule) return cityRule;
  }

  // 2. Check for active state-wide rule (where city is null)
  const stateRule = await StateMarkup.findOne({
    state: { $regex: new RegExp(`^${normalizedState}$`, "i") },
    city: null,
    isActive: true,
  });

  return stateRule || null;
}

export async function getSystemDefaultCommission() {
  const setting = await WebsiteSetting.findOne().select("defaultCommissionPercent");
  return setting?.defaultCommissionPercent ?? 0.05;
}

export {
  // Routes
  getAllRoutes,
  createRoute,
  updateRoute,
  deleteRoute,
  bulkCreateRoutes,
  // Rate Master
  getAllRates,
  createRate,
  updateRate,
  deleteRate,
  // Charge Master
  getAllCharges,
  createCharge,
  updateCharge,
  deleteCharge,
  // Surcharge Master
  getAllSurcharges,
  createSurcharge,
  updateSurcharge,
  deleteSurcharge,
  // Agent Grade
  getAllAgentGrades,
  createAgentGrade,
  updateAgentGrade,
  deleteAgentGrade,
  // Garage Master
  getAllGarages,
  createGarage,
  updateGarage,
  deleteGarage,
  // State Permit Master
  getAllStatePermits,
  createStatePermit,
  updateStatePermit,
  deleteStatePermit,
  // State Markup Master
  getAllStateMarkups,
  createStateMarkup,
  updateStateMarkup,
  deleteStateMarkup,
  getDefaultCommission,
  updateDefaultCommission,
  // Public
  getPublicCities,
  getPublicTransfers,
};
