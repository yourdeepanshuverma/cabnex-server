import nodemailer from "nodemailer";

/**
 * Sends an email using nodemailer.
 * @param {string} to - recipient email address
 * @param {string} subject - email subject
 * @param {string} message - email HTML content
 */

async function sendEmail(to, subject, message) {
  try {
    // 1. Create transporter (SMTP connection)
    const transporter = nodemailer.createTransport({
      host: process.env.NODEMAILER_HOST, // For Gmail. Change for your SMTP.
      port: 587,
      secure: false,
      // auth: {
      //   user: process.env.NODEMAILER_USER,
      //   pass: process.env.NODEMAILER_PASS,
      // },
    });

    // 2. Email content
    const mailOptions = {
      from: `"Cabnex" <${process.env.NODEMAILER_USER}>`,
      to,
      subject,
      html: `
        <div style="font-family: Arial; padding: 15px;">
          ${message}
        </div>
      `,
    };

    // 3. Send email
    const info = await transporter.sendMail(mailOptions);

    console.log("Email sent: ", info.messageId);
    return true;
  } catch (err) {
    console.error("Email sending failed: ", err);
    return false;
  }
}

export default sendEmail;
