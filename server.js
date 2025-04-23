require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// Path to chat history file
const HISTORY_FILE = path.join(__dirname, 'chat_history.json');

// Ensure history file exists
async function initializeHistoryFile() {
  try {
    await fs.access(HISTORY_FILE);
  } catch {
    await fs.writeFile(HISTORY_FILE, JSON.stringify([]));
  }
}

// Load chat history from file
async function loadChatHistory() {
  try {
    const data = await fs.readFile(HISTORY_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error loading chat history:', err);
    return [];
  }
}

// Save chat history to file
async function saveChatHistory(messages) {
  try {
    await fs.writeFile(HISTORY_FILE, JSON.stringify(messages, null, 2));
  } catch (err) {
    console.error('Error saving chat history:', err);
  }
}

// Initialize history file on server start
initializeHistoryFile();

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // Load current chat history
    let messages = await loadChatHistory();

    // Add user message to history
    messages.push({ role: 'user', content: message });

    // Call Cohere API
    const response = await fetch('https://api.cohere.ai/v2/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'command-a-03-2025',
        messages: messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`Cohere API error: ${response.statusText}`);
    }

    const data = await response.json();
    const assistantMessage = data.message.content[0].text;

    // Add assistant response to history
    messages.push({ role: 'assistant', content: assistantMessage });

    // Limit history size
    const MAX_MESSAGES = 20;
    if (messages.length > MAX_MESSAGES) {
      messages = messages.slice(messages.length - MAX_MESSAGES);
    }

    // Save updated history
    await saveChatHistory(messages);

    // Return only the assistant's response
    res.json({ text: assistantMessage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));