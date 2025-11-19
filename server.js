// server.js

import express from "express";
import cors from "cors";
import pkg from "@prisma/client";
import dns from "dns/promises";
import nodemailer from "nodemailer";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const app = express();

/* ====== CORS CONFIG ====== */
// put your real Webflow published domain here:
const ALLOWED_ORIGIN =
  process.env.ALLOWED_ORIGIN || "https://continuousintelligence-3-51707a2b60b8d.webflow.io";

app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

/* ====== HELPERS ====== */

// basic email format check
function isValidEmailFormat(email) {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// block common personal email providers
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

// MX record validation for corporate domains
async function hasValidMx(domain) {
  try {
    const records = await dns.resolveMx(domain);
    return Array.isArray(records) && records.length > 0;
  } catch (err) {
    console.error("MX lookup error for domain:", domain, err.message);
    return false;
  }
}

/* ====== SMTP (OUTLOOK) SETUP ====== */

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.office365.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // STARTTLS
  auth: {
    user: process.env.SMTP_USER, // e.g. no-reply@yourcompany.com
    pass: process.env.SMTP_PASS, // app password
  },
});

/* ====== MAIN ENDPOINT: POST /submit ====== */

app.post("/submit", async (req, res) => {
  try {
    const { name, email, slug } = req.body || {};
    console.log("Incoming /submit:", { name, email, slug });

    // Step 1: basic field validation
    if (!name || !email || !slug) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    if (!isValidEmailFormat(email)) {
      return res.status(400).json({
        success: false,
        error: "Invalid email format",
      });
    }

    // Step 2: block personal domains
    const [, domain] = email.split("@");
    if (!domain) {
      return res.status(400).json({
        success: false,
        error: "Invalid email domain",
      });
    }

    const lowerDomain = domain.toLowerCase();
    if (personalDomains.has(lowerDomain)) {
      return res.status(400).json({
        success: false,
        error: "Personal email domains are not allowed",
        reason: "blocked_personal_domain",
      });
    }

    // Step 3: MX check (corporate domain must be able to receive mail)
    const mxOk = await hasValidMx(lowerDomain);
    if (!mxOk) {
      return res.status(400).json({
        success: false,
        error: "Email domain cannot receive messages",
        reason: "invalid_mx",
      });
    }

    // Step 4: lookup PDF by slug
    const pdf = await prisma.pdfs.findUnique({
      where: { slug },
    });

    if (!pdf) {
      return res.status(404).json({
        success: false,
        error: "Requested document not found",
        reason: "unknown_slug",
      });
    }

    // Step 5: store submission
    await prisma.submissions.create({
      data: {
        name,
        email,
        slug,
      },
    });

    // Step 6: send email with PDF link
    const subject = `Your requested document: ${pdf.title || "Download"}`;
    const htmlBody = `
      <p>Hi ${name || ""},</p>
      <p>Thank you for your interest.</p>
      <p>You can download your requested document using the link below:</p>
      <p><a href="${pdf.pdf_url}" target="_blank" rel="noopener noreferrer">
        ${pdf.title || "Download PDF"}
      </a></p>
      <p>If you did not request this document, you can safely ignore this email.</p>
      <p>Best regards,<br/>Team Continuous Intelligence</p>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject,
      html: htmlBody,
    });

    // Step 7: respond to Webflow
    return res.json({
      success: true,
      message: "Submission stored and email sent",
    });
  } catch (err) {
    console.error("ERROR in /submit:", err);
    return res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
});

/* ====== START SERVER ====== */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
