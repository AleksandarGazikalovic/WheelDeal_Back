const request = require("supertest");
const express = require("express");
const app = express();
const Comment = require("../models/Comment");
const bodyParser = require("body-parser");
const helmet = require("helmet");

// Import the router
const commentRouter = require("../routes/comments"); // Update the path accordingly
const User = require("../models/User");
const Post = require("../models/Post");

// Use the router in the app
app.use(express.json());
app.use(helmet());
app.use(bodyParser.json());
app.use("/api/comments", commentRouter);

// Mock data for the comment
const mockCommentData = {
  _id: "65256cfc0f2f4aeab10769f3",
  rating: 5,
  content: "A mock comment",
  author: "65256cfc0f2f4aeab10769f5",
  post: "65256cfc0f2f4aeab10769f2",
  subject: "MockSubject",
  createdAt: "2022-01-01T00:00:00.000Z",
};

// Update data for the PUT /:id route
const updateData = {
  author: "65256cfc0f2f4aeab10769f5",
  rating: 4,
  content: "Updated comment",
};

// Expected data after the comment is successfully updated
const expectedUpdatedCommentData = {
  _id: "65256cfc0f2f4aeab10769f3",
  rating: 4,
  content: "Updated comment",
  author: "65256cfc0f2f4aeab10769f5",
  post: "65256cfc0f2f4aeab10769f2",
  subject: "MockSubject",
  createdAt: "2022-01-01T00:00:00.000Z",
};

const postMockData = {
  _id: "65256cfc0f2f4aeab10769f2",
  userId: "65256cfc0f2f4aeab10769f1",
  brand: "Nissan",
  carModel: "Qashqai",
  year: 2016,
  mileage: 210000,
  transmission: "Manual",
  fuel: "Electric",
  drive: "RWD",
  engine: "120",
  location: {
    address: "Meštrovićeva, Belgrade, Serbia",
    latLng: { lat: "44.7699322", lng: "20.4906689" },
  },
  price: 35,
  from: "2024-01-14T23:00:00.000Z",
  to: "2024-01-25T23:00:00.000Z",
  isRented: false,
  createdAt: "2024-01-05T19:10:16.050Z",
  updatedAt: "2024-01-05T19:10:16.050Z",
  __v: 0,
};

const userMockData = {
  verificationToken: null,
  isLicenceVerified: false,
  resetPasswordToken: null,
  resetPasswordExpires: null,
  _id: "65256cfc0f2f4aeab10769f1",
  name: "Aleksandar",
  surname: "Gazikalovic",
  email: "aleksandargazikalovic@gmail.com",
  likedPosts: ["652d188f9ec493822d5a430a", "6525ac43da1636d709e8a5f2"],
  isAdmin: false,
  createdAt: "2023-10-10T15:25:48.902Z",
  __v: 18,
  city: "",
  phone: "38169710701",
  isAccountVerified: true,
};

const fakeId = "65256cfc0f2f4aeab10769f9";

jest.mock("../models/Comment");
jest.mock("../models/User");
jest.mock("../models/Post");
jest.mock("@aws-sdk/s3-request-presigner");
jest.mock("@aws-sdk/client-s3");

