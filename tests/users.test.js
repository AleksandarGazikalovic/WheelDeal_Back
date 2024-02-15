const request = require("supertest");
const express = require("express");
const app = express();
const User = require("../models/User");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const path = require("path");

// Import the router
const userRouter = require("../routes/users"); // Update the path accordingly

// Use the router in the app
app.use(express.json());
app.use(helmet());
app.use(bodyParser.json());
app.use("/api/users", userRouter);

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
  isAccountVerified: false,
  isLicenceVerified: false,
  resetPasswordToken: null,
  resetPasswordExpires: null,
  createdAt: "2022-01-01T00:00:00.000Z",
  updatedAt: "2022-01-01T12:34:56.789Z",
};

// Update data for the PUT /:id route
const updateData = {
  _id: "65256cfc0f2f4aeab10769f3",
  name: "UpdatedName",
  surname: "UpdatedSurname",
  email: "updated.email@example.com",
  phone: "987654321",
  desc: "Updated description",
};

// Expected data after the user is successfully updated
const expectedUpdatedUserData = {
  _id: "65256cfc0f2f4aeab10769f3",
  name: "UpdatedName",
  surname: "UpdatedSurname",
  email: "updated.email@example.com",
  IDCard: "1234567890123",
  driverLicense: "123456789",
  phone: "987654321", // Updated phone number
  address: "123 Main St",
  city: "MockCity",
  likedPosts: [],
  desc: "Updated description", // Updated description
  isAdmin: false,
  verificationToken: "mockVerificationToken",
  isAccountVerified: false,
  isLicenceVerified: false,
  resetPasswordToken: null,
  resetPasswordExpires: null,
  createdAt: "2022-01-01T00:00:00.000Z",
};

const fakeId = "65256cfc0f2f4aeab10769f2";

// Mocking the User model and other dependencies
jest.mock("../models/User");
jest.mock("@aws-sdk/s3-request-presigner");
jest.mock("@aws-sdk/client-s3");

describe("User Routes", () => {
  // Mocking the middleware function
  const mockVerifyToken = jest.fn();
  jest.mock("../routes/users", () => {
    return {
      verifyToken: mockVerifyToken,
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /:id", () => {
    it("should get user by ID successfully", async () => {
      User.findById.mockResolvedValueOnce({
        _doc: {
          mockUserData,
        },
      });

      const response = await request(app).get(`/api/users/${mockUserData._id}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.objectContaining({
          mockUserData,
        })
      );
    });
  });

  describe("PUT /:id", () => {
    it("should update user successfully", async () => {
      User.findByIdAndUpdate.mockResolvedValueOnce({
        _doc: expectedUpdatedUserData,
      });

      const response = await request(app)
        .put(`/api/users/${mockUserData._id}`)
        .send(updateData);

      expect(response.status).toBe(200);
      //TODO cant get this to work
      expect(response.body).toEqual(
        expect.objectContaining(expectedUpdatedUserData)
      );
    });

    it("should handle forbidden update", async () => {
      User.findByIdAndUpdate.mockResolvedValueOnce({
        _doc: mockUserData,
      });

      const response = await request(app)
        .put(`/api/users/${fakeId}`) // Different user ID than the one in the token
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe("You can update only your account!");
    });
  });

  describe("DELETE /:id", () => {
    it("should delete user successfully", async () => {
      User.findByIdAndDelete.mockResolvedValueOnce({
        _doc: {
          mockUserData,
        },
      });

      const response = await request(app)
        .delete(`/api/users/${mockUserData._id}`)
        .send({
          _id: `${mockUserData._id}`,
          isAdmin: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Account has been deleted");
    });

    it("should handle forbidden deletion", async () => {
      User.findByIdAndDelete.mockResolvedValueOnce({
        _doc: {
          mockUserData,
        },
      });

      const response = await request(app)
        .delete(`/api/users/${fakeId}`) // Different user ID than the one in the token
        .send({
          _id: `${mockUserData._id}`,
          isAdmin: false,
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe("You can delete only your account!");
    });
  });

  describe("POST /:id/upload", () => {
    it("should upload profile picture successfully", async () => {
      User.findById.mockResolvedValueOnce({
        _doc: {
          mockUserData,
        },
      });

      // Mock AWS S3 commands and responses
      const imagePath = path.join(__dirname, "../public/images/logo.png");

      const response = await request(app)
        .post(`/api/users/${mockUserData._id}/upload`)
        .set("Content-Type", "multipart/form-data")
        .field("_id", `${mockUserData._id}`)
        .attach("profileImage", imagePath);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.any(String)); // Assuming it's a signed URL
    });

    it("should handle forbidden upload", async () => {
      User.findById.mockResolvedValueOnce({
        _doc: {
          mockUserData,
        },
      });

      const imagePath = path.join(__dirname, "../public/images/logo.png");

      const response = await request(app)
        .post(`/api/users/${fakeId}/upload`) // Different user ID than the one in the token
        .set("Content-Type", "multipart/form-data")
        .field("updateData", JSON.stringify(updateData))
        .attach("profileImage", imagePath);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe("You can update only your account!");
    });
  });
});
