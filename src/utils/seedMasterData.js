/**
 * Seed script to populate master data from the Excel workbook into MongoDB.
 *
 * Usage: node src/utils/seedMasterData.js
 *
 * Seeds:
 * - City Master (with localKmPerDay from Local KM Master)
 * - KM Master → Route collection
 * - Rate Master → RateMaster collection
 * - Charge Master → ChargeMaster collection
 * - Surcharge Master → SurchargeMaster collection
 * - Agent Grades → AgentGrade collection
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../db/index.js";
import City from "../models/City.js";
import Route from "../models/Route.js";
import RateMaster from "../models/RateMaster.js";
import ChargeMaster from "../models/ChargeMaster.js";
import SurchargeMaster from "../models/SurchargeMaster.js";
import AgentGrade from "../models/AgentGrade.js";
import CarCategory from "../models/CarCategory.js";
import Garage from "../models/Garage.js";
import StatePermitMaster from "../models/StatePermitMaster.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const node_env = process.env.NODE_ENV || "development";
const envFileName = node_env === "production" ? ".env.prod" : ".env.local";
dotenv.config({
  path: path.resolve(__dirname, `../../${envFileName}`),
});

// ═══════════════════════════════════════════════════
// MASTER DATA FROM EXCEL
// ═══════════════════════════════════════════════════

const CITY_MASTER = [
  { city: "alleppey", state: "kerala", localKmPerDay: 30 },
  { city: "bangalore", state: "karnataka", localKmPerDay: 100 },
  { city: "chennai", state: "tamil-nadu", localKmPerDay: 80 },
  { city: "cochin", state: "kerala", localKmPerDay: 100 },
  { city: "coorg", state: "karnataka", localKmPerDay: 100 },
  { city: "hyderabad", state: "telangana", localKmPerDay: 100 },
  { city: "kanchipuram", state: "tamil-nadu", localKmPerDay: 40 },
  { city: "kanyakumari", state: "tamil-nadu", localKmPerDay: 30 },
  { city: "kodaikanal", state: "tamil-nadu", localKmPerDay: 100 },
  { city: "kovalam", state: "kerala", localKmPerDay: 100 },
  { city: "kumarakom", state: "kerala", localKmPerDay: 50 },
  { city: "kumbakonam", state: "tamil-nadu", localKmPerDay: 50 },
  { city: "madurai", state: "tamil-nadu", localKmPerDay: 100 },
  { city: "mahabalipuram", state: "tamil-nadu", localKmPerDay: 40 },
  { city: "munnar", state: "kerala", localKmPerDay: 100 },
  { city: "mysore", state: "karnataka", localKmPerDay: 100 },
  { city: "ooty", state: "tamil-nadu", localKmPerDay: 100 },
  { city: "pondicherry", state: "puducherry", localKmPerDay: 50 },
  { city: "rameswaram", state: "tamil-nadu", localKmPerDay: 100 },
  { city: "thanjavur", state: "tamil-nadu", localKmPerDay: 50 },
  { city: "thekkady", state: "kerala", localKmPerDay: 30 },
  { city: "tirupati", state: "andhra-pradesh", localKmPerDay: 100 },
  { city: "trichy", state: "tamil-nadu", localKmPerDay: 100 },
  { city: "trivandrum", state: "kerala", localKmPerDay: 60 },
  { city: "vagamon", state: "kerala", localKmPerDay: 60 },
  { city: "varkala", state: "kerala", localKmPerDay: 60 },
  { city: "wayanad", state: "kerala", localKmPerDay: 100 },
  { city: "yercaud", state: "tamil-nadu", localKmPerDay: 50 },
];

// KM Master — [fromCity, toCity, distanceKm]
const KM_MASTER = [
  ["alleppey", "cochin", 100],
  ["alleppey", "thekkady", 160],
  ["alleppey", "munnar", 175],
  ["alleppey", "kovalam", 160],
  ["alleppey", "kumarakom", 35],
  ["alleppey", "vagamon", 110],
  ["alleppey", "kanyakumari", 250],
  ["alleppey", "trivandrum", 151],
  ["alleppey", "varkala", 150],
  ["bangalore", "mysore", 150],
  ["bangalore", "ooty", 300],
  ["bangalore", "coorg", 270],
  ["bangalore", "chennai", 350],
  ["bangalore", "hyderabad", 570],
  ["bangalore", "wayanad", 275],
  ["bangalore", "yercaud", 200],
  ["bangalore", "mahabalipuram", 370],
  ["bangalore", "kanchipuram", 280],
  ["bangalore", "thanjavur", 430],
  ["bangalore", "trichy", 330],
  ["bangalore", "kumbakonam", 420],
  ["bangalore", "madurai", 436],
  ["chennai", "pondicherry", 155],
  ["chennai", "madurai", 460],
  ["chennai", "bangalore", 350],
  ["chennai", "mahabalipuram", 60],
  ["chennai", "kanchipuram", 75],
  ["chennai", "trichy", 330],
  ["chennai", "kumbakonam", 300],
  ["chennai", "yercaud", 360],
  ["chennai", "thanjavur", 345],
  ["chennai", "tirupati", 132],
  ["chennai", "trivandrum", 770],
  ["cochin", "munnar", 150],
  ["cochin", "trivandrum", 250],
  ["cochin", "madurai", 350],
  ["cochin", "alleppey", 100],
  ["cochin", "kumarakom", 100],
  ["cochin", "varkala", 200],
  ["cochin", "vagamon", 150],
  ["cochin", "kodaikanal", 400],
  ["coorg", "ooty", 190],
  ["coorg", "mysore", 120],
  ["coorg", "bangalore", 260],
  ["coorg", "wayanad", 120],
  ["hyderabad", "tirupati", 550],
  ["hyderabad", "bangalore", 570],
  ["kanchipuram", "mahabalipuram", 70],
  ["kanchipuram", "chennai", 75],
  ["kanchipuram", "tirupati", 115],
  ["kanchipuram", "bangalore", 280],
  ["kanchipuram", "madurai", 470],
  ["kanchipuram", "pondicherry", 140],
  ["kanyakumari", "madurai", 260],
  ["kanyakumari", "kovalam", 90],
  ["kanyakumari", "rameswaram", 310],
  ["kanyakumari", "varkala", 145],
  ["kanyakumari", "trivandrum", 85],
  ["kodaikanal", "madurai", 90],
  ["kodaikanal", "munnar", 170],
  ["kodaikanal", "rameswaram", 260],
  ["kodaikanal", "trichy", 200],
  ["kodaikanal", "cochin", 300],
  ["kodaikanal", "trivandrum", 300],
  ["kodaikanal", "ooty", 250],
  ["kovalam", "kanyakumari", 90],
  ["kovalam", "trivandrum", 20],
  ["kovalam", "alleppey", 160],
  ["kovalam", "varkala", 50],
  ["kumarakom", "cochin", 50],
  ["kumarakom", "alleppey", 35],
  ["kumarakom", "munnar", 150],
  ["kumarakom", "vagamon", 90],
  ["kumarakom", "trivandrum", 170],
  ["kumarakom", "madurai", 300],
  ["kumbakonam", "thanjavur", 45],
  ["kumbakonam", "trichy", 95],
  ["kumbakonam", "chennai", 300],
  ["kumbakonam", "pondicherry", 135],
  ["kumbakonam", "madurai", 215],
  ["kumbakonam", "bangalore", 420],
  ["madurai", "rameswaram", 150],
  ["madurai", "trivandrum", 350],
  ["madurai", "kanyakumari", 245],
  ["madurai", "cochin", 270],
  ["madurai", "munnar", 155],
  ["madurai", "thekkady", 140],
  ["madurai", "chennai", 460],
  ["madurai", "kodaikanal", 90],
  ["madurai", "thanjavur", 190],
  ["madurai", "trichy", 135],
  ["madurai", "kumbakonam", 215],
  ["madurai", "varkala", 310],
  ["madurai", "kumarakom", 300],
  ["madurai", "vagamon", 180],
  ["madurai", "mahabalipuram", 520],
  ["madurai", "kanchipuram", 470],
  ["madurai", "yercaud", 330],
  ["madurai", "bangalore", 436],
  ["mahabalipuram", "chennai", 60],
  ["mahabalipuram", "pondicherry", 100],
  ["mahabalipuram", "kanchipuram", 70],
  ["mahabalipuram", "bangalore", 370],
  ["mahabalipuram", "madurai", 520],
  ["munnar", "thekkady", 100],
  ["munnar", "alleppey", 180],
  ["munnar", "madurai", 290],
  ["munnar", "cochin", 125],
  ["munnar", "kumarakom", 150],
  ["munnar", "vagamon", 110],
  ["munnar", "kodaikanal", 170],
  ["mysore", "coorg", 150],
  ["mysore", "ooty", 180],
  ["mysore", "wayanad", 150],
  ["mysore", "bangalore", 150],
  ["ooty", "wayanad", 150],
  ["ooty", "coorg", 160],
  ["ooty", "mysore", 125],
  ["ooty", "bangalore", 300],
  ["ooty", "yercaud", 220],
  ["ooty", "kodaikanal", 250],
  ["pondicherry", "chennai", 155],
  ["pondicherry", "mahabalipuram", 100],
  ["pondicherry", "kumbakonam", 135],
  ["pondicherry", "thanjavur", 170],
  ["rameswaram", "kanyakumari", 350],
  ["rameswaram", "madurai", 180],
  ["rameswaram", "kodaikanal", 260],
  ["thanjavur", "trichy", 60],
  ["thanjavur", "kumbakonam", 45],
  ["thanjavur", "madurai", 190],
  ["thanjavur", "chennai", 345],
  ["thanjavur", "bangalore", 430],
  ["thanjavur", "pondicherry", 170],
  ["thekkady", "alleppey", 180],
  ["thekkady", "madurai", 180],
  ["thekkady", "munnar", 100],
  ["thekkady", "vagamon", 65],
  ["thekkady", "cochin", 148],
  ["thekkady", "varkala", 192],
  ["tirupati", "hyderabad", 550],
  ["tirupati", "kanchipuram", 115],
  ["tirupati", "chennai", 132],
  ["trichy", "kodaikanal", 200],
  ["trichy", "thanjavur", 60],
  ["trichy", "kumbakonam", 95],
  ["trichy", "chennai", 330],
  ["trichy", "madurai", 135],
  ["trichy", "yercaud", 190],
  ["trichy", "bangalore", 330],
  ["trichy", "trivandrum", 445],
  ["trivandrum", "kovalam", 20],
  ["trivandrum", "cochin", 210],
  ["trivandrum", "madurai", 320],
  ["trivandrum", "varkala", 45],
  ["trivandrum", "kumarakom", 170],
  ["trivandrum", "kodaikanal", 300],
  ["trivandrum", "kanyakumari", 85],
  ["trivandrum", "trichy", 445],
  ["trivandrum", "chennai", 770],
  ["vagamon", "thekkady", 65],
  ["vagamon", "munnar", 110],
  ["vagamon", "alleppey", 110],
  ["vagamon", "kumarakom", 90],
  ["vagamon", "cochin", 105],
  ["vagamon", "madurai", 180],
  ["varkala", "trivandrum", 100],
  ["varkala", "kovalam", 100],
  ["varkala", "kanyakumari", 200],
  ["varkala", "cochin", 200],
  ["varkala", "madurai", 350],
  ["varkala", "alleppey", 150],
  ["wayanad", "bangalore", 300],
  ["wayanad", "ooty", 120],
  ["wayanad", "mysore", 140],
  ["yercaud", "bangalore", 200],
  ["yercaud", "chennai", 360],
  ["yercaud", "ooty", 220],
  ["yercaud", "trichy", 190],
  ["yercaud", "madurai", 330],
];

// Rate Master — [vehicleCategoryName, rateModel, baseRatePerDay, includedKmPerDay, extraKmRate, driverBataPerDay, state]
// Category names must match DB: sedan, ertiga, innova, crysta, tempo-traveler-12-seat, tempo-traveler-17-seat, tempo-traveler-26-seat
const RATE_MASTER = [
  // Kerala rates
  ["sedan", "daily-included-km", 1800, 100, 15, 0, "kerala"],
  ["ertiga", "daily-included-km", 2000, 100, 18, 0, "kerala"],
  ["innova", "daily-included-km", 3000, 100, 21, 600, "kerala"],
  ["crysta", "daily-included-km", 3600, 100, 23, 700, "kerala"],
  ["tempo-traveler-12-seat", "daily-included-km", 4500, 100, 28, 900, "kerala"],
  ["tempo-traveler-17-seat", "daily-included-km", 4500, 100, 28, 900, "kerala"],
  ["tempo-traveler-26-seat", "daily-included-km", 4500, 100, 28, 900, "kerala"],

  ["sedan", "daily-all-km", 1200, 0, 9, 500, "kerala"],
  ["ertiga", "daily-all-km", 1500, 0, 11, 550, "kerala"],
  ["innova", "daily-all-km", 1700, 0, 13, 600, "kerala"],
  ["crysta", "daily-all-km", 2100, 0, 15, 700, "kerala"],
  ["tempo-traveler-12-seat", "daily-all-km", 2200, 0, 18, 900, "kerala"],
  ["tempo-traveler-17-seat", "daily-all-km", 2200, 0, 18, 900, "kerala"],
  ["tempo-traveler-26-seat", "daily-all-km", 2200, 0, 18, 900, "kerala"],

  ["sedan", "package-fixed-km", 12000, 500, 17, 500, "kerala"],
  ["ertiga", "package-fixed-km", 13500, 500, 19, 500, "kerala"],
  ["innova", "package-fixed-km", 15000, 500, 21, 600, "kerala"],
  ["crysta", "package-fixed-km", 18000, 500, 23, 700, "kerala"],
  ["tempo-traveler-12-seat", "package-fixed-km", 22000, 500, 28, 900, "kerala"],
  ["tempo-traveler-17-seat", "package-fixed-km", 22000, 500, 28, 900, "kerala"],
  ["tempo-traveler-26-seat", "package-fixed-km", 22000, 500, 28, 900, "kerala"],

  ["sedan", "fixed-route", 0, 0, 0, 0, "kerala"],
  ["ertiga", "fixed-route", 0, 0, 0, 0, "kerala"],
  ["innova", "fixed-route", 0, 0, 0, 0, "kerala"],
  ["crysta", "fixed-route", 0, 0, 0, 0, "kerala"],
  ["tempo-traveler-12-seat", "fixed-route", 0, 0, 0, 0, "kerala"],
  ["tempo-traveler-17-seat", "fixed-route", 0, 0, 0, 0, "kerala"],
  ["tempo-traveler-26-seat", "fixed-route", 0, 0, 0, 0, "kerala"],

  // Tamil Nadu rates
  ["sedan", "daily-included-km", 1900, 0, 11, 0, "tamil-nadu"],
  ["ertiga", "daily-included-km", 2300, 0, 13, 0, "tamil-nadu"],
  ["innova", "daily-included-km", 3000, 100, 21, 600, "tamil-nadu"],
  ["crysta", "daily-included-km", 3600, 100, 23, 700, "tamil-nadu"],
  ["tempo-traveler-12-seat", "daily-included-km", 4500, 100, 28, 900, "tamil-nadu"],
  ["tempo-traveler-17-seat", "daily-included-km", 4500, 100, 28, 900, "tamil-nadu"],
  ["tempo-traveler-26-seat", "daily-included-km", 4500, 100, 28, 900, "tamil-nadu"],
];

const CHARGE_MASTER = [
  { name: "toll", type: "manual", defaultAmount: 800 },
  { name: "parking", type: "manual", defaultAmount: 400 },
  { name: "permit", type: "manual", defaultAmount: 0 },
  { name: "night-halt", type: "manual", defaultAmount: 0 },
  { name: "other-charges", type: "manual", defaultAmount: 0 },
];

const SURCHARGE_MASTER = [
  {
    name: "Diwali Peak",
    startDate: new Date("2026-11-04"),
    endDate: new Date("2026-11-12"),
    surchargePercent: 0.1,
    remarks: "Diwali peak season surcharge",
  },
  {
    name: "Christmas / New Year Peak",
    startDate: new Date("2026-12-20"),
    endDate: new Date("2027-01-10"),
    surchargePercent: 0.1,
    remarks: "Christmas/New Year peak season surcharge",
  },
];

const AGENT_GRADES = [
  { grade: "A", cabMarkupPercent: 0.05, cashbackPercent: 0.01 },
  { grade: "B", cabMarkupPercent: 0.08, cashbackPercent: 0.01 },
  { grade: "C", cabMarkupPercent: 0.10, cashbackPercent: 0.005 },
  { grade: "D", cabMarkupPercent: 0.12, cashbackPercent: 0 },
];

const GARAGES = [
  {
    name: "Kumarakom Garage",
    garageCity: "kumarakom",
    assignedCities: [
      "kumarakom",
      "cochin",
      "alleppey",
      "munnar",
      "thekkady",
      "vagamon",
      "kovalam",
      "trivandrum",
      "varkala",
      "wayanad",
    ],
  },
];

// State Permit Master — [state, vehicleCategoryName, permitCharge, remarks]
const STATE_PERMIT_MASTER = [
  // Tamil Nadu permits
  ["tamil-nadu", "sedan", 350, "Tamil Nadu state border permit"],
  ["tamil-nadu", "ertiga", 400, "Tamil Nadu state border permit"],
  ["tamil-nadu", "innova", 500, "Tamil Nadu state border permit"],
  ["tamil-nadu", "crysta", 500, "Tamil Nadu state border permit"],
  ["tamil-nadu", "tempo-traveler-12-seat", 1200, "Tamil Nadu state border permit"],
  ["tamil-nadu", "tempo-traveler-17-seat", 1500, "Tamil Nadu state border permit"],
  ["tamil-nadu", "tempo-traveler-26-seat", 1800, "Tamil Nadu state border permit"],

  // Kerala permits
  ["kerala", "sedan", 350, "Kerala state border permit"],
  ["kerala", "ertiga", 400, "Kerala state border permit"],
  ["kerala", "innova", 500, "Kerala state border permit"],
  ["kerala", "crysta", 500, "Kerala state border permit"],
  ["kerala", "tempo-traveler-12-seat", 1200, "Kerala state border permit"],
  ["kerala", "tempo-traveler-17-seat", 1500, "Kerala state border permit"],
  ["kerala", "tempo-traveler-26-seat", 1800, "Kerala state border permit"],

  // Karnataka permits
  ["karnataka", "sedan", 400, "Karnataka state border permit"],
  ["karnataka", "ertiga", 500, "Karnataka state border permit"],
  ["karnataka", "innova", 600, "Karnataka state border permit"],
  ["karnataka", "crysta", 600, "Karnataka state border permit"],
  ["karnataka", "tempo-traveler-12-seat", 1500, "Karnataka state border permit"],
  ["karnataka", "tempo-traveler-17-seat", 1800, "Karnataka state border permit"],
  ["karnataka", "tempo-traveler-26-seat", 2200, "Karnataka state border permit"],

  // Andhra Pradesh permits
  ["andhra-pradesh", "sedan", 350, "Andhra Pradesh state border permit"],
  ["andhra-pradesh", "ertiga", 400, "Andhra Pradesh state border permit"],
  ["andhra-pradesh", "innova", 500, "Andhra Pradesh state border permit"],
  ["andhra-pradesh", "crysta", 500, "Andhra Pradesh state border permit"],
  ["andhra-pradesh", "tempo-traveler-12-seat", 1200, "Andhra Pradesh state border permit"],
  ["andhra-pradesh", "tempo-traveler-17-seat", 1500, "Andhra Pradesh state border permit"],
  ["andhra-pradesh", "tempo-traveler-26-seat", 1800, "Andhra Pradesh state border permit"],
];

// ═══════════════════════════════════════════════════
// SEED FUNCTIONS
// ═══════════════════════════════════════════════════

async function seedCities() {
  console.log("\n📍 Seeding Cities...");
  let created = 0;
  let updated = 0;

  for (const cityData of CITY_MASTER) {
    const existing = await City.findOne({ city: cityData.city });
    if (existing) {
      existing.state = cityData.state;
      existing.localKmPerDay = cityData.localKmPerDay;
      await existing.save({ validateBeforeSave: false });
      updated++;
    } else {
      await City.create({
        city: cityData.city,
        state: cityData.state,
        localKmPerDay: cityData.localKmPerDay,
        isActive: true,
      });
      created++;
    }
  }

  console.log(`   ✅ Created: ${created}, Updated: ${updated}`);
}

async function seedRoutes() {
  console.log("\n🛣️  Seeding Routes (KM Master)...");

  // Build city name → ObjectId map
  const cities = await City.find().select("city");
  const cityMap = {};
  for (const c of cities) {
    cityMap[c.city] = c._id;
  }

  let created = 0;
  let skipped = 0;
  const errors = [];

  for (const [from, to, km] of KM_MASTER) {
    const fromId = cityMap[from];
    const toId = cityMap[to];

    if (!fromId || !toId) {
      errors.push(`City not found: ${!fromId ? from : to}`);
      skipped++;
      continue;
    }

    try {
      await Route.findOneAndUpdate(
        { fromCity: fromId, toCity: toId },
        { distanceKm: km, isActive: true },
        { upsert: true, new: true },
      );
      created++;
    } catch (err) {
      skipped++;
      errors.push(`Route ${from}→${to}: ${err.message}`);
    }
  }

  console.log(`   ✅ Upserted: ${created}, Skipped: ${skipped}`);
  if (errors.length > 0) {
    console.log(`   ⚠️  Errors: ${errors.join(", ")}`);
  }
}

async function seedCarCategories() {
  console.log("\n🚗 Ensuring Car Categories exist...");
  const DEFAULT_CATEGORIES = [
    { category: "sedan", seats: 4, carNames: ["Dzire", "Etios"] },
    { category: "ertiga", seats: 6, carNames: ["Ertiga"] },
    { category: "innova", seats: 7, carNames: ["Innova"] },
    { category: "crysta", seats: 7, carNames: ["Innova Crysta"] },
    { category: "tempo-traveler-12-seat", seats: 12, carNames: ["Tempo 12"] },
    { category: "tempo-traveler-17-seat", seats: 17, carNames: ["Tempo 17"] },
    { category: "tempo-traveler-26-seat", seats: 26, carNames: ["Tempo 26"] },
  ];

  for (const cat of DEFAULT_CATEGORIES) {
    await CarCategory.findOneAndUpdate(
      { category: cat.category },
      {
        ...cat,
        icon: {
          public_id: "default_icon",
          url: "https://via.placeholder.com/100?text=" + cat.category,
        },
        image: {
          public_id: "default_image",
          url: "https://via.placeholder.com/300x200?text=" + cat.category,
        },
        isActive: true,
      },
      { upsert: true, new: true },
    );
  }
  console.log("   ✅ Car categories ready");
}

async function seedRateMaster() {
  console.log("\n💰 Seeding Rate Master...");

  // Build category name → ObjectId map
  const categories = await CarCategory.find().select("category");
  const catMap = {};
  for (const c of categories) {
    catMap[c.category] = c._id;
  }

  let created = 0;
  let skipped = 0;
  const errors = [];

  for (const [
    catName,
    rateModel,
    baseRate,
    includedKm,
    extraKmRate,
    driverBata,
    state,
  ] of RATE_MASTER) {
    const catId = catMap[catName];
    if (!catId) {
      errors.push(`CarCategory not found: "${catName}"`);
      skipped++;
      continue;
    }

    try {
      await RateMaster.findOneAndUpdate(
        {
          vehicleCategory: catId,
          rateModel,
          state,
        },
        {
          baseRatePerDay: baseRate,
          includedKmPerDay: includedKm,
          extraKmRate: extraKmRate,
          driverBataPerDay: driverBata,
          isActive: true,
        },
        { upsert: true, new: true },
      );
      created++;
    } catch (err) {
      skipped++;
      errors.push(`Rate ${catName}|${rateModel}|${state}: ${err.message}`);
    }
  }

  console.log(`   ✅ Upserted: ${created}, Skipped: ${skipped}`);
  if (errors.length > 0) {
    console.log(`   ⚠️  Errors: ${errors.join(", ")}`);
  }
}

async function seedChargeMaster() {
  console.log("\n🏷️  Seeding Charge Master...");
  let created = 0;

  for (const charge of CHARGE_MASTER) {
    await ChargeMaster.findOneAndUpdate(
      { name: charge.name },
      charge,
      { upsert: true, new: true },
    );
    created++;
  }

  console.log(`   ✅ Upserted: ${created}`);
}

async function seedSurchargeMaster() {
  console.log("\n📅 Seeding Surcharge Master...");
  let created = 0;

  for (const surcharge of SURCHARGE_MASTER) {
    await SurchargeMaster.findOneAndUpdate(
      { name: surcharge.name },
      surcharge,
      { upsert: true, new: true },
    );
    created++;
  }

  console.log(`   ✅ Upserted: ${created}`);
}

async function seedAgentGrades() {
  console.log("\n🏅 Seeding Agent Grades...");
  let created = 0;

  for (const grade of AGENT_GRADES) {
    await AgentGrade.findOneAndUpdate(
      { grade: grade.grade },
      grade,
      { upsert: true, new: true },
    );
    created++;
  }

  console.log(`   ✅ Upserted: ${created}`);
}

async function seedGarages() {
  console.log("\n🏢 Seeding Garages...");
  const cities = await City.find().select("city");
  const cityMap = {};
  for (const c of cities) {
    cityMap[c.city.toLowerCase()] = c._id;
  }

  let created = 0;
  for (const g of GARAGES) {
    const baseCityId = cityMap[g.garageCity.toLowerCase()];
    if (!baseCityId) {
      console.warn(`   ⚠️ Base city "${g.garageCity}" not found, skipping garage.`);
      continue;
    }

    const assignedCityIds = g.assignedCities
      .map((cityName) => cityMap[cityName.toLowerCase()])
      .filter(Boolean);

    await Garage.findOneAndUpdate(
      { name: g.name },
      {
        name: g.name,
        garageCity: baseCityId,
        assignedCities: assignedCityIds,
        isActive: true,
      },
      { upsert: true, new: true },
    );
    created++;
  }

  console.log(`   ✅ Upserted: ${created}`);
}

async function seedStatePermits() {
  console.log("\n📄 Seeding State Permit Master...");
  const categories = await CarCategory.find();
  const catMap = new Map();
  for (const c of categories) {
    catMap.set(c.category.toLowerCase().trim().replace(/\s+/g, "-"), c._id);
  }

  let created = 0;
  for (const [state, catName, permitCharge, remarks] of STATE_PERMIT_MASTER) {
    const categoryId = catMap.get(catName);
    if (!categoryId) {
      console.warn(`   ⚠️ Category not found for permit: ${catName}`);
      continue;
    }

    await StatePermitMaster.findOneAndUpdate(
      { state, vehicleCategory: categoryId },
      {
        state,
        vehicleCategory: categoryId,
        permitCharge,
        remarks: remarks || "",
        isActive: true,
      },
      { upsert: true, new: true },
    );
    created++;
  }

  console.log(`   ✅ Upserted: ${created}`);
}

// ═══════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  CABNEX — MASTER DATA SEED SCRIPT");
  console.log("═══════════════════════════════════════════════════");

  try {
    await connectDB();
    console.log("✅ Connected to MongoDB");

    await seedCities();
    await seedCarCategories();
    await seedRoutes();
    await seedRateMaster();
    await seedChargeMaster();
    await seedSurchargeMaster();
    await seedAgentGrades();
    await seedGarages();
    await seedStatePermits();

    console.log("\n═══════════════════════════════════════════════════");
    console.log("  ✅ ALL MASTER DATA SEEDED SUCCESSFULLY");
    console.log("═══════════════════════════════════════════════════\n");
  } catch (err) {
    console.error("\n❌ Seed failed:", err);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

main();
