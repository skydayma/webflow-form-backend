// server.js

import express from "express";
import cors from "cors";
import { PrismaClient } from "./generated/prisma/index.js";

// Initialize Prisma Client
const prisma = new PrismaClient();

// Initialize Express App
const app = express();
app.use(express.json());
app.use(cors());

// TEST ROUTE
app.get("/", (req, res) => {
  res.send("Server is running...");
});

// ROUTE TO INSERT FORM DATA
app.post("/submit", async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: "Name and Email are required" });
    }

    const submission = await prisma.submissions.create({
      data: { name, email },
    });

    res.json({ success: true, data: submission });

  } catch (err) {
    console.error("Error inserting data:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// START THE SERVER
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
