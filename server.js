import pkg from "@prisma/client";
const { PrismaClient } = pkg;

import express from "express";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

const prisma = new PrismaClient();

app.post("/submit", async (req, res) => {
  try {
    const { name, email } = req.body;

    const record = await prisma.submissions.create({
      data: { name, email }
    });

    return res.json({ success: true, record });
  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ error: true });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));
