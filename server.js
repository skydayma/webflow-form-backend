// server.js

import express from "express";
import cors from "cors";
import pkg from "@prisma/client";
import dns from "dns/promises";
import nodemailer from "nodemailer";
import net from "net";   // <-- added for SMTP connection test

// PRISMA
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const app = express();


// ======================================================
// 1) QUICK SMTP CONNECTION TEST (NO IMPACT ON APP)
// ======================================================

function testSMTPConnection() {
  console.log("\n=== SMTP CONNECTION TEST START ===");

  const socket = net.createConnection(587, "smtp.office365.com", () => {
    console.log("✅ SUCCESS: Able to CONNECT to smtp.office365.com:587");
    console.log("This means port 587 is OPEN.\n");
    socket.end();
  });

  socket.on("error", (err) => {
    console.log("❌ FAILED: Cannot connect to smtp.office365.com:587");
    console.log("Error:", err.code || err.message);
    console.log("This means Railway is BLOCKING outbound SMTP.\n");
  });

  socket.setTimeout(4000, () => {
    console.log("⏳ TIMEOUT: SMTP connection timed out (likely blocked by Railway).");
    socket.destroy();
  });
}

testSMTPConnection();
// ======================================================


// CORS CONFIG
const ALLOWED_ORIGIN =
  process.env.ALLOWED_ORIGIN ||
  "https://continuousintelligence-3-51707a2b60b8d.webflow.io";

app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());


// EMAIL FORMAT CHECK
function isValidEmailFormat(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}


// BLOCK PERSONAL EMAILS
const personalDomains = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "rediffmail.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);


// MX CHECK
async function hasValidMx(domain) {
  try {
    const records = await dns.resolveMx(domain);
    return records && records.length > 0;
  } catch (err) {
    console.log("MX LOOKUP FAILED:", domain, err.message);
    return false;
  }
}


// SMTP TRANSPORTER (Outlook 365)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.office365.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});


// ======================================================
// MAIN API: POST /submit
// ======================================================
app.post("/submit", async (req, res) => {
  try {
    const { name, email, slug } = req.body;
    console.log("Incoming /submit:", { name, email, slug });

    if (!name || !email || !slug) {
      return res.status(400).json({ success: false, error: "Missing fields" });
    }

    if (!isValidEmailFormat(email)) {
      return res.status(400).json({ success: false, error: "Invalid email" });
    }

    const domain = email.split("@")[1].toLowerCase();
    if (personalDomains.has(domain)) {
      return res.status(400).json({
        success: false,
        error: "Personal emails not allowed",
      });
    }

    const mxOK = await hasValidMx(domain);
    if (!mxOK) {
      return res.status(400).json({
        success: false,
        error: "Invalid corporate domain",
      });
    }

    // Fetch PDF by slug
    const pdf = await prisma.pdfs.findUnique({ where: { slug } });
    if (!pdf) {
      return res.status(404).json({ success: false, error: "PDF not found" });
    }

    // Save submission
    await prisma.submissions.create({ data: { name, email, slug } });

    // Send email
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: `Your requested document: ${pdf.title}`,
      html: `
        <p>Hi ${name},</p>
        <p>Your document is ready:</p>
        <a href="${pdf.pdf_url}">${pdf.title}</a>
      `,
    });

    return res.json({ success: true });
  } catch (err) {
    console.log("ERROR in /submit:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});


// START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
});