describe("Comment Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Create a new comment
  describe("POST /api/comments", () => {
    it("should create a new comment", async () => {
      Comment.create.mockResolvedValueOnce(mockCommentData);
      User.findById.mockResolvedValueOnce(userMockData);
      Post.findById.mockResolvedValueOnce(postMockData);
      const response = await request(app)
        .post("/api/comments/")
        .send(mockCommentData);
      expect(response.statusCode).toBe(200);
      expect(response.body.message).toBe("Comment created successfully.");
    });

    it("should return user not found", async () => {
      Comment.create.mockResolvedValueOnce(null);
      const response = await request(app)
        .post("/api/comments/")
        .send({
          ...mockCommentData,
          author: `${fakeId}`, // User not found
        });
      expect(response.statusCode).toBe(404);
      expect(response.body.message).toBe("User not found.");
    });

    it("should return post not found", async () => {
      Comment.create.mockResolvedValueOnce(null);
      User.findById.mockResolvedValueOnce(userMockData);
      const response = await request(app)
        .post("/api/comments/")
        .send({
          ...mockCommentData,
          post: `${fakeId}`, // Post not found
        });
      expect(response.statusCode).toBe(404);
      expect(response.body.message).toBe("Post not found.");
    });

    it("should return invalid rating", async () => {
      Comment.create.mockResolvedValueOnce(null);
      User.findById.mockResolvedValueOnce(userMockData);
      Post.findById.mockResolvedValueOnce(postMockData);
      const response = await request(app)
        .post("/api/comments/")
        .send({
          ...mockCommentData,
          rating: null, // Invalid rating
        });
      expect(response.statusCode).toBe(403);
      expect(response.body.message).toBe("Rating is required.");
    });
    it("should return author can't comment own post", async () => {
      Comment.create.mockResolvedValueOnce(null);
      User.findById.mockResolvedValueOnce(userMockData);
      Post.findById.mockResolvedValueOnce(postMockData);
      const response = await request(app)
        .post("/api/comments/")
        .send({
          ...mockCommentData,
          author: `${userMockData._id}`, // Author is the same as the post owner
        });
      expect(response.statusCode).toBe(403);
      expect(response.body.message).toBe("You can't comment your own post.");
    });
  });
  // Fetch all comments for a post related to a user
  describe("GET /api/comments/:id", () => {
    it("should get all comments for a user's posts", async () => {
      // Mocking the find method to return a post and a comment
      jest.spyOn(Post, "find").mockResolvedValueOnce([postMockData]);
      jest.spyOn(Comment, "find").mockImplementation(() => ({
        populate: jest.fn().mockImplementation(() => ({
          exec: jest.fn().mockResolvedValueOnce([mockCommentData]),
        })),
      }));
      const response = await request(app).get(
        `/api/comments/${postMockData.userId}`
      );

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual(expect.arrayContaining([mockCommentData]));
    });

    it("should return posts not found", async () => {
      // Mocking the find method to return a post and a comment
      Post.mockResolvedValueOnce(postMockData);
      jest.spyOn(Comment, "find").mockImplementation(() => ({
        populate: jest.fn().mockImplementation(() => ({
          exec: jest.fn().mockResolvedValueOnce([mockCommentData]),
        })),
      }));

      const response = await request(app).get("/api/comments/invalidUserId");

      expect(response.statusCode).toBe(404);
      expect(response.body.message).toBe("Posts not found.");
    });
  });

  // Update a comment
  describe("PUT /api/comments/:id", () => {
    it("should update a comment successfully", async () => {
      Comment.findById.mockResolvedValueOnce(mockCommentData);
      Comment.findByIdAndUpdate.mockResolvedValueOnce(
        expectedUpdatedCommentData
      );
      const response = await request(app)
        .put(`/api/comments/${mockCommentData._id}`)
        .send(updateData);
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual(expectedUpdatedCommentData);
    });

    it("should return comment not found", async () => {
      Comment.findByIdAndUpdate.mockResolvedValueOnce(null);
      const response = await request(app)
        .put(`/api/comments/${mockCommentData._id}`)
        .send(updateData);
      expect(response.statusCode).toBe(404);
      expect(response.body.message).toBe("Comment not found.");
    });

    it("should return forbidden update", async () => {
      Comment.findById.mockResolvedValueOnce(mockCommentData);
      Comment.findByIdAndUpdate.mockResolvedValueOnce(mockCommentData);
      const response = await request(app)
        .put(`/api/comments/${mockCommentData._id}`)
        .send({
          ...updateData,
          author: `${fakeId}`, // Different user ID than the one in the token
        });
      expect(response.statusCode).toBe(403);
      expect(response.body.message).toBe("You can't update this comment.");
    });
  });
  // Delete a comment
  describe("DELETE /api/comments/:id", () => {
    it("should delete a comment successfully", async () => {
      Comment.findById.mockResolvedValueOnce(mockCommentData);
      const response = await request(app)
        .delete(`/api/comments/${mockCommentData._id}`)
        .send({
          author: `${mockCommentData.author}`,
        });
      expect(response.statusCode).toBe(200);
      expect(response.body.message).toBe("Comment deleted successfully.");
    });

    it("should return comment not found for deletion", async () => {
      const response = await request(app)
        .delete(`/api/comments/${fakeId}`)
        .send({
          author: `${mockCommentData.author}`,
        });
      expect(response.statusCode).toBe(404);
      expect(response.body.message).toBe("Comment not found.");
    });

    it("should return forbidden deletion", async () => {
      Comment.findById.mockResolvedValueOnce(mockCommentData);
      const response = await request(app)
        .delete(`/api/comments/${mockCommentData._id}`)
        .send({
          author: `${fakeId}`, // Different user ID than the one in the token
        });
      expect(response.statusCode).toBe(403);
      expect(response.body.message).toBe("You can't delete this comment.");
    });
  });
});
