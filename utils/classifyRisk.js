// classifyRisk.js
// Improved heuristic-based risk scoring for .onion pages with context awareness

const HIGH_RISK_KEYWORDS = [
  'drugs', 'hack', 'exploit', 'carding', 'malware', 'ransom', 'porn', 'counterfeit', 'weapon', 'kill', 'murder', 'hitman', 'child', 'exploit', 'illegal', 'stolen', 'credit card', 'bank', 'scam', 'phishing', 'fraud', 'bitcoin', 'crypto', 'forged', 'passport', 'ssn', 'id', 'dox', 'leak', 'dump', 'zero day', 'botnet', 'rootkit', 'keylogger', 'rat', 'exploit', 'shell', 'backdoor', 'terror', 'bomb', 'assassinate'
];
const MEDIUM_RISK_KEYWORDS = [
  'forum', 'market', 'shop', 'exchange', 'vpn', 'proxy', 'privacy', 'anonymity', 'escrow', 'wallet', 'mix', 'launder', 'casino', 'bet', 'gamble', 'adult', 'escort', 'dating', 'pharma', 'pill', 'gun', 'firearm', 'ammo', 'counterfeit', 'piracy', 'torrent', 'crack', 'serial', 'keygen', 'license', 'dump', 'database', 'breach', 'leak', 'dump', 'card', 'bank', 'account', 'money', 'bitcoin', 'crypto', 'wallet', 'exchange'
];
const SAFE_CONTEXT_KEYWORDS = [
  'conference', 'university', 'college', 'engineering', 'debian', 'event', 'workshop', 'talk', 'foundation', 'project', 'open source', 'free software', 'linux', 'gnu', 'registration', 'participant', 'schedule', 'contact', 'blog', 'wiki', 'venue', 'about', 'support', 'volunteer'
];

function classifyRisk({ title = '', content = '', metadata = {} }) {
  const text = `${title} ${content} ${JSON.stringify(metadata)}`.toLowerCase();
  const matchedHigh = HIGH_RISK_KEYWORDS.filter(kw => text.includes(kw));
  const matchedMedium = MEDIUM_RISK_KEYWORDS.filter(kw => text.includes(kw));
  const matchedSafe = SAFE_CONTEXT_KEYWORDS.filter(kw => text.includes(kw));

  // Logging for debugging
  if (matchedHigh.length > 0 || matchedMedium.length > 0) {
    console.log('[RISK DEBUG] Matched high:', matchedHigh, 'medium:', matchedMedium, 'safe:', matchedSafe);
  }

  // High risk: 2+ high-risk keywords, or 1 high + 1 medium
  if (matchedHigh.length >= 2 || (matchedHigh.length === 1 && matchedMedium.length >= 1)) {
    // If safe context, downgrade unless 3+ high-risk
    if (matchedSafe.length > 0 && matchedHigh.length < 3) {
      return 'medium';
    }
    return 'high';
  }
  // Medium risk: 1 high-risk, or 2+ medium-risk
  if (matchedHigh.length === 1 || matchedMedium.length >= 2) {
    return 'medium';
  }
  // Low risk otherwise
  return 'low';
}

module.exports = { classifyRisk };
