import mongoose, { model, Schema } from "mongoose";

const contactUsFormSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

const ContactUsForm =
  mongoose.models.ContactUsForm || model("ContactUsForm", contactUsFormSchema);

export default ContactUsForm;
