import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const baseUri = (process.env.MONGODB_URI || "").replace(/\/+$/, "");
    const connectionInstance = await mongoose.connect(
      `${baseUri}/${process.env.DB_NAME || "Cabnex"}`
    );
    console.log(
      `\nMongoDB Connected !! DB HOST: ${connectionInstance.connection.host}`
    );
  } catch (error) {
    console.log("MongoDB Connection FAILED:", error);
  }
};

export default connectDB;
