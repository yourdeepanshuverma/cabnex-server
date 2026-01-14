import mongoose, { model, Schema } from "mongoose";

const carCategorySchema = new Schema({
  category: {
    type: String,
    required: [true, "Category is required."],
    unique: true,
  },
  seats: {
    type: Number,
    default: 4,
  },
  carNames: {
    type: [String],
    default: [],
  },
  icon: {
    public_id: {
      type: String,
      required: [true, "Icon public ID is required."],
    },
    url: { type: String, required: [true, "Icon URL is required."] },
  },
  image: {
    public_id: {
      type: String,
      required: [true, "Image public ID is required."],
    },
    url: { type: String, required: [true, "Image URL is required."] },
  },
  isActive: { type: Boolean, default: true },
});

const CarCategory =
  mongoose.models.CarCategory || model("CarCategory", carCategorySchema);

export default CarCategory;
