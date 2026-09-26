/**
 * Migration Script: RateMaster state → city
 *
 * Run this ONCE after deploying the schema change.
 * It drops the old unique index on { vehicleCategory, rateModel, state }
 * and removes the legacy `state` field from existing documents.
 *
 * Usage: node --experimental-modules server/src/utils/migrateRateMaster.js
 *
 * NOTE: After running this, you'll need to re-add rate cards via the admin panel
 * with city references since old state-based rates can't be auto-mapped to cities.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const baseUri = (process.env.MONGODB_URI || "").replace(/\/+$/, "");
const MONGO_URI = `${baseUri}/${process.env.DB_NAME || "Cabnex"}`;

async function migrate() {
  console.log("🔄 Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected\n");

  const db = mongoose.connection.db;
  const collection = db.collection("ratemasters");

  // 1. Drop old index
  try {
    const indexes = await collection.indexes();
    const oldIndex = indexes.find(
      (idx) => idx.key?.vehicleCategory && idx.key?.rateModel && idx.key?.state,
    );
    if (oldIndex) {
      console.log(`🗑️  Dropping old index: ${oldIndex.name}`);
      await collection.dropIndex(oldIndex.name);
      console.log("   ✅ Old index dropped");
    } else {
      console.log("ℹ️  No old state-based index found (already migrated?)");
    }
  } catch (err) {
    console.log(`⚠️  Index drop error (may be fine): ${err.message}`);
  }

  // 2. Count and remove legacy documents that have `state` but no `city`
  const legacyCount = await collection.countDocuments({
    state: { $exists: true },
    city: { $exists: false },
  });

  if (legacyCount > 0) {
    console.log(`\n🗑️  Found ${legacyCount} legacy state-based rate cards.`);
    console.log("   These will be DELETED since they can't be auto-mapped to cities.");
    console.log("   You'll need to re-create them via the admin panel with city references.\n");

    const result = await collection.deleteMany({
      state: { $exists: true },
      city: { $exists: false },
    });
    console.log(`   ✅ Deleted ${result.deletedCount} legacy rate documents`);
  } else {
    console.log("ℹ️  No legacy state-based rate documents to clean up");
  }

  // 3. Remove `state` field from any remaining documents
  const stateFieldCount = await collection.countDocuments({
    state: { $exists: true },
  });
  if (stateFieldCount > 0) {
    const result = await collection.updateMany(
      { state: { $exists: true } },
      { $unset: { state: "" } },
    );
    console.log(`   ✅ Removed legacy 'state' field from ${result.modifiedCount} documents`);
  }

  console.log("\n✅ Migration complete!");
  console.log("   → New rate cards should be created via Admin → Rate Master (per city)\n");

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
