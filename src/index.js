import { v2 as cloudinary } from "cloudinary";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import connectDB from "./db/index.js";
import errorMiddleware from "./middlewares/errorMiddleware.js";
import adminRoutes from "./routes/admin.js";
import authRoutes from "./routes/auth.js";
import packageRoutes from "./routes/package.js";
import vendorRoutes from "./routes/vendor.js";
import transactionRoutes from "./routes/transaction.js";
import otpRoutes from "./routes/otp.js";

const app = express();
const port = process.env.PORT || 3000;
const node_env = process.env.NODE_ENV || "development";

dotenv.config({
  path: node_env === "production" ? ".env.prod" : ".env.local",
});

connectDB();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.use(
  express.json({
    limit: "16kb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "16kb",
  })
);

app.use(
  cookieParser({
    limit: "16kb",
  })
);

app.use(
  cors({
    origin: [
      process.env.CLIENT_URL || "http://localhost:5173",
      "https://cabnex.in",
      "https://www.cabnex.in",
      "https://admin.cabnex.in",
      "https://dev.cabnex.in",
      "http://localhost:5173",
      "http://localhost:5174",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  })
);

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/vendor", vendorRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/package", packageRoutes);
app.use("/api/v1/transaction", transactionRoutes);
app.use("/api/v1/otp", otpRoutes);

app.use(errorMiddleware);

app.listen(port, () => {
  console.log(`Server is running on port ${port} in ${node_env} Mode`);
});
