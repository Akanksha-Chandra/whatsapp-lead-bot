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

// Enhanced validation patterns for responses
const VALIDATION_PATTERNS = {
  location: {
    valid: [
      /mumbai|pune|delhi|bangalore|chennai|hyderabad|kolkata|ahmedabad/i,
      /\b[a-z]{3,}\s+(nagar|area|road|sector|colony|society)\b/i,
      /near\s+[a-z]{3,}/i,
      /\b[a-z]{4,}\b.*\b[a-z]{4,}\b/i // Two words minimum for location
    ],
    invalid: [
      /^(no|not sure|don't know|anywhere|any|idk)$/i,
      /^[a-z]{1,2}$/i,
      /^\d+$/
    ]
  },
  propertyType: {
    valid: [
      /\b(flat|apartment|bhk|villa|house|plot|land|commercial|office|shop)\b/i
    ],
    keywords: {
      'flat': ['flat', 'apartment', '1bhk', '2bhk', '3bhk', '4bhk'],
      'villa': ['villa', 'house', 'bungalow', 'independent'],
      'plot': ['plot', 'land'],
      'commercial': ['commercial', 'office', 'shop', 'showroom']
    }
  },
  budget: {
    valid: [
      /\d+\s*(l|lakh|cr|crore)/i,
      /\d+\s*-\s*\d+\s*(l|lakh|cr|crore)/i,
      /under\s+\d+/i,
      /above\s+\d+/i,
      /around\s+\d+/i
    ],
    browsing: [
      /^(browsing|just looking|not decided|haven't decided|send listings)$/i,
      /^(flexible|open|depends)$/i
    ]
  },
  intent: {
    buy: ['buy', 'purchase', 'buying', 'own'],
    rent: ['rent', 'rental', 'renting', 'lease'],
    investment: ['invest', 'investment', 'portfolio'],
    personal: ['personal', 'family', 'own use', 'live in']
  },
  timeline: {
    urgent: ['urgent', 'asap', 'immediate', 'this week', 'this month'],
    soon: ['3 months', 'quarter', 'soon', 'within 6 months'],
    flexible: ['6 months', 'year', 'flexible', 'no rush']
  }
};

// Ensure directories and files exist
const dataDir = path.join(__dirname, 'data');
const configDir = path.join(__dirname, 'config');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
if (!fs.existsSync(LEADS_FILE)) fs.writeFileSync(LEADS_FILE, JSON.stringify([]));
if (!fs.existsSync(CHATS_FILE)) fs.writeFileSync(CHATS_FILE, JSON.stringify({}));

// Load business configuration
let businessConfig;
try {
  businessConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))[INDUSTRY];
  if (!businessConfig) {
    throw new Error(`Configuration for industry '${INDUSTRY}' not found`);
  }
} catch (error) {
  console.error('Error loading business configuration:', error.message);
  process.exit(1);
}

// File operations
const readLeads = () => JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8') || '[]');
const writeLeads = (leads) => fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
const readChats = () => JSON.parse(fs.readFileSync(CHATS_FILE, 'utf8') || '{}');
const writeChats = (chats) => fs.writeFileSync(CHATS_FILE, JSON.stringify(chats, null, 2));

// Enhanced validation functions
function validateResponse(response, expectedType, stepIndex) {
  if (!response || response.trim().length === 0) {
    return { isValid: false, reason: 'empty_response' };
  }

  const cleaned = response.trim().toLowerCase();
  
  // Check for gibberish first
  if (isGibberish(cleaned)) {
    return { isValid: false, reason: 'gibberish' };
  }

  // Validate based on expected response type
  switch (expectedType) {
    case 'location':
      return validateLocation(cleaned);
    case 'propertyType':
      return validatePropertyType(cleaned);
    case 'budget':
      return validateBudget(cleaned);
    case 'timeline':
      return validateTimeline(cleaned);
    default:
      return { isValid: true };
  }
}

function validateLocation(response) {
  // Check if response matches valid location patterns
  const isValid = VALIDATION_PATTERNS.location.valid.some(pattern => 
    pattern.test(response)
  );
  
  const isInvalid = VALIDATION_PATTERNS.location.invalid.some(pattern => 
    pattern.test(response)
  );

  if (isInvalid) {
    return { isValid: false, reason: 'vague_location' };
  }

  if (!isValid && response.length < 3) {
    return { isValid: false, reason: 'too_short' };
  }

  return { isValid: true };
}

