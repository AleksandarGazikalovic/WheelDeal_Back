const request = require("supertest");
const express = require("express");
const app = express();
const User = require("../models/User");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const path = require("path");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");

// Import the router
const authRouter = require("../routes/auth");

// Use the router in the app
app.use(express.json());
app.use(helmet());
app.use(bodyParser.json());
app.use("/api/auth", authRouter);

// Mock data for the user registration
const mockRegistrationData = {
  name: "John",
  surname: "Doe",
  email: "john.doe@example.com",
  password: "mockPassword",
};

// Mock data for the user login
const mockLoginData = {
  email: "john.doe@example.com",
  password: "mockPassword",
};

// Mock data for the user's password reset
const mockResetPasswordData = {
  email: "john.doe@example.com",
  password: "newMockPassword",
};

// Mock data for the user
const mockUserData = {
  _id: "65256cfc0f2f4aeab10769f3",
  name: "John",
  surname: "Doe",
  email: "john.doe@example.com",
  password: "mockPassword",
  IDCard: "1234567890123",
  driverLicense: "123456789",
  phone: "123456789",
  address: "123 Main St",
  city: "MockCity",
  likedPosts: [],
  profileImage: "mockProfileImage.jpg",
  desc: "A mock user",
  isAdmin: false,
  verificationToken: "mockVerificationToken",
  isAccountVerified: true,
  isLicenceVerified: false,
  resetPasswordToken: null,
  resetPasswordExpires: null,
  createdAt: "2022-01-01T00:00:00.000Z",
  updatedAt: "2022-01-01T12:34:56.789Z",
  refreshToken: [],
  save: jest.fn(),
};

// Mock data for the user update
const updateData = {
  userId: "65256cfc0f2f4aeab10769f3",
  IDCard: "verifiedIDCard",
  driverLicense: "verifiedDriverLicense",
  phone: "verifiedPhone",
  address: "verifiedAddress",
  city: "verifiedCity",
  isLicenceVerified: true,
};

// Expected data after the user is successfully updated
const expectedUpdatedUserData = {
  _id: "65256cfc0f2f4aeab10769f3",
  name: "John",
  surname: "Doe",
  email: "john.doe@example.com",
  password: "mockPassword",
  IDCard: "verifiedIDCard", // Updated ID card
  driverLicense: "verifiedDriverLicense", // Updated driver license
  phone: "verifiedPhone", // Updated phone
  address: "verifiedAddress", // Updated address
  city: "verifiedCity", // Updated city
  likedPosts: [],
  profileImage: "mockProfileImage.jpg",
  desc: "A mock user",
  isAdmin: false,
  verificationToken: "mockVerificationToken",
  isAccountVerified: true,
  isLicenceVerified: true, // Updated isLicenceVerified
  resetPasswordToken: null,
  resetPasswordExpires: null,
  createdAt: "2022-01-01T00:00:00.000Z",
  updatedAt: "2022-01-01T12:34:56.789Z",
  refreshToken: [],
  save: jest.fn(),
};

mockSendMail = jest.fn().mockResolvedValue({});

const fakeId = "65256cfc0f2f4aeab10769f2";

// Mocking the User model and other dependencies
jest.mock("../models/User");
jest.mock("@aws-sdk/s3-request-presigner");
jest.mock("@aws-sdk/client-s3");
jest.mock("nodemailer", () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn(),
  }),
}));
jest.mock("bcrypt");
jest.mock("crypto"),
  () => ({
    randomBytes: jest.fn().mockReturnThis(),
    toString: jest.fn().mockReturnValue("token"),
  });

