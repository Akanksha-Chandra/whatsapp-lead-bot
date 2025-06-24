const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const INDUSTRY = process.env.INDUSTRY || 'realEstate';

app.use(cors());
app.use(express.json());

const LEADS_FILE = path.join(__dirname, 'data', 'leads.json');
const CHATS_FILE = path.join(__dirname, 'data', 'chats.json');
const CONFIG_FILE = path.join(__dirname, 'config', 'businessProfiles.json');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(LEADS_FILE)) fs.writeFileSync(LEADS_FILE, JSON.stringify([]));
if (!fs.existsSync(CHATS_FILE)) fs.writeFileSync(CHATS_FILE, JSON.stringify({}));

const businessConfig = JSON.parse(fs.readFileSync(CONFIG_FILE))[INDUSTRY];

const readLeads = () => JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8') || '[]');
const writeLeads = (leads) => fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
const readChats = () => JSON.parse(fs.readFileSync(CHATS_FILE, 'utf8') || '{}');
const writeChats = (chats) => fs.writeFileSync(CHATS_FILE, JSON.stringify(chats, null, 2));

app.get('/', (req, res) => {
  res.json({ message: 'WhatsApp Lead Bot API is running!' });
});

app.post('/api/leads/create', (req, res) => {
  try {
    const { name, phone, source, message } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });

    const leadId = Date.now().toString();
    const newLead = {
      id: leadId,
      name,
      phone,
      source: source || 'Unknown',
      initialMessage: message || '',
      status: 'Active',
      classification: 'Pending',
      createdAt: new Date().toISOString(),
      metadata: {}
    };

    const leads = readLeads();
    leads.push(newLead);
    writeLeads(leads);

    const chats = readChats();
    chats[leadId] = {
      leadId,
      messages: [
        createMessage('bot', generateGreeting(newLead)),
        createMessage('bot', businessConfig.questions[0])
      ],
      currentStep: 1,
      extractedData: {},
      createdAt: new Date().toISOString()
    };
    writeChats(chats);

    res.json({
      success: true,
      leadId,
      lead: newLead,
      initialMessages: chats[leadId].messages.map(m => m.message)
    });
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/chat/:leadId/message', async (req, res) => {
  try {
    const { leadId } = req.params;
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const chats = readChats();
    const chat = chats[leadId];
    chat.messages.push(createMessage('user', message));

    const aiResponse = await generateAIResponse(chats, leadId, message);
    chat.messages.push(createMessage('bot', aiResponse.message));

    if (aiResponse.isComplete) {
      await classifyLead(leadId);
    }

    writeChats(chats);
    res.json({ success: true, messages: chat.messages, isComplete: aiResponse.isComplete });
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/chat/:leadId', (req, res) => {
  try {
    const chats = readChats();
    const chat = chats[req.params.leadId];
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.json({ success: true, chat });
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/leads', (req, res) => {
  try {
    res.json({ success: true, leads: readLeads() });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function generateGreeting(lead) {
  const template = businessConfig.greetingTemplates;
  return template[Math.floor(Math.random() * template.length)].replace('{name}', lead.name);
}

function createMessage(sender, message) {
  return { id: Date.now().toString(), sender, message, timestamp: new Date().toISOString() };
}

async function generateAIResponse(chats, leadId, userMessage) {
  const chat = chats[leadId];
  const step = chat.currentStep;

  if (step > 0) {
    extractDataFromResponse(chats[leadId], userMessage, step - 1);
  }

  let isComplete = false, botMessage = '';

  if (step < businessConfig.questions.length) {
    botMessage = step === 0 ? businessConfig.questions[0] : `Got it! ${businessConfig.questions[step]}`;
    chat.currentStep++;
  } else {
    botMessage = "Thank you for providing all the details! Our team will follow up shortly.";
    isComplete = true;
  }

  return { message: botMessage, isComplete };
}

function extractDataFromResponse(chat, response, step) {
  const stepKeys = ['location', 'intent', 'propertyType', 'budget', 'timeline', 'purpose'];
  const key = stepKeys[step];
  if (!key) return;

  let value = response.trim().toLowerCase();
  if (!value) return;

  switch (key) {
    case 'intent':
      value = /buy|purchase/.test(value) ? 'buy' : /rent/.test(value) ? 'rent' : '';
      break;
    case 'budget':
      if (value.includes('cr')) value = `${parseFloat(value.replace(/[^\d.]/g, ''))} cr`;
      else if (value.includes('l')) value = `${parseFloat(value.replace(/[^\d.]/g, ''))} lakh`;
      break;
    case 'purpose':
      value = value.includes('invest') ? 'investment' : 'personal';
      break;
  }

  if (value) chat.extractedData[key] = value;
}

async function classifyLead(leadId) {
  const leads = readLeads();
  const chats = readChats();
  const chat = chats[leadId];
  const leadIndex = leads.findIndex(l => l.id === leadId);
  if (leadIndex === -1 || !chat) return;

  const data = chat.extractedData;
  let score = 0;
  const weights = businessConfig.scoreWeights;

  if (data.budget) {
    const budget = data.budget.toLowerCase();
    if (budget.includes('cr')) score += (weights.budget || 30) + 20;
    else if (budget.includes('l')) {
      const amount = parseInt(budget.replace(/[^\d]/g, ''));
      if (amount >= 50) score += weights.budget || 30;
      else if (amount >= 20) score += (weights.budget || 30) * 0.7;
      else score += (weights.budget || 30) * 0.4;
    }
  }

  if (data.timeline) {
    const t = data.timeline.toLowerCase();
    if (/urgent|asap|immediate|1\s*month/.test(t)) score += (weights.timeline || 25) + 10;
    else if (/month|soon/.test(t)) score += weights.timeline || 25;
    else score += (weights.timeline || 25) * 0.5;
  }

  if (data.location) score += weights.location || 20;
  if (data.intent) score += weights.intent || 15;
  if (data.propertyType) score += /villa|commercial/.test(data.propertyType) ? 10 : 5;

  const thresholds = businessConfig.scoreThresholds;
  let classification = 'Unqualified';
  if (score >= (thresholds.hot || 70)) classification = 'Hot';
  else if (score >= (thresholds.warm || 50)) classification = 'Warm';
  else if (score >= (thresholds.cold || 30)) classification = 'Cold';

  leads[leadIndex].classification = classification;
  leads[leadIndex].metadata = { ...leads[leadIndex].metadata, ...data };
  leads[leadIndex].score = score;
  writeLeads(leads);
}

async function callGroq(prompt) {
  try {
    if (!process.env.GROQ_API_KEY) throw new Error('API key not configured');

    const { data } = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: process.env.GROQ_MODEL || 'llama3-8b-8192',
        messages: [
          { role: 'system', content: 'You are a helpful assistant. Provide brief, relevant responses only.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 100,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    return data?.choices?.[0]?.message?.content?.trim() || '';
  } catch (err) {
    console.error('Groq API error:', err.message);
    // Updated fallback responses - more concise and relevant
    const fallbacks = [
      "Thank you for the information.",
      "Got it, thanks!",
      "Received your details.",
      "Information noted."
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 WhatsApp Lead Bot API ready for industry: ${INDUSTRY}`);
});