function validatePropertyType(response) {
  const hasValidKeyword = VALIDATION_PATTERNS.propertyType.valid.some(pattern => 
    pattern.test(response)
  );

  if (!hasValidKeyword) {
    return { isValid: false, reason: 'unclear_property_type' };
  }

  return { isValid: true };
}

function validateBudget(response) {
  const hasValidBudget = VALIDATION_PATTERNS.budget.valid.some(pattern => 
    pattern.test(response)
  );
  
  const isBrowsing = VALIDATION_PATTERNS.budget.browsing.some(pattern => 
    pattern.test(response)
  );

  if (!hasValidBudget && !isBrowsing) {
    return { isValid: false, reason: 'unclear_budget' };
  }

  return { isValid: true, isBrowsing };
}

function validateTimeline(response) {
  const hasTimelineKeyword = Object.values(VALIDATION_PATTERNS.timeline)
    .flat()
    .some(keyword => response.includes(keyword));

  return { isValid: hasTimelineKeyword || response.length > 5 };
}

function isGibberish(message) {
  const gibberishPatterns = [
    /^[a-z]{8,}$/,           // Long strings of random letters
    /^\d{8,}$/,              // Long strings of numbers
    /^[!@#$%^&*()]+$/,       // Only special characters
    /(.)\1{4,}/,             // Repeated characters like "aaaaa"
    /^(test|dummy|fake|spam)(\s+user)?$/i,
    /^(qwerty|asdf|zxcv)/i,  // Keyboard patterns
    /^[aeiou]{5,}$/i,        // Only vowels
    /^[bcdfg]{5,}$/i         // Only consonants
  ];
  
  return gibberishPatterns.some(pattern => pattern.test(message));
}

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Enhanced WhatsApp Lead Bot API is running!',
    industry: INDUSTRY,
    questionsCount: businessConfig.questions.length
  });
});

