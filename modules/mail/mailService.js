const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const { Scopes } = require("dioma");
const logoPath = "./public/images/logo.png";

if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: `.env.production` });
} else {
  dotenv.config({ path: `.env.development` });
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "gazikalovicaleksandar@gmail.com",
    pass: "xjxa adik reyk qgck",
  },
});

class MailService {
  // Single instance of the class for the entire application
  static scope = Scopes.Singleton();

  // Function to send verification email
  async sendVerificationEmail(name, email, token) {
    const verificationLink = `${process.env.FRONTEND_URL}/verify/${token}`;
    const mailOptions = {
      from: "gazikalovicaleksandar@gmail.com",
      to: email,
      subject: "Welcome to WheelDeal - Verify Your Email Address",
      html: await this.getAccountVerificationEmail(name, verificationLink),
      attachments: [
        {
          filename: "logo.png",
          path: logoPath,
          cid: logoPath, //same cid value as in the html img src
        },
      ],
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log(error);
      } else {
        console.log("Email sent: " + info.response);
      }
    });
  }

  async sendResetPasswordEmail(name, email, token) {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;
    const mailOptions = {
      from: "gazikalovicaleksandar@gmail.com",
      to: email,
      subject: "Password Reset Request",
      html: await this.getPasswordResetEmail(name, resetLink),
      attachments: [
        {
          filename: "logo.png",
          path: logoPath,
          cid: logoPath, //same cid value as in the html img src
        },
      ],
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log(error);
      } else {
        console.log("Email sent: " + info.response);
      }
    });
  }

  // Function to generate HTML email content with logo
  async getPasswordResetEmail(username, resetLink) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
          }
          .logo {
            text-align: center;
          }
          .logo img {
            max-width: 100px;
            height: auto;
          }
          .content {
            margin-top: 20px;
            text-align: left;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <img src="cid:${logoPath}" alt="WheelDeal">
          </div>
          <div class="content">
            <h2>Password Reset Request</h2>
            <p>Hello ${username},</p>
            <p>We received a request to reset your password. To reset your password, click on the link below:</p>
            <p><a href="${resetLink}">Reset Your Password</a></p>
            <p>If you didn't request a password reset, please ignore this email.</p>
            <p>This link will expire in 1 hour for security reasons.</p>
            <p>Thank you,<br>WheelDeal</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Function to generate HTML email content with logo
  async getAccountVerificationEmail(username, verificationLink) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
          }
          .logo {
            text-align: center;
          }
          .logo img {
            max-width: 100px;
            height: auto;
          }
          .content {
            margin-top: 20px;
            text-align: left;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <img src="cid:${logoPath}" alt="WheelDeal">
          </div>
          <div class="content">
            <h2>Welcome to WheelDeal</h2>
            <p>Hello ${username},</p>
            <p>Thank you for registering on WheelDeal. To verify your email address, click on the link below:</p>
            <p><a href="${verificationLink}">Verify Your Email Address</a></p>
            <p>Thank you,<br>WheelDeal</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = MailService;
