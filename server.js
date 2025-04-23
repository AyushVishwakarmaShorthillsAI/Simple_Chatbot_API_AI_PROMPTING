require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); 

const app = express();
app.use(express.json());
app.use(cors());

const historyFile = path.join(__dirname, 'chat_history.json');

// Helper: Read chat history
function getChatHistory() {
  try {
    const raw = fs.readFileSync(historyFile, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Helper: Save message to history
function saveToHistory(role, message) {
  const history = getChatHistory();
  history.push({ role, message }); // Changed 'content' to 'message'
  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
}

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;

  try {
    // Save user message
    saveToHistory('user', message);

    const history = getChatHistory();

    const cohereRes = await fetch('https://api.cohere.ai/v1/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'command-r-plus',
        message,
        chat_history: history.map(item => ({ role: item.role, message: item.message })), // Map to correct format
      }),
    });

    const data = await cohereRes.json();

    // Extract assistant message correctly
    const assistantMessage = data?.response?.text || '';

    // Save assistant response
    saveToHistory('assistant', assistantMessage);

    res.json({ message: assistantMessage });
  } catch (err) {
    console.error('Error in /api/chat:', err.message, err.stack);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));