app.post('/api/leads/create', (req, res) => {
  try {
    const { name, phone, source, message } = req.body;
    
    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    const leadId = Date.now().toString();
    const newLead = {
      id: leadId,
      name,
      phone,
      source: source || 'Unknown',
      initialMessage: message || '',
      status: 'Active',
      classification: 'Pending',
      score: 0,
      createdAt: new Date().toISOString(),
      metadata: {}
    };

    const leads = readLeads();
    leads.push(newLead);
    writeLeads(leads);

    // Initialize chat with greeting and first question
    const chats = readChats();
    const greeting = generateGreeting(newLead);
    chats[leadId] = {
      leadId,
      messages: [
        createMessage('bot', greeting),
        createMessage('bot', businessConfig.questions[0])
      ],
      currentStep: 0,
      extractedData: {},
      invalidResponseCount: 0,
      validationHistory: [],
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
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const chats = readChats();
    const chat = chats[leadId];
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Add user message
    chat.messages.push(createMessage('user', message));

    // Enhanced AI response with validation
    const aiResponse = await generateEnhancedAIResponse(chats, leadId, message);
    chat.messages.push(createMessage('bot', aiResponse.message));

    // Update chat step and validation history
    if (aiResponse.nextStep !== undefined) {
      chat.currentStep = aiResponse.nextStep;
    }

    if (aiResponse.validationResult) {
      chat.validationHistory.push({
        step: chat.currentStep,
        response: message,
        validation: aiResponse.validationResult,
        timestamp: new Date().toISOString()
      });
    }

    if (aiResponse.isComplete) {
      await enhancedClassifyLead(leadId);
    }

    writeChats(chats);
    
    res.json({ 
      success: true, 
      messages: chat.messages, 
      isComplete: aiResponse.isComplete,
      currentStep: chat.currentStep,
      validationResult: aiResponse.validationResult
    });
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Enhanced AI response generation
async function generateEnhancedAIResponse(chats, leadId, userMessage) {
  const chat = chats[leadId];
  const currentStep = chat.currentStep;
  
  // Determine expected response type based on current step
  const expectedTypes = ['location', 'propertyType', 'budget', 'timeline'];
  const expectedType = expectedTypes[currentStep] || 'general';
  
  // Validate the response
  const validationResult = validateResponse(userMessage, expectedType, currentStep);
  
  // Handle invalid responses
  if (!validationResult.isValid) {
    chat.invalidResponseCount = (chat.invalidResponseCount || 0) + 1;
    
    const clarificationMessages = {
      'gibberish': "I didn't understand that. Could you please provide a clear response?",
      'empty_response': "Please provide a response to help me assist you better.",
      'vague_location': "Could you please specify the city or area you're interested in? (e.g., Pune, Mumbai, Bangalore)",
      'unclear_property_type': "What type of property are you looking for? (Flat, Villa, Plot, or Commercial)",
      'unclear_budget': "What's your budget range? (e.g., 50L-80L, 1-2 Cr, or let me know if you're still browsing)",
      'too_short': "Could you provide more details about your requirements?"
    };
    
    const clarificationMessage = clarificationMessages[validationResult.reason] || 
      "Could you please clarify your response?";
    
    // Mark as invalid after 3 unclear responses
    if (chat.invalidResponseCount >= 3) {
      return {
        message: "I'm having trouble understanding your requirements. Our team will contact you directly to assist better. Thank you!",
        isComplete: true,
        nextStep: currentStep,
        isInvalid: true,
        validationResult
      };
    }
    
    return {
      message: clarificationMessage,
      isComplete: false,
      nextStep: currentStep, // Don't advance step for invalid responses
      validationResult
    };
  }
  
  // Reset invalid count on valid response
  chat.invalidResponseCount = 0;
  
  // Extract data from valid response
  const extractionResult = enhancedExtractData(chat, userMessage, currentStep);
  
  // Generate contextual follow-up questions
  let botMessage = '';
  let isComplete = false;
  let nextStep = currentStep + 1;
  
  switch (currentStep) {
    case 0: // After location
      botMessage = "Great! Are you looking for a flat, villa, or plot? Also, is this for investment or personal use?";
      break;
      
    case 1: // After property type and purpose
      const data = chat.extractedData;
      if (data.intent === 'buy' && data.timeline === 'urgent') {
        botMessage = "Excellent! Since you're looking to buy urgently, what's your budget range? (e.g., 50L–80L)";
      } else if (data.intent === 'investment') {
        botMessage = "Perfect for investment! What's your budget range and expected timeline?";
      } else {
        botMessage = "Got it! What's your budget range? When are you planning to make this purchase/move?";
      }
      break;
      
    case 2: // After budget
      const budgetData = chat.extractedData;
      if (validationResult.isBrowsing) {
        botMessage = "No problem! I'll share some trending properties. Are you open to a quick call to discuss options?";
      } else if (budgetData.budgetAmount >= 5000000) { // 50L+
        botMessage = "Excellent budget! Would you like to schedule a site visit this week? We have premium options ready.";
      } else if (budgetData.budgetAmount >= 2000000) { // 20L+
        botMessage = "Perfect! When would be convenient for you to visit properties? We have good options in your range.";
      } else {
        botMessage = "Thanks! Let me find suitable options. Would you prefer ready-to-move or under-construction properties?";
      }
      break;
      
    default: // Final step
      botMessage = generateCompletionMessage(chat.extractedData);
      isComplete = true;
      nextStep = businessConfig.questions.length;
  }

  return { 
    message: botMessage, 
    isComplete, 
    nextStep,
    validationResult,
    extractionResult
  };
}

// Enhanced data extraction
function enhancedExtractData(chat, response, stepIndex) {
  if (!response) return { success: false };

  const value = response.trim().toLowerCase();
  let extractedData = {};

  switch (stepIndex) {
    case 0: // Location
      chat.extractedData.location = response.trim();
      extractedData.location = response.trim();
      break;
      
    case 1: // Property type and purpose
      // Extract property type
      for (const [type, keywords] of Object.entries(VALIDATION_PATTERNS.propertyType.keywords)) {
        if (keywords.some(keyword => value.includes(keyword))) {
          chat.extractedData.propertyType = type;
          extractedData.propertyType = type;
          break;
        }
      }
      
      // Extract intent
      for (const [intent, keywords] of Object.entries(VALIDATION_PATTERNS.intent)) {
        if (keywords.some(keyword => value.includes(keyword))) {
          chat.extractedData.intent = intent;
          extractedData.intent = intent;
          break;
        }
      }
      
      // Extract timeline if mentioned
      for (const [timeline, keywords] of Object.entries(VALIDATION_PATTERNS.timeline)) {
        if (keywords.some(keyword => value.includes(keyword))) {
          chat.extractedData.timeline = timeline;
          extractedData.timeline = timeline;
          break;
        }
      }
      break;
      
    case 2: // Budget and timeline
      // Enhanced budget extraction
      if (value.includes('cr') || value.includes('crore')) {
        const match = value.match(/(\d+(?:\.\d+)?)\s*(?:cr|crore)/);
        if (match) {
          const amount = parseFloat(match[1]);
          chat.extractedData.budget = `₹${amount} crore`;
          chat.extractedData.budgetAmount = amount * 10000000;
          extractedData.budget = `₹${amount} crore`;
          extractedData.budgetAmount = amount * 10000000;
        }
      } else if (value.includes('l') || value.includes('lakh')) {
        const match = value.match(/(\d+(?:\.\d+)?)\s*(?:l|lakh)/);
        if (match) {
          const amount = parseFloat(match[1]);
          chat.extractedData.budget = `₹${amount}L`;
          chat.extractedData.budgetAmount = amount * 100000;
          extractedData.budget = `₹${amount}L`;
          extractedData.budgetAmount = amount * 100000;
        }
      } else if (/browsing|haven.*decided|not.*sure|send.*listing/.test(value)) {
        chat.extractedData.budget = 'browsing';
        chat.extractedData.intent = 'browsing';
        extractedData.budget = 'browsing';
      }
      
      // Timeline extraction
      if (!chat.extractedData.timeline) {
        for (const [timeline, keywords] of Object.entries(VALIDATION_PATTERNS.timeline)) {
          if (keywords.some(keyword => value.includes(keyword))) {
            chat.extractedData.timeline = timeline;
            extractedData.timeline = timeline;
            break;
          }
        }
      }
      break;
      
    case 3: // Engagement/Site visit
      if (/yes|sure|okay|schedule|available|interested/.test(value)) {
        chat.extractedData.engagement = 'high';
        extractedData.engagement = 'high';
      } else if (/no|not.*now|later|maybe|busy/.test(value)) {
        chat.extractedData.engagement = 'medium';
        extractedData.engagement = 'medium';
      } else {
        chat.extractedData.engagement = 'low';
        extractedData.engagement = 'low';
      }
      break;
  }

  return { success: true, extractedData };
}

// Enhanced lead classification
async function enhancedClassifyLead(leadId) {
  const leads = readLeads();
  const chats = readChats();
  const chat = chats[leadId];
  const leadIndex = leads.findIndex(l => l.id === leadId);
  
  if (leadIndex === -1 || !chat) return;

  const data = chat.extractedData;
  const validationHistory = chat.validationHistory || [];
  
  // Check for invalid lead based on validation history
  const invalidValidations = validationHistory.filter(v => !v.validation.isValid).length;
  if (invalidValidations >= 3 || chat.invalidResponseCount >= 3) {
    leads[leadIndex].classification = 'Invalid';
    leads[leadIndex].metadata = { 
      ...leads[leadIndex].metadata, 
      reason: 'Poor response quality',
      invalidValidations,
      validationHistory
    };
    leads[leadIndex].updatedAt = new Date().toISOString();
    writeLeads(leads);
    return;
  }
  
  // Enhanced scoring system
  let score = 0;
  let scoreBreakdown = {};
  
  // Intent scoring (0-4 points)
  if (data.intent === 'buy') {
    score += 4;
    scoreBreakdown.intent = 4;
  } else if (data.intent === 'investment') {
    score += 3;
    scoreBreakdown.intent = 3;
  } else if (data.intent === 'rent') {
    score += 2;
    scoreBreakdown.intent = 2;
  } else if (data.intent === 'browsing') {
    score += 0;
    scoreBreakdown.intent = 0;
  }
  
  // Budget scoring (0-4 points)
  if (data.budgetAmount) {
    if (data.budgetAmount >= 10000000) { // 1 Cr+
      score += 4;
      scoreBreakdown.budget = 4;
    } else if (data.budgetAmount >= 5000000) { // 50L+
      score += 3;
      scoreBreakdown.budget = 3;
    } else if (data.budgetAmount >= 2000000) { // 20L+
      score += 2;
      scoreBreakdown.budget = 2;
    } else {
      score += 1;
      scoreBreakdown.budget = 1;
    }
  } else if (data.budget === 'browsing') {
    score += 0;
    scoreBreakdown.budget = 0;
  }
  
  // Timeline scoring (0-3 points)
  if (data.timeline === 'urgent') {
    score += 3;
    scoreBreakdown.timeline = 3;
  } else if (data.timeline === 'soon') {
    score += 2;
    scoreBreakdown.timeline = 2;
  } else if (data.timeline === 'flexible') {
    score += 1;
    scoreBreakdown.timeline = 1;
  }
  
  // Location specificity (0-2 points)
  if (data.location && data.location.length > 10 && /nagar|area|road|sector/.test(data.location.toLowerCase())) {
    score += 2;
    scoreBreakdown.location = 2;
  } else if (data.location && data.location.length > 5) {
    score += 1;
    scoreBreakdown.location = 1;
  }
  
  // Engagement scoring (0-2 points)
  if (data.engagement === 'high') {
    score += 2;
    scoreBreakdown.engagement = 2;
  } else if (data.engagement === 'medium') {
    score += 1;
    scoreBreakdown.engagement = 1;
  }
  
  // Response quality bonus (based on validation history)
  const validResponses = validationHistory.filter(v => v.validation.isValid).length;
  const totalResponses = validationHistory.length;
  const responseQuality = totalResponses > 0 ? validResponses / totalResponses : 0;
  
  if (responseQuality >= 0.8) {
    score += 1;
    scoreBreakdown.responseQuality = 1;
  }
  
  // Determine classification based on enhanced criteria
  let classification = 'Cold';
  
  // Hot lead: Score >= 10 OR (buy intent + good budget + urgent timeline)
  if (score >= 10 || 
      (data.intent === 'buy' && data.budgetAmount >= 2000000 && 
       (data.timeline === 'urgent' || data.timeline === 'soon') && 
       data.engagement === 'high')) {
    classification = 'Hot';
  } else if (score >= 6) {
    classification = 'Warm'; // Add warm category
  }
  
  // Update lead with enhanced classification
  leads[leadIndex].classification = classification;
  leads[leadIndex].score = score;
  leads[leadIndex].metadata = { 
    ...leads[leadIndex].metadata, 
    ...data,
    scoreBreakdown,
    responseQuality: Math.round(responseQuality * 100),
    validationSummary: {
      totalResponses,
      validResponses,
      invalidResponses: totalResponses - validResponses
    }
  };
  leads[leadIndex].updatedAt = new Date().toISOString();
  
  writeLeads(leads);
  
  console.log(`Lead ${leadId} classified as ${classification} with score ${score}`);
  console.log('Score breakdown:', scoreBreakdown);
}

// Existing helper functions
function generateGreeting(lead) {
  const templates = businessConfig.greetingTemplates;
  const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
  return randomTemplate.replace('{name}', lead.name);
}

function createMessage(sender, message) {
  return { 
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9), 
    sender, 
    message, 
    timestamp: new Date().toISOString() 
  };
}

function generateCompletionMessage(extractedData) {
  const messages = [
    "Thanks for the details! Our team will analyze your requirements and get back to you shortly. 🏡✨",
    "Perfect! We have all the information we need. Expect a call from our property expert soon! 📞",
    "Thank you! We'll match the best properties according to your needs and contact you soon. 🌟"
  ];
  
  return messages[Math.floor(Math.random() * messages.length)];
}

// Additional API routes
app.get('/api/chat/:leadId', (req, res) => {
  try {
    const chats = readChats();
    const chat = chats[req.params.leadId];
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    res.json({ success: true, chat });
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/leads', (req, res) => {
  try {
    const leads = readLeads();
    res.json({ success: true, leads });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/leads/:leadId', (req, res) => {
  try {
    const leads = readLeads();
    const lead = leads.find(l => l.id === req.params.leadId);
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    res.json({ success: true, lead });
  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Enhanced Server running on port ${PORT}`);
  console.log(`📱 WhatsApp Lead Bot API ready for industry: ${INDUSTRY}`);
  console.log(`📋 Loaded ${businessConfig.questions.length} questions for lead qualification`);
  console.log(`✅ Enhanced validation and classification system activated`);
});