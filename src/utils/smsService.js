import axios from "axios";

/**
 * Send OTP SMS to the given phone number
 * @param {string} phone - Recipient's phone number
 * @param {string} otp - One-Time Password to send
 * @param {string} forWhat -default: "registration" -  Purpose of the OTP (e.g., login, registration, forgot password, etc.)
 */

export const sendOtpSms = async (phone, otp) => {
  const baseUrl = process.env.NEXTINCLOUD_API;

  const params = {
    username: process.env.NEXTINCLOUD_USERNAME,
    dest: phone,
    apikey: process.env.NEXTINCLOUD_APIKEY,
    signature: process.env.NEXTINCLOUD_SIGNATURE,
    msgtype: "PM",
    msgtxt: `Dear User, Welcome to Nexfleet Car Rentel! Your OTP for login is ${otp}. Valid for 5 minutes. Please do not share this OTP. Regards, Nexfleet Tech`,
    VAR1: otp,
    entityid: process.env.NEXTINCLOUD_ENTITY_ID,
    templateid: process.env.NEXTINCLOUD_TEMPLATE_ID,
  };

  // Generate query string
  let queryString = new URLSearchParams(params).toString();

  // Replace '+' (spaces) with '%20' for strict URL encoding
  queryString = queryString.replace(/\+/g, "%20");

  const url = `${baseUrl}?${queryString}`;

  const { data } = await axios.get(url);

  return data;
};
