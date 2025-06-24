const fs = require('fs');
const path = require('path');

const CHATS_FILE = path.join(__dirname, '../data/chats.json');
const LEADS_FILE = path.join(__dirname, '../data/leads.json');

const readChats = () => JSON.parse(fs.readFileSync(CHATS_FILE, 'utf8'));
const readLeads = () => JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
const writeLeads = (data) =>
  fs.writeFileSync(LEADS_FILE, JSON.stringify(data, null, 2));

function classifyLead(leadId) {
  const chats = readChats();
  const leads = readLeads();
  const chat = chats[leadId];
  const leadIndex = leads.findIndex((l) => l.id === leadId);

  if (leadIndex === -1 || !chat) return;

  const d = chat.extractedData || {};
  let score = 0;

  if (d.budget && d.budget.match(/\d/)) score += 3;
  if (d.timeline && /(urgent|soon|month)/i.test(d.timeline)) score += 3;
  if (d.location && d.location.length > 3) score += 2;
  if (d.intent) score += 2;

  let status = 'Invalid';
  if (score >= 8) status = 'Hot';
  else if (score >= 4) status = 'Cold';

  leads[leadIndex].classification = status;
  leads[leadIndex].metadata = d;
  leads[leadIndex].score = score;

  writeLeads(leads);
}

module.exports = { classifyLead };
