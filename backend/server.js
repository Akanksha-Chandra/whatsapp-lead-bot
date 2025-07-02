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
      await classifyLeadWithGroq(leadId);
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
    await extractDataFromResponseWithGroq(chats[leadId], userMessage, step - 1);
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

async function extractDataFromResponseWithGroq(chat, response, step) {
  const stepKeys = ['location', 'intent', 'propertyType', 'budget', 'timeline', 'purpose'];
  const key = stepKeys[step];
  if (!key) return;

  // Use Groq to extract structured data from user response
  const extractionPrompt = `Extract ${key} information from this real estate inquiry response: "${response}"

Return only the extracted value in this format:
- For location: return city/area name only
- For intent: return "buy", "rent", or "sell" only
- For propertyType: return property type (e.g., "2BHK flat", "villa", "plot")
- For budget: return budget amount with currency (e.g., "75L", "1.2cr")
- For timeline: return timeline (e.g., "3 months", "urgent", "flexible")
- For purpose: return "personal" or "investment"

If no clear information is found, return "unclear".`;

  try {
    const extractedValue = await callGroq(extractionPrompt);
    if (extractedValue && extractedValue.toLowerCase() !== 'unclear') {
      chat.extractedData[key] = extractedValue.trim();
    }
  } catch (error) {
    console.error('Error extracting data with Groq:', error);
    // Fallback to basic extraction
    extractDataFromResponse(chat, response, step);
  }
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

async function classifyLeadWithGroq(leadId) {
  const leads = readLeads();
  const chats = readChats();
  const chat = chats[leadId];
  const leadIndex = leads.findIndex(l => l.id === leadId);
  if (leadIndex === -1 || !chat) return;

  // Prepare conversation history for analysis
  const conversationHistory = chat.messages.map(msg => 
    `${msg.sender === 'bot' ? 'Agent' : 'Customer'}: ${msg.message}`
  ).join('\n');

  const classificationPrompt = `Analyze this real estate lead conversation and classify the lead quality.

CONVERSATION HISTORY:
${conversationHistory}

EXTRACTED DATA:
${JSON.stringify(chat.extractedData, null, 2)}

CLASSIFICATION CRITERIA - You MUST classify as exactly one of these three categories:

**HOT** - High conversion potential:
- Clear intent to buy/rent with specific requirements
- Defined budget range mentioned (actual numbers)
- Urgent timeline (within 1-6 months, "urgent", "soon", "ASAP")
- Specific location preferences mentioned
- Responsive and engaged throughout conversation
- Ready to take next steps (site visits, documentation, meetings)
- Asks follow-up questions or shows genuine interest

**COLD** - Low conversion potential:
- Vague or unclear requirements ("just browsing", "exploring options")
- No specific budget mentioned or very flexible/distant timeline
- Generic responses without specifics
- Unresponsive to follow-up questions
- General inquiries without commitment indicators
- No urgency expressed

**INVALID** - Not a genuine prospect:
- Nonsensical responses, gibberish, or random characters
- Test entries or clearly fake information
- No meaningful engagement despite multiple attempts
- Spam or bot-like behavior
- Completely inappropriate or irrelevant responses
- Single word responses that make no sense

IMPORTANT: You must classify as exactly one of: HOT, COLD, or INVALID (uppercase only)

Respond in this exact JSON format:
{
  "classification": "HOT",
  "confidence": 85,
  "reason": "Clear intent with specific budget and urgent timeline",
  "priority": "High"
}`;

  try {
    const classificationResult = await callGroq(classificationPrompt);
    console.log('Raw Groq classification result:', classificationResult);
    
    // Parse the JSON response
    let parsedResult;
    try {
      // Clean the response in case there's extra text
      const jsonMatch = classificationResult.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : classificationResult;
      parsedResult = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Error parsing classification result:', parseError);
      console.log('Raw result was:', classificationResult);
      // Fallback to rule-based classification
      await classifyLeadRuleBased(leadId);
      return;
    }

    // Validate classification value
    const validClassifications = ['HOT', 'COLD', 'INVALID'];
    const classification = parsedResult.classification?.toUpperCase();
    
    if (!validClassifications.includes(classification)) {
      console.error('Invalid classification returned:', parsedResult.classification);
      // Default to COLD if classification is invalid
      parsedResult.classification = 'COLD';
    } else {
      parsedResult.classification = classification;
    }

    // Update lead with classification
    leads[leadIndex].classification = parsedResult.classification;
    leads[leadIndex].metadata = { 
      ...leads[leadIndex].metadata, 
      ...chat.extractedData,
      confidence: parsedResult.confidence || 50,
      classificationReason: parsedResult.reason || 'AI classification',
      priority: parsedResult.priority || 'Medium',
      classificationDate: new Date().toISOString(),
      classificationMethod: 'groq-ai'
    };

    writeLeads(leads);
    console.log(`✅ Lead ${leadId} classified as ${parsedResult.classification} with ${parsedResult.confidence}% confidence: ${parsedResult.reason}`);

  } catch (error) {
    console.error('Error classifying lead with Groq:', error);
    // Fallback to rule-based classification
    await classifyLeadRuleBased(leadId);
  }
}

async function classifyLeadRuleBased(leadId) {
  const leads = readLeads();
  const chats = readChats();
  const chat = chats[leadId];
  const leadIndex = leads.findIndex(l => l.id === leadId);
  if (leadIndex === -1 || !chat) return;

  const data = chat.extractedData;
  let score = 0;
  const weights = businessConfig.scoreWeights || {};

  // Check for invalid/gibberish responses first
  const userMessages = chat.messages.filter(m => m.sender === 'user').map(m => m.message.toLowerCase());
  const hasGibberish = userMessages.some(msg => 
    /^[a-z]{10,}$/.test(msg) || // Random letters
    /^\d{8,}$/.test(msg) || // Random numbers
    msg.length < 2 ||
    /^(test|asdf|qwerty|123)/i.test(msg)
  );

  if (hasGibberish || userMessages.length === 0) {
    leads[leadIndex].classification = 'INVALID';
    leads[leadIndex].metadata = { 
      ...leads[leadIndex].metadata, 
      ...data,
      classificationReason: 'Invalid or test responses detected',
      classificationMethod: 'rule-based-invalid'
    };
    writeLeads(leads);
    return;
  }

  // Score calculation for HOT/COLD classification
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

  // Simple HOT/COLD classification based on score
  let classification = 'COLD';
  if (score >= 60) {
    classification = 'HOT';
  }

  leads[leadIndex].classification = classification;
  leads[leadIndex].metadata = { 
    ...leads[leadIndex].metadata, 
    ...data,
    score: score,
    classificationMethod: 'rule-based',
    classificationReason: `Score-based: ${score}/100`
  };
  writeLeads(leads);
  console.log(`✅ Rule-based classification: Lead ${leadId} = ${classification} (Score: ${score})`);
}

async function callGroq(prompt) {
  try {
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ API key not configured');

    const { data } = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: process.env.GROQ_MODEL || 'llama3-70b-8192',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert real estate lead qualification assistant. Provide accurate, structured responses based on conversation analysis.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.3, // Lower temperature for more consistent classification
        top_p: 0.9
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    return data?.choices?.[0]?.message?.content?.trim() || '';
  } catch (err) {
    console.error('Groq API error:', err.message);
    throw err; // Re-throw to allow fallback handling
  }
}

// Additional endpoint to manually reclassify leads
app.post('/api/leads/:leadId/reclassify', async (req, res) => {
  try {
    const { leadId } = req.params;
    await classifyLeadWithGroq(leadId);
    
    const leads = readLeads();
    const lead = leads.find(l => l.id === leadId);
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    res.json({ 
      success: true, 
      classification: lead.classification,
      metadata: lead.metadata
    });
  } catch (error) {
    console.error('Error reclassifying lead:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to get classification statistics
app.get('/api/leads/stats', (req, res) => {
  try {
    const leads = readLeads();
    const stats = {
      total: leads.length,
      hot: leads.filter(l => l.classification && l.classification.toUpperCase() === 'HOT').length,
      cold: leads.filter(l => l.classification && l.classification.toUpperCase() === 'COLD').length,
      invalid: leads.filter(l => l.classification && l.classification.toUpperCase() === 'INVALID').length,
      pending: leads.filter(l => !l.classification || l.classification.toUpperCase() === 'PENDING').length
    };
    
    console.log('Stats calculated:', stats); // Debug log
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 WhatsApp Lead Bot API ready for industry: ${INDUSTRY}`);
  console.log(`🤖 Groq AI classification enabled: ${process.env.GROQ_API_KEY ? 'YES' : 'NO'}`);
});
