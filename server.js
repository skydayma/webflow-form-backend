import express from "express";
import cors from "cors";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

app.post("/submit", async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    const submission = await prisma.submissions.create({
      data: { name, email },
    });

    return res.json({ success: true, submission });
  } catch (err) {
    console.error("Backend error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));
