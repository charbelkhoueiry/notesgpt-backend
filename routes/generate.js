const express = require('express');
const router = express.Router();
const { generateNotes } = require('../utils/openai');

router.post('/generate-notes', async (req, res) => {
  const { topic, grade, bacType } = req.body;

  try {
    const output = await generateNotes(topic, grade, bacType);
    res.json({ notes: output });
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;