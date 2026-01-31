import axios from "axios";

/**
 * Send OTP SMS to the given phone number
 * @param {string} phone - Recipient's phone number
 * @param {string} otp - One-Time Password to send
 * @param {string} forWhat -default: "registration" -  Purpose of the OTP (e.g., login, registration, forgot password, etc.)
 */

export const sendOtpSms = async (phone, otp) => {
  if (!process.env.NEXTINCLOUD_API) {
    throw new Error("NEXTINCLOUD_API is not defined in environment variables");
  } else if (!process.env.NEXTINCLOUD_USERNAME) {
    throw new Error(
      "NEXTINCLOUD_USERNAME is not defined in environment variables",
    );
  } else if (!process.env.NEXTINCLOUD_APIKEY) {
    throw new Error(
      "NEXTINCLOUD_APIKEY is not defined in environment variables",
    );
  } else if (!process.env.NEXTINCLOUD_SIGNATURE) {
    throw new Error(
      "NEXTINCLOUD_SIGNATURE is not defined in environment variables",
    );
  } else if (!process.env.NEXTINCLOUD_ENTITY_ID_LOGIN) {
    throw new Error(
      "NEXTINCLOUD_ENTITY_ID_LOGIN is not defined in environment variables",
    );
  } else if (!process.env.NEXTINCLOUD_TEMPLATE_ID_LOGIN) {
    throw new Error(
      "NEXTINCLOUD_TEMPLATE_ID_LOGIN is not defined in environment variables",
    );
  }

  try {
    const baseUrl = process.env.NEXTINCLOUD_API;

    const params = {
      username: process.env.NEXTINCLOUD_USERNAME,
      dest: phone,
      apikey: process.env.NEXTINCLOUD_APIKEY,
      signature: process.env.NEXTINCLOUD_SIGNATURE,
      msgtype: "PM",
      msgtxt: `Dear User, Welcome to Nexfleet Car Rentel! Your OTP for login is ${otp}. Valid for 5 minutes. Please do not share this OTP. Regards, Nexfleet Tech`,
      VAR1: otp,
      entityid: process.env.NEXTINCLOUD_ENTITY_ID_LOGIN,
      templateid: process.env.NEXTINCLOUD_TEMPLATE_ID_LOGIN,
    };

    // Generate query string
    let queryString = new URLSearchParams(params).toString();

    // Replace '+' (spaces) with '%20' for strict URL encoding
    queryString = queryString.replace(/\+/g, "%20");

    const url = `${baseUrl}?${queryString}`;

    const { data } = await axios.get(url);

    return data;
  } catch (error) {
    console.error("Error sending OTP SMS:", error);
    throw error;
  }
};
