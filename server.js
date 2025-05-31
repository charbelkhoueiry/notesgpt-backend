const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { OpenAI } = require("openai");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// In-memory user store (to be replaced with a real DB like Firestore later)
const userDB = {};

function checkAccess(email, feature) {
  const today = new Date().toISOString().split("T")[0];
  if (!userDB[email]) {
    return { allowed: false, message: "❌ User not found" };
  }

  const user = userDB[email];
  if (user.plan === "paid") return { allowed: true };

  if (feature === "flashcards") {
    return { allowed: false, message: "🚫 Flashcards not available for free users" };
  }

  const lastUsed = user.lastUsed?.[feature];
  const usageCount = user.usageCount?.[feature] || 0;

  if (lastUsed !== today) {
    user.lastUsed = { ...user.lastUsed, [feature]: today };
    user.usageCount = { ...user.usageCount, [feature]: 0 };
  }

  if ((feature === "notes" || feature === "quiz") && usageCount >= 1) {
    return {
      allowed: false,
      message: `🚫 Free users can only generate 1 ${feature} per day`,
    };
  }

  user.usageCount[feature] = (user.usageCount[feature] || 0) + 1;
  return { allowed: true };
}

async function generateContent(prompt) {
  const completion = await openai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "gpt-3.5-turbo",
  });
  return completion.choices[0].message.content;
}

app.post("/api/:mode", async (req, res) => {
  const { topic, grade, bacType, email } = req.body;
  const { mode } = req.params;

  if (!topic || !grade || !bacType || !email) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (!userDB[email]) {
    userDB[email] = {
      plan: email === "paid@example.com" ? "paid" : "free",
      lastUsed: {},
      usageCount: {},
    };
  }

  const access = checkAccess(email, mode);
  if (!access.allowed) {
    return res.status(403).json({ error: access.message });
  }

  const prompt = `Generate ${mode} content for the topic '${topic}' for a grade ${grade} student in ${bacType} baccalaureate.`;
  const result = await generateContent(prompt);
  res.json({ result });
});

app.get("/", (req, res) => {
  res.send("✅ NotesGPT backend is live.");
});

app.listen(3000, () => console.log("Server running on port 3000"));
