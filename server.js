const admin = require("firebase-admin");
const serviceAccount = require("./firebase-service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const usersRef = db.collection("users");

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { OpenAI } = require("openai");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ⬇️ Helper function to check access for user
async function checkAccess(email, feature) {
  const today = new Date().toISOString().split("T")[0];

  const userRef = usersRef.doc(email);
  const userSnap = await userRef.get();
  let user = userSnap.exists ? userSnap.data() : null;

  // Create new user if not found
  if (!user) {
    user = {
      plan: email === "paid@example.com" ? "paid" : "free",
      lastUsed: {},
      usageCount: {},
    };
  }

  if (user.plan === "paid") {
    await userRef.set(user, { merge: true });
    return { allowed: true, user };
  }

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

  // Save updated usage to Firestore
  await userRef.set(user, { merge: true });

  return { allowed: true, user };
}

// ⬇️ OpenAI prompt handler
async function generateContent(prompt) {
  const completion = await openai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "gpt-3.5-turbo",
  });
  return completion.choices[0].message.content;
}

// ⬇️ Main API route
app.post("/api/:mode", async (req, res) => {
  const { topic, grade, bacType, email } = req.body;
  const { mode } = req.params;

  if (!topic || !grade || !bacType || !email) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const access = await checkAccess(email, mode);
  if (!access.allowed) {
    return res.status(403).json({ error: access.message });
  }

  const prompt = `Generate ${mode} content for the topic '${topic}' for a grade ${grade} student in ${bacType} baccalaureate.`;
  const result = await generateContent(prompt);
  res.json({ result });
});

// ⬇️ Health check
app.get("/", (req, res) => {
  res.send("✅ NotesGPT backend is live.");
});

app.listen(3000, () => console.log("Server running on port 3000"));