describe("Auth Routes", () => {
  const mockToken = jwt.sign(
    { id: mockUserData._id },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_DURATION,
    }
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /register", () => {
    it("should create a new user", async () => {
      // Mock bcrypt.hash to return a hashed password
      jest.spyOn(bcrypt, "hash").mockResolvedValueOnce("hashedPassword");

      const res = await request(app)
        .post("/api/auth/register")
        .send(mockRegistrationData);
      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toBe(
        "Registration successful. Check your email for verification."
      );
      // Verify that nodemailer.sendMail was called with the correct parameters
      expect(nodemailer.createTransport().sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "gazikalovicaleksandar@gmail.com",
          to: "john.doe@example.com",
          subject: "Welcome to WheelDeal - Verify Your Email Address",
          html: expect.any(String),
        }),
        expect.any(Function)
      );
    });

    it("should return an error if the user already exists", async () => {
      // Mock the findOne method
      User.findOne.mockResolvedValue(mockUserData);
      const res = await request(app)
        .post("/api/auth/register")
        .send(mockRegistrationData);
      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toBe("Email is already in use.");
    });
  });

  describe("POST /login", () => {
    it("should login a user", async () => {
      // Mock the findOne method
      User.findOne.mockResolvedValue(mockUserData);
      // Mock bcrypt.compare to return true
      bcrypt.compare.mockResolvedValueOnce(true);
      // Mock the save function for an instance of the User model

      const res = await request(app)
        .post("/api/auth/login")
        .send(mockLoginData);

      const mockUserWithoutSave = { ...mockUserData };
      delete mockUserWithoutSave.save;

      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual({
        user: mockUserWithoutSave,
        accessToken: expect.any(String),
      });
    });

    it("should return an error if the user does not exist", async () => {
      // Mock the findOne method
      User.findOne.mockResolvedValue(null);
      const res = await request(app)
        .post("/api/auth/login")
        .send(mockLoginData);
      expect(res.statusCode).toEqual(404);
      expect(res.body.message).toBe(
        "There is no existing user connnected with that email address."
      );
    });

    it("should return an error if the user's account is not verified", async () => {
      // Mock the findOne method
      User.findOne.mockResolvedValue({
        ...mockUserData,
        isAccountVerified: false,
      });
      const res = await request(app)
        .post("/api/auth/login")
        .send(mockLoginData);
      expect(res.statusCode).toEqual(403);
      expect(res.body.message).toBe(
        "Email not verified. Please check your email for the verification link."
      );
    });

    it("should return an error if the password is incorrect", async () => {
      // Mock the findOne method
      User.findOne.mockResolvedValue(mockUserData);
      // Mock bcrypt.compare to return false
      bcrypt.compare.mockResolvedValueOnce(false);
      const res = await request(app)
        .post("/api/auth/login")
        .send(mockLoginData);
      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toBe(
        "Failed to log in! Please check your credentials."
      );
    });
  });

  describe("POST /logout", () => {
    it("should clear refreshToken cookie and return 204 if refreshToken is found in the database", async () => {
      // Mock User.findOne to simulate finding a user with the provided refreshToken
      const mockUser = {
        refreshToken: ["validRefreshToken"],
        save: jest.fn(),
      };
      jest.spyOn(User, "findOne").mockImplementation(() => ({
        exec: jest.fn().mockResolvedValueOnce(mockUser),
      }));

      const response = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", ["refreshToken=validRefreshToken"]);

      // Ensure the response status is 204 (No Content)
      expect(response.statusCode).toEqual(204);
    });

    it("should return 204 if refreshToken is not found in the database", async () => {
      // Mock User.findOne to simulate not finding a user with the provided refreshToken
      jest.spyOn(User, "findOne").mockResolvedValue(null);

      const response = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", ["refreshToken=nonexistentToken"]);

      // Ensure the response status is 204 (No Content)
      expect(response.status).toBe(204);
    });

    it("should return 204 if no refreshToken cookie is provided", async () => {
      const response = await request(app).post("/api/auth/logout");

      // Ensure no refreshToken cookie is set in the response
      expect(response.headers["set-cookie"]).toBeUndefined();

      // Ensure the response status is 204 (No Content)
      expect(response.status).toBe(204);

      // Ensure User.findOne is not called since no refreshToken is provided
      expect(User.findOne).not.toHaveBeenCalled();
    });
  });

  describe("PUT /:id/verify", () => {
    it("should verify the user and return 200 with success message if user is authorized", async () => {
      User.findByIdAndUpdate.mockResolvedValueOnce({
        _doc: expectedUpdatedUserData,
      });

      const response = await request(app)
        .put(`/api/auth/${mockUserData._id}/verify`)
        .send(updateData);

      expect(response.status).toBe(200);
      //TODO cant get this to work
      expect(response.body.message).toBe("Account has been verified");
    });

    it("should handle forbidden update", async () => {
      User.findByIdAndUpdate.mockResolvedValueOnce({
        _doc: expectedUpdatedUserData,
      });

      const response = await request(app)
        .put(`/api/auth/${fakeId}/verify`) // Different user ID than the one in the token
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe("You can verify only your account!");
    });
  });

  describe("POST /forgot-password", () => {
    it("should send a reset password email", async () => {
      // Mock the findOne method
      User.findOne.mockResolvedValue(mockUserData);
      jest.spyOn(User.prototype, "save").mockResolvedValueOnce(mockUserData);
      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: `${mockUserData.email}` });
      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toBe("Password reset email sent successfully");
      expect(nodemailer.createTransport().sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "gazikalovicaleksandar@gmail.com",
          to: "john.doe@example.com",
          subject: "Password Reset Request",
          html: expect.any(String),
        })
      );
    });

    it("should return an error if the user does not exist", async () => {
      // Mock the findOne method
      User.findOne.mockResolvedValue(null);
      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: `${mockUserData.email}` });
      expect(res.statusCode).toEqual(404);
      expect(res.body.message).toBe("User not found");
    });
  });

  describe("POST /reset-password", () => {
    it("should reset the user's password", async () => {
      // Mock the findOne method
      User.findOne = jest.fn().mockResolvedValue(mockUserData);
      const res = await request(app)
        .post(`/api/auth/reset-password/${mockUserData.resetPasswordToken}`)
        .send({
          password: `${mockUserData.password}`,
        });
      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toBe("Password reset successfully");
    });

    it("should return an error if the reset password token is invalid", async () => {
      // Mock the findOne method
      User.findOne = jest.fn().mockResolvedValue(null);
      const res = await request(app)
        .post(`/api/auth/reset-password/${mockUserData.resetPasswordToken}`)
        .send({
          password: `${mockUserData.password}`,
        });
      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toBe("Invalid or expired token");
    });
  });

  describe("GET /verify/:token", () => {
    it("should verify the user and return 200 with success message", async () => {
      // Mock the User.findOne method to simulate finding a user with the provided verification token

      jest.spyOn(User, "findOne").mockResolvedValue(mockUserData);

      const response = await request(app).get(
        `/api/auth/verify/${mockUserData.verificationToken}`
      );
      // Ensure the response status is 200
      expect(response.status).toBe(200);

      // Ensure the user's isAccountVerified is set to true
      expect(mockUserData.isAccountVerified).toBe(true);

      // Ensure User.findOne is called with the correct arguments
      expect(User.findOne).toHaveBeenCalledWith({
        verificationToken: "mockVerificationToken",
      });

      // Ensure the user's verificationToken is removed
      expect(mockUserData.verificationToken).toBeUndefined();

      // Ensure User.save is called to update the user
      expect(mockUserData.save).toHaveBeenCalled();

      // Ensure the response body contains the success message
      expect(response.body.message).toBe("Email verified successfully.");
    });

    it("should return 404 and an error message if the verification token is invalid", async () => {
      // Mock User.findOne to simulate not finding a user with the provided verification token
      jest.spyOn(User, "findOne").mockResolvedValue(null);

      const response = await request(app).get(
        "/api/auth/verify/invalidVerificationToken"
      );

      // Ensure the response status is 404
      expect(response.status).toBe(404);

      // Ensure User.findOne is called with the correct arguments
      expect(User.findOne).toHaveBeenCalledWith({
        verificationToken: "invalidVerificationToken",
      });

      // Ensure the response body contains the error message
      expect(response.body.message).toBe("Invalid verification token.");
    });

    it("should return 500 and an error message if an error occurs during verification", async () => {
      // Mock User.findOne to simulate an error during the verification process
      jest
        .spyOn(User, "findOne")
        .mockRejectedValue(new Error("Verification error"));

      const response = await request(app).get(
        "/api/auth/verify/errorVerificationToken"
      );

      // Ensure the response status is 500
      expect(response.status).toBe(500);

      // Ensure User.findOne is called with the correct arguments
      expect(User.findOne).toHaveBeenCalledWith({
        verificationToken: "errorVerificationToken",
      });

      // Ensure the response body contains the error message
      expect(response.body.error).toBe(
        "An error occurred during email verification."
      );
    });
  });
});
