const request = require("supertest");
const express = require("express");
const app = express();
const Post = require("../models/Post");
const User = require("../models/User");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const path = require("path");
const jwt = require("jsonwebtoken");

// Import the router
const postRouter = require("../routes/posts"); // Update the path accordingly

// Use the router in the app
app.use(express.json());
app.use(helmet());
app.use(bodyParser.json());
app.use("/api/posts", postRouter);

// Mock data for the post
const mockPostData = {
  _id: "65256cfc0f2f4aeab10769f2",
  location: {
    latLng: {
      lat: 44.7726684,
      lng: 20.4790015,
    },
    address: "Nikšićka, Belgrade, Serbia",
  },
  userId: "65c15ca2eed30f04888909d1",
  images: [
    "D:\\Projects\\wheel_deal\\wheel_deal_backend\\public\\images\\logo.png",
    "D:\\Projects\\wheel_deal\\wheel_deal_backend\\public\\images\\logo.png",
  ],
  brand: "BMW",
  carModel: "M5",
  year: 2015,
  mileage: 121212,
  transmission: "Manual",
  fuel: "Diesel",
  drive: "RWD",
  engine: "2015",
  price: 30,
  from: "2024-02-11T23:00:00.000Z",
  to: "2024-02-22T23:00:00.000Z",
};

// Update data for the PUT /:id route
const updateObject = {
  _id: "65256cfc0f2f4aeab10769f2",
  userId: "65c15ca2eed30f04888909d1",
  brand: "UpdatedBrand",
  price: 40,
  year: 2016,
};

// Expected data after the post is successfully updated
const expectedUpdatedPostData = {
  ...mockPostData,
  ...updateObject,
};

// Mock data for the user
const mockUserData = {
  _id: "65256cfc0f2f4aeab10769f1",
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
  updateOne: jest.fn().mockImplementation(async (updateQuery) => {
    if (updateQuery.$push && updateQuery.$push.likedPosts) {
      // Simulate pushing to likedPosts
      mockUserData.likedPosts.push(updateQuery.$push.likedPosts);
    } else if (updateQuery.$pull && updateQuery.$pull.likedPosts) {
      // Simulate pulling from likedPosts
      const index = mockUserData.likedPosts.indexOf(
        updateQuery.$pull.likedPosts
      );
      if (index !== -1) {
        mockUserData.likedPosts.splice(index, 1);
      }
    }
  }),
};

// Update data for the like route
const updateUser = {
  _id: "65256cfc0f2f4aeab10769f1",
  likedPosts: ["65256cfc0f2f4aeab10769f2"],
};

// Expected data after the user likes the post
const expectedUpdatedUserData = {
  ...mockUserData,
  ...updateUser,
};

const filterData = {
  startDate: "2024-02-11T23:00:00.000Z",
  endDate: "2024-02-22T23:00:00.000Z",
  startPrice: 20,
  endPrice: 40,
  brand: "BMW",
  location: "mestroviceva",
};

const fakeId = "65256cfc0f2f4aeab10769f3";

const hasMore = false;

// Mocking the Post model and other dependencies
jest.mock("../models/Post");
jest.mock("../models/User");
jest.mock("@aws-sdk/s3-request-presigner");
jest.mock("@aws-sdk/client-s3");
jest.mock("aws-sdk");

app.use(express.json());
app.use("/api/posts", postRouter);

