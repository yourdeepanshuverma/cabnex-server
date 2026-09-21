import mongoose from "mongoose";

const socialSchema = new mongoose.Schema({
  platform: { type: String, required: true }, // e.g., "facebook", "twitter"
  url: { type: String, required: true },
});

const faqSchema = new mongoose.Schema({
  question: { type: String },
  answer: { type: String },
});

const reviewSchema = new mongoose.Schema({
  name: { type: String },
  profile: {
    public_id: { type: String },
    url: { type: String },
  },
  role: { type: String }, // e.g., "Customer", "Client"
  rating: { type: Number, min: 1, max: 5 },
  comment: { type: String },
});

const websiteSettingSchema = new mongoose.Schema(
  {
    siteName: {
      type: String,
      required: true,
      default: "Cabnex",
    },
    logo: {
      public_id: { type: String, default: "" },
      url: { type: String, default: "" },
    },
    favicon: {
      public_id: { type: String, default: "" },
      url: { type: String, default: "" },
    },
    contactEmail: {
      type: String,
      default: "",
    },
    contactPhone: {
      type: String,
      default: "",
    },
    addresses: {
      type: [String],
      default: [],
    },
    socials: [socialSchema], // e.g. [{ platform: "facebook", url: "https://facebook.com" }]
    faqs: [faqSchema], // list of FAQs
    reviews: [reviewSchema], // customer reviews
    seo: {
      title: { type: String, default: "" },
      description: { type: String, default: "" },
      keywords: [{ type: String }],
    },
    defaultCommissionPercent: {
      type: Number,
      default: 0.05,
      min: 0,
      max: 1,
    },
  },
  { timestamps: true }
);

const WebsiteSetting = mongoose.model("WebsiteSetting", websiteSettingSchema);
export default WebsiteSetting;
