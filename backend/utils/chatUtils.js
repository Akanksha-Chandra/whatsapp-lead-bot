const fs = require('fs');
const path = require('path');

const CHATS_FILE = path.join(__dirname, '../data/chats.json');

const readChats = () => {
  try {
    return JSON.parse(fs.readFileSync(CHATS_FILE, 'utf8'));
  } catch {
    return {};
  }
};

const writeChats = (chats) => {
  fs.writeFileSync(CHATS_FILE, JSON.stringify(chats, null, 2));
};

const addMessageToChat = (leadId, sender, message) => {
  const chats = readChats();
  if (!chats[leadId]) {
    chats[leadId] = { messages: [] };
  }

  chats[leadId].messages.push({
    id: Date.now().toString(),
    sender,
    message,
    timestamp: new Date().toISOString()
  });

  writeChats(chats);
};

const generateGreeting = (lead, templates = null) => {
  const defaultGreetings = [
    `Hi ${lead.name}! Thanks for reaching out to GrowEasy Realtors.`,
    `Hello ${lead.name}! I'm here to help you with your property needs.`
  ];
  const greetings = templates || defaultGreetings;
  const template = greetings[Math.floor(Math.random() * greetings.length)];
  return template.replace('{name}', lead.name);
};

module.exports = {
  readChats,
  writeChats,
  addMessageToChat,
  generateGreeting
};
