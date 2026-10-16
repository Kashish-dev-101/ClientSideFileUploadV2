const express = require("express");
const jwt = require("jsonwebtoken");
const CORS = require("cors");
require("dotenv").config();

const app = express();
const PORT = 8001;

app.use(express.json());

const allowedOrigins = process.env.ALLOWED_ORIGIN.split(",").map((s) =>
  s.trim()
);

// Middleware to handle CORS
app.use(
  CORS({
    origin: allowedOrigins, // Allow these origins
    methods: ["GET", "POST"], // Allow only GET and POST methods
  })
);

app.post("/ik-auth-v2", (req, res) => {
  try {
    const { uploadPayload, expire } = req.body || {};
    if (!uploadPayload || typeof uploadPayload !== "object") {
      return res.status(400).json({ message: "uploadPayload is required" });
    }

    // ImageKit V2 rule: exp must not exceed iat by more than 3600s — clamp
    // server-side so a misbehaving client can't request an over-long token.
    const expiresIn = Math.min(Number(expire) || 1800, 3600);

    const token = jwt.sign(uploadPayload, process.env.IMAGEKIT_PRIVATE_KEY, {
      expiresIn,
      header: {
        alg: "HS256",
        typ: "JWT",
        kid: process.env.IMAGEKIT_PUBLIC_KEY,
      },
    });

    console.log("Issued V2 JWT for payload:", uploadPayload);
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to generate token" });
  }
});

app.listen(PORT, () => {
  console.log(`V2 auth server started at port ${PORT}`);
});
