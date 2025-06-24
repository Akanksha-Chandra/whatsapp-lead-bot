
🏠 GrowEasy Lead Bot
An AI-powered WhatsApp-style lead qualification bot tailored for real estate businesses, with pluggable support for other industries. This bot simulates natural chat, intelligently qualifies leads, extracts relevant metadata, and classifies them as Hot, Cold, or Invalid.

🚀 Features

🤖 Intelligent Lead Qualification — Automated conversations using LLM
📊 Enhanced Scoring System — Weighted scoring & classification
💬 Modern Chat Interface — React-based real-time UI
🔍 Smart Validation — Detects invalid/gibberish responses
📈 Metadata Extraction — Auto-parses budget, location, intent, etc.
🏡 Real Estate Focused — Built for property use case; easily extendable
🔧 Configurable — Define industries/questions via JSON
📁 CSV Export — Export leads & metadata
🧠 Bonus — Empathetic responses, fallbacks for low engagement



🧩 Tech Stack
Frontend: React + Lucide + Axios
Backend: Node.js + Express
NLP: Groq API
Storage: File-based (JSON for leads & chats)



📁 Project Structure
groweasy-lead-bot/
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── config/
│   │   └── businessProfiles.json      # Industry configs
│   └── data/
│       ├── leads.json                 # Classified leads
│       └── chats.json                 # Chat logs
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── ChatInterface.js
│   │   │   └── LeadForm.js
│   │   │   └── Dashboard.js
│   │   └── ...their css files
│   └── package.json
├── .env
└── README.md


🔧 Installation
Backend Setup
cd backend
npm install
cp .env.example .env

Sample .env:
PORT=5000
INDUSTRY=realEstate
GROQ_API_KEY=your_groq_api_key

Start backend:
# Development
npm run dev

# Production
npm start


Frontend Setup
cd frontend
npm install
npm start

Visit: http://localhost:3000

🔌 API Endpoints

🔹 Lead APIs
POST /api/leads/create — Create a new lead
GET /api/leads — Fetch all leads
GET /api/leads/:leadId — Get a specific lead


🔹 Chat APIs
GET /api/chat/:leadId — Fetch chat history
POST /api/chat/:leadId/message — Send message to the bot


🔹 Debug
GET /api/debug/chat/:leadId — View raw chat debug



🧪 Testing

✅ Create Lead
Use the homepage form:
Name: Anjali Mehra
Phone: +91 9876543210
Source: Website
Message: Looking for a villa in Goa

🤖 Conversation Flow
The bot will ask:
“Which city or location are you looking for? 📍”

“Are you looking to buy or rent a property? 🏠”

“What type of property interests you? 🏢”

“What's your budget range? 💰”

“When are you planning to make this purchase/move? ⏰”

“Is this for personal use or investment? 📈”


🎯 Classification Criteria
Lead is scored based on:
Parameter
Max Points
Budget
3
Timeline
3
Location
2
Intent
2
Engagement/Quality
+1 bonus

Final Score →
Hot: ≥ 8
Cold: ≥ 4
Invalid: < 4 or bad data



📄 Config Format (/config/businessProfiles.json)
{
  "realEstate": {
    "greetingTemplates": [
      "Hi {name}! Welcome to GrowEasy Realtors. Let's get started. 🏡",
      "Hello {name}! I’m your real estate assistant. How can I help? 🌟"
    ],
    "questions": [
      "Which city or location are you looking for? 📍",
      "Are you looking to buy or rent a property? 🏠",
      "What type of property interests you? (Flat, Villa, Plot, Commercial) 🏢",
      "What's your budget range? 💰",
      "When are you planning to make this purchase/move? ⏰",
      "Is this for personal use or investment? 📈"
    ],
    "scoreWeights": {
      "budget": 3,
      "timeline": 3,
      "location": 2,
      "intent": 2
    },
    "scoreThresholds": {
      "hot": 8,
      "cold": 4
    }
  }
}

You can plug in other industries like automotive, finance, etc., using the same structure.

📦 Sample Output (leads.json)
[
  {
    "id": "1750704195103",
    "name": "Anjali Mehra",
    "phone": "+91 9876543210",
    "source": "Website",
    "initialMessage": "Looking for a villa in Goa",
    "classification": "Hot",
    "metadata": {
      "location": "Goa",
      "intent": "buy",
      "propertyType": "Villa",
      "budget": "1 Cr",
      "timeline": "2 months"
    },
    "score": 10
  }
]


🎥 Demo Video
demo.mp4 — walkthrough of:
Lead creation
Chat flow
Classification & scoring
Dashboard filtering

Link - https://drive.google.com/file/d/1SqdfW8UUQys9tY8Yi2CctFZv6qAMjUE_/view?usp=sharing


🌟 Bonus Features
💬 Smart fallback messages for low-engagement leads
🧠 Empathetic language from bot
🔌 Industry-agnostic plugin support
🚀 Deployable React + Express setup

📌 Future Scope
Add MongoDB/Postgres database support
Deploy via Render / Netlify
Add analytics dashboard
Integrate with WhatsApp Business API
