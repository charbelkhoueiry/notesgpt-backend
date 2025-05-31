const { OpenAI } = require('openai');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateNotes(topic, grade, bacType) {
  const prompt = `Generate detailed, simplified study notes on "${topic}" for a ${bacType} track student in grade ${grade}. Include definitions, examples, and key points.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });

  return response.choices[0].message.content;
}

module.exports = { generateNotes };