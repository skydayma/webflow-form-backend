import express from "express";
import cors from "cors";
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

// Convert BigInt to string
function convertBigInt(obj) {
  return JSON.parse(JSON.stringify(obj, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  ));
}

app.post("/submit", async (req, res) => {
  try {
    const { name, email } = req.body;

    const submission = await prisma.submissions.create({
      data: { name, email },
    });

    // Fix BigInt error
    const safeSubmission = convertBigInt(submission);
    res.json({ success: true, data: safeSubmission });

  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));
