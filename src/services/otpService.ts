import nodemailer from "nodemailer";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

const EMAIL_USER = process.env.EMAIL_USER as string;
const EMAIL_PASS = process.env.EMAIL_PASS as string;

interface SendOtpEmailOptions {
  to: string;
  otp: string;
}

// Generate OTP
export const generateOTP = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

const transporter = nodemailer.createTransport({
  host: "host207.checkdomain.de",
  port: 587,
  secure: false,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

export const send_otp_on_email = async ({
  to,
  otp,
}: SendOtpEmailOptions): Promise<void> => {
  const logoPath = path.resolve(__dirname, "../assets/logo.png");
  console.log(logoPath);
  const mailOptions = {
    from: EMAIL_USER,
    to,
    subject: "OTP Verification",
    text: `Your OTP code is ${otp}.`,
    html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2>OTP Verification</h2>
                <p>Your OTP code is <b>${otp}</b>.</p>
                <img src="cid:unique@cid" alt="Your Image" style="max-width: 100%; height: auto;">
            </div>
        `,
    attachments: [
      {
        filename: "logo.png",
        path: logoPath,
        cid: "unique@cid",
      },
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`OTP email sent to ${to}`);
  } catch (error) {
    console.error("Error sending OTP email:", error);
    throw new Error("Error sending OTP email");
  }
};

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async ({
  to,
  subject,
  html,
}: SendEmailOptions): Promise<void> => {
  const mailOptions = {
    from: EMAIL_USER,
    to,
    subject,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Error sending email");
  }
};
