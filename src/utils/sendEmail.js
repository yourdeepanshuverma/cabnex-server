import nodemailer from "nodemailer";

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const transporter = nodemailer.createTransport({
  host: process.env.NODEMAILER_HOST,
  port: Number(process.env.NODEMAILER_PORT),
  secure: false,
  auth: {
    user: process.env.NODEMAILER_USER,
    pass: process.env.NODEMAILER_PASS,
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  family: 4,
});

/**
 * Sends an email using nodemailer.
 * @param {string} to - recipient email address
 * @param {string} subject - email subject
 * @param {string} message - email HTML content
 */

async function sendEmail(to, subject, message, retryCount = 0) {
  try {
    const mailOptions = {
      from: "Cabnex <info@cabnex.in>",
      to,
      bcc: "sales@cabnex.in",
      subject,
      html: message,
    };

    await transporter.sendMail(mailOptions);

    return true;
  } catch (err) {
    console.error("Email sending failed:", err.code, err.responseCode);

    // Retry ONLY for Gmail temporary errors
    if (err.responseCode === 421 && retryCount < 3) {
      console.log(`Retrying email in 30s... (${retryCount + 1}/3)`);
      await delay(30000);
      return sendEmail(to, subject, message, retryCount + 1);
    }

    return false;
  }
}

export default sendEmail;