describe("Post routes", () => {
  // Create a mock token
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

  describe("POST /api/posts/", () => {
    it("should create a new post", async () => {
      jest.spyOn(Post.prototype, "save").mockResolvedValueOnce(mockPostData);
      const response = await request(app)
        .post("/api/posts/")
        .field("location", JSON.stringify(mockPostData.location))
        .field("userId", mockPostData.userId)
        .field("brand", mockPostData.brand)
        .field("carModel", mockPostData.carModel)
        .field("year", mockPostData.year)
        .field("mileage", mockPostData.mileage)
        .field("transmission", mockPostData.transmission)
        .field("fuel", mockPostData.fuel)
        .field("drive", mockPostData.drive)
        .field("engine", mockPostData.engine)
        .field("price", mockPostData.price)
        .field("from", mockPostData.from)
        .field("to", mockPostData.to)
        // .attach("images", mockPostData.images) //Cant get this to work
        .set("Authorization", `Bearer ${mockToken}`); // Replace with the path to an image file
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ...mockPostData,
        images: expect.any(Array),
      }); //images transformed to something else
    });
  });

  describe("GET /api/posts/:id", () => {
    it("should get all posts", async () => {
      Post.findById.mockResolvedValueOnce(mockPostData);
      const response = await request(app).get(`/api/posts/${mockPostData._id}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ...mockPostData,
        images: expect.any(Array), //images transformed to something else
      });
    });
  });

  describe("PUT /api/posts/:id", () => {
    it("should update a post", async () => {
      Post.findById.mockResolvedValueOnce(mockPostData);
      Post.findByIdAndUpdate.mockResolvedValueOnce(expectedUpdatedPostData);
      jest.spyOn(Post.prototype, "save").mockResolvedValueOnce(mockPostData);
      const response = await request(app)
        .put(`/api/posts/${updateObject._id}`)
        .field("userId", updateObject.userId)
        .field("brand", updateObject.brand)
        .field("price", updateObject.price)
        .field("year", updateObject.year)
        // .attach("images", mockPostData.images) //Cant get this to work
        .set("Authorization", `Bearer ${mockToken}`); // Replace with the path to an image file
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ...expectedUpdatedPostData,
        images: expect.any(Array),
      }); //images transformed to something else
    });

    it("should handle forbidden update", async () => {
      Post.findById.mockResolvedValueOnce(mockPostData);
      Post.findByIdAndUpdate.mockResolvedValueOnce(mockPostData);
      const response = await request(app)
        .put(`/api/posts/${fakeId}`)
        .send({ ...updateObject, userId: fakeId }) // Different post ID than the one in the body
        .set("Authorization", `Bearer ${mockToken}`);
      expect(response.status).toBe(401);
      expect(response.body.message).toBe("You can only update your post!");
    });
  });

  describe("DELETE /api/posts/:id", () => {
    it("should delete a post", async () => {
      Post.findById.mockResolvedValueOnce(mockPostData);
      Post.findByIdAndDelete.mockResolvedValueOnce(null);
      const response = await request(app)
        .delete(`/api/posts/${mockPostData._id}`)
        .send({ userId: mockPostData.userId })
        .set("Authorization", `Bearer ${mockToken}`);
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Post has been deleted!");
    });

    it("should handle forbidden deletion", async () => {
      Post.findById.mockResolvedValueOnce(mockPostData);
      Post.findByIdAndDelete.mockResolvedValueOnce(mockPostData);
      const response = await request(app)
        .delete(`/api/posts/${mockPostData._id}`)
        .send({ userId: fakeId }) // Different post ID than the one in the body
        .set("Authorization", `Bearer ${mockToken}`);
      expect(response.status).toBe(401);
      expect(response.body.message).toBe("You can only delete your post!");
    });
  });

  describe("LIKE /api/posts/:id/like", () => {
    it("should like a post", async () => {
      Post.findById.mockResolvedValueOnce(mockPostData);
      User.findById.mockResolvedValueOnce(mockUserData);
      const response = await request(app)
        .put(`/api/posts/${mockPostData._id}/like`)
        .send({ userId: mockUserData._id })
        .set("Authorization", `Bearer ${mockToken}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual(expectedUpdatedUserData.likedPosts);
    });
  });

  describe("USER POSTS /api/posts/profile/:id", () => {
    it("should get all posts for a user", async () => {
      Post.find.mockResolvedValueOnce([mockPostData]);
      const response = await request(app).get(
        `/api/posts/profile/${mockUserData._id}`
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        { ...mockPostData, images: expect.any(Array) },
      ]);
    });
  });

  describe("LIKED POSTS /api/posts/liked/:id", () => {
    it("should get all posts for a user", async () => {
      User.findById.mockResolvedValueOnce(mockUserData);
      Post.findById.mockResolvedValueOnce(mockPostData);
      const response = await request(app).get(
        `/api/posts/liked/${mockUserData._id}`
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        { ...mockPostData, images: expect.any(Array) },
      ]);
    });
  });

  describe("FILTER POSTS /api/posts/filter/all", () => {
    it("should get all posts", async () => {
      // Mock the find method to return all posts without filtering
      jest.spyOn(Post, "find").mockImplementation(() => ({
        skip: jest.fn().mockImplementation(() => ({
          limit: jest.fn().mockResolvedValueOnce([mockPostData]),
        })),
      }));
      const response = await request(app).get(`/api/posts/filter/all`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        hasMore: false,
        posts: [{ ...mockPostData, images: expect.any(Array) }],
      });
    });

    it("should get all posts for a brand", async () => {
      // Mock the aggregate method to return all posts for a brand
      jest.spyOn(Post, "aggregate").mockImplementation(() => ({
        skip: jest.fn().mockImplementation(() => ({
          limit: jest.fn().mockResolvedValueOnce([mockPostData]),
        })),
      }));

      const response = await request(app).get(
        `/api/posts/filter/all?brand=${filterData.brand}`
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        hasMore: false,
        posts: [{ ...mockPostData, images: expect.any(Array) }],
      });
    });

    it("should get all posts for combination of filters", async () => {
      // Mock the aggregate method to return all posts for a combination of filters
      jest.spyOn(Post, "aggregate").mockImplementation(() => ({
        skip: jest.fn().mockImplementation(() => ({
          limit: jest.fn().mockResolvedValueOnce([mockPostData]),
        })),
      }));

      const response = await request(app).get(
        `/api/posts/filter/all?startDate=${filterData.startDate}&endDate=${filterData.endDate}` +
          `&startPrice=${filterData.startPrice}&endPrice=${filterData.endPrice}&brand=${filterData.brand}` +
          `&location=${filterData.location}`
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        hasMore: false,
        posts: [{ ...mockPostData, images: expect.any(Array) }],
      });
    });
  });
});
