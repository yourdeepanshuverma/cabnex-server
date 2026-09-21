import mongoose, { model, Schema } from "mongoose";

const agentGradeSchema = new Schema(
  {
    grade: {
      type: String,
      required: [true, "Grade is required."],
      unique: true,
      uppercase: true,
      trim: true,
    },
    cabMarkupPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 1, // stored as decimal, e.g., 0.08 = 8%
    },
    cashbackPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 1, // stored as decimal, e.g., 0.01 = 1%
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  },
);

const AgentGrade =
  mongoose.models.AgentGrade || model("AgentGrade", agentGradeSchema);

export default AgentGrade;
