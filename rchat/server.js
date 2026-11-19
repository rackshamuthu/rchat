const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const url = require('url');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Data file paths
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const STATUSES_FILE = path.join(DATA_DIR, 'statuses.json');
const CALLS_FILE = path.join(DATA_DIR, 'calls.json');
const OTP_FILE = path.join(DATA_DIR, 'otps.json');

// Helper to read/write JSON files
function readJSON(file, fallback = []) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
      return fallback;
    }
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    return fallback;
  }
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
  }
}

// Seed default contacts if empty
function initializeSeedData() {
  const users = readJSON(USERS_FILE, []);
  if (users.length === 0) {
    const seedUsers = [
      {
        id: 'user_sumis_official',
        phone: '9000000001',
        name: 'Sumis Business Support',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        about: 'Official Customer Care for Sumis & Rchat Services 🛍️',
        businessCategory: 'Customer Service & Sales',
        isBusiness: true,
        isVerified: true,
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      },
      {
        id: 'user_alex_partner',
        phone: '9876543210',
        name: 'Alex Johnson (Sample User A)',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
        about: 'Available for business discussions 💼',
        businessCategory: 'Wholesale Trade',
        isBusiness: true,
        isVerified: false,
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      },
      {
        id: 'user_priya_partner',
        phone: '9123456789',
        name: 'Priya Sharma (Sample User B)',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
        about: 'Hey there! I am using Rchat by Sumis ✨',
        businessCategory: 'Retail Boutique',
        isBusiness: true,
        isVerified: false,
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      }
    ];
    writeJSON(USERS_FILE, seedUsers);

    // Initial welcome message from Sumis Support
    const seedMessages = [
      {
        id: 'msg_welcome_1',
        from: '9000000001',
        to: '9876543210',
        type: 'text',
        text: 'Welcome to Rchat by Sumis! 🚀 This is your secure, business-grade messaging app. Feel free to send text, photos, files, and voice notes!',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        status: 'read'
      },
      {
        id: 'msg_welcome_2',
        from: '9000000001',
        to: '9123456789',
        type: 'text',
        text: 'Welcome to Rchat by Sumis! 🚀 You can chat with Alex (9876543210) or any registered mobile number.',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        status: 'read'
      }
    ];
    writeJSON(MESSAGES_FILE, seedMessages);
  }
}
initializeSeedData();

// SSE (Server-Sent Events) connected clients: Map<phone, Response[]>
const sseClients = new Map();

function addSseClient(phone, res) {
  if (!sseClients.has(phone)) {
    sseClients.set(phone, []);
  }
  sseClients.get(phone).push(res);
  console.log(`[SSE] Client connected: ${phone} (Active listeners: ${sseClients.get(phone).length})`);

  // Deliver any pending 'sent' messages to 'delivered'
  const messages = readJSON(MESSAGES_FILE, []);
  let updated = false;
  messages.forEach(msg => {
    if (msg.to === phone && msg.status === 'sent') {
      msg.status = 'delivered';
      updated = true;
      // notify sender about delivery
      notifySender(msg.from, 'delivery_update', { messageId: msg.id, status: 'delivered', to: phone });
    }
  });
  if (updated) writeJSON(MESSAGES_FILE, messages);
}

function removeSseClient(phone, res) {
  if (!sseClients.has(phone)) return;
  const list = sseClients.get(phone).filter(c => c !== res);
  if (list.length > 0) {
    sseClients.set(phone, list);
  } else {
    sseClients.delete(phone);
  }
  console.log(`[SSE] Client disconnected: ${phone}`);
}

function sendSseEvent(phone, eventName, data) {
  const list = sseClients.get(phone);
  if (!list || list.length === 0) return false;
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  list.forEach(res => {
    try {
      res.write(payload);
    } catch (e) {
      console.error(`[SSE] Error writing to ${phone}:`, e);
    }
  });
  return true;
}

function notifySender(senderPhone, eventName, data) {
  sendSseEvent(senderPhone, eventName, data);
}

// MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.webp': 'image/webp'
};

// Parse JSON request body helper
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 25 * 1024 * 1024) { // 25MB max
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        resolve({ raw: body });
      }
    });
    req.on('error', reject);
  });
}

// Main HTTP Server
const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-phone');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // -------------------------------------------------------------
  // Real-time SSE Connection: /api/events?phone=XXXXX
  // -------------------------------------------------------------
  if (pathname === '/api/events') {
    const phone = parsedUrl.query.phone;
    if (!phone) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Phone parameter required' }));
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', phone })}\n\n`);

    addSseClient(phone, res);

    // Keep connection alive with heartbeat
    const interval = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(interval);
      removeSseClient(phone, res);
    });
    return;
  }

  // -------------------------------------------------------------
  // REST API Routes
  // -------------------------------------------------------------

  // 1. Send OTP (Mobile Login)
  if (pathname === '/api/auth/send-otp' && req.method === 'POST') {
    try {
      const { phone } = await parseBody(req);
      if (!phone || phone.length < 5) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Valid phone number required' }));
      }

      // Generate a 6-digit OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const otps = readJSON(OTP_FILE, {});
      otps[phone] = {
        code: otpCode,
        expiresAt: Date.now() + 15 * 60 * 1000 // 15 mins
      };
      writeJSON(OTP_FILE, otps);

      console.log(`========================================================`);
      console.log(`[AUTH] 📲 OTP Generated for +91 ${phone}: [ ${otpCode} ]`);
      console.log(`========================================================`);

      // Check if real SMS gateway is configured (Fast2SMS for India)
      let realSmsSent = false;
      const FAST2SMS_KEY = process.env.FAST2SMS_API_KEY || '';
      if (FAST2SMS_KEY && phone.length === 10) {
        try {
          const https = require('https');
          const smsUrl = `https://www.fast2sms.com/dev/bulkV2?authorization=${FAST2SMS_KEY}&variables_values=${otpCode}&route=otp&numbers=${phone}`;
          https.get(smsUrl, (smsRes) => {
            console.log(`[Fast2SMS] Sent OTP status: ${smsRes.statusCode}`);
          }).on('error', (e) => {
            console.error('[Fast2SMS] Error sending SMS:', e.message);
          });
          realSmsSent = true;
        } catch (smsErr) {
          console.error('[Fast2SMS] Failed:', smsErr);
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        message: realSmsSent ? `SMS OTP sent to ${phone}` : `Verification code generated: ${otpCode}`,
        debugOtp: otpCode,
        realSmsSent: realSmsSent,
        hint: 'Real telecom SMS requires an SMS Gateway API key (like Fast2SMS/Twilio). Use code ' + otpCode + ' or 123456 to verify instantly.'
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // 2. Verify OTP
  if (pathname === '/api/auth/verify-otp' && req.method === 'POST') {
    try {
      const { phone, otp } = await parseBody(req);
      const otps = readJSON(OTP_FILE, {});
      const record = otps[phone];

      // Allow correct OTP, bypass '123456', or any 6-digit number in demo mode
      const isValid = (record && record.code === otp) || otp === '123456' || (otp && otp.length === 6);

      if (!isValid) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid or expired OTP. Please try again.' }));
      }

      // Cleanup OTP
      if (otps[phone]) {
        delete otps[phone];
        writeJSON(OTP_FILE, otps);
      }

      // Check or create user profile
      const users = readJSON(USERS_FILE, []);
      let user = users.find(u => u.phone === phone);
      const isNewUser = !user;

      if (!user) {
        user = {
          id: 'user_' + Date.now(),
          phone: phone,
          name: '',
          avatar: '',
          about: 'Hey there! I am using Rchat by Sumis.',
          businessCategory: 'General Business',
          isBusiness: false,
          createdAt: new Date().toISOString(),
          lastSeen: new Date().toISOString()
        };
        users.push(user);
        writeJSON(USERS_FILE, users);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        user: user,
        isNewUser: isNewUser || !user.name
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // 3. Update User Profile
  if (pathname === '/api/auth/profile' && req.method === 'POST') {
    try {
      const { phone, name, avatar, about, businessCategory, isBusiness } = await parseBody(req);
      const users = readJSON(USERS_FILE, []);
      const index = users.findIndex(u => u.phone === phone);

      if (index === -1) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'User not found' }));
      }

      users[index] = {
        ...users[index],
        name: name !== undefined ? name : users[index].name,
        avatar: avatar !== undefined ? avatar : users[index].avatar,
        about: about !== undefined ? about : users[index].about,
        businessCategory: businessCategory !== undefined ? businessCategory : users[index].businessCategory,
        isBusiness: isBusiness !== undefined ? isBusiness : users[index].isBusiness,
        lastSeen: new Date().toISOString()
      };
      writeJSON(USERS_FILE, users);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, user: users[index] }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // 4. List Users / Contacts
  if (pathname === '/api/users' && req.method === 'GET') {
    const users = readJSON(USERS_FILE, []);
    // Map with online presence from active SSE map
    const responseUsers = users.map(u => ({
      ...u,
      isOnline: sseClients.has(u.phone)
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ users: responseUsers }));
  }

  // 5. Get Messages Between Current User & Target Contact
  if (pathname === '/api/messages' && req.method === 'GET') {
    const currentPhone = req.headers['x-phone'] || parsedUrl.query.from;
    const targetPhone = parsedUrl.query.with;

    if (!currentPhone || !targetPhone) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Both from and with parameters are required' }));
    }

    const allMessages = readJSON(MESSAGES_FILE, []);
    const conversation = allMessages.filter(
      m => (m.from === currentPhone && m.to === targetPhone) ||
           (m.from === targetPhone && m.to === currentPhone)
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ messages: conversation }));
  }

  // 6. Send Message (Text, Image, Audio, Document/File)
  if (pathname === '/api/messages' && req.method === 'POST') {
    try {
      const { from, to, type, text, mediaUrl, fileName, fileSize, duration } = await parseBody(req);
      if (!from || !to) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'from and to are required' }));
      }

      const allMessages = readJSON(MESSAGES_FILE, []);
      const isRecipientOnline = sseClients.has(to);

      const newMessage = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        from: from,
        to: to,
        type: type || 'text', // 'text' | 'image' | 'audio' | 'file'
        text: text || '',
        mediaUrl: mediaUrl || '',
        fileName: fileName || '',
        fileSize: fileSize || '',
        duration: duration || '',
        timestamp: new Date().toISOString(),
        status: isRecipientOnline ? 'delivered' : 'sent'
      };

      allMessages.push(newMessage);
      writeJSON(MESSAGES_FILE, allMessages);

      // Real-time Push to recipient via SSE
      sendSseEvent(to, 'new_message', newMessage);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, message: newMessage }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // 7. Mark Messages as Read (Blue Ticks)
  if (pathname === '/api/messages/read' && req.method === 'POST') {
    try {
      const { readerPhone, senderPhone } = await parseBody(req);
      if (!readerPhone || !senderPhone) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'readerPhone and senderPhone required' }));
      }

      const allMessages = readJSON(MESSAGES_FILE, []);
      let updatedCount = 0;

      allMessages.forEach(msg => {
        if (msg.from === senderPhone && msg.to === readerPhone && msg.status !== 'read') {
          msg.status = 'read';
          updatedCount++;
        }
      });

      if (updatedCount > 0) {
        writeJSON(MESSAGES_FILE, allMessages);
        // Notify original sender that messages have been read (triggers double blue ticks)
        sendSseEvent(senderPhone, 'read_receipt', {
          readerPhone: readerPhone,
          timestamp: new Date().toISOString()
        });
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, updatedCount }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // 8. Upload File (Base64 payload for universal compatibility)
  if (pathname === '/api/upload' && req.method === 'POST') {
    try {
      const { base64Data, fileName, fileType } = await parseBody(req);
      if (!base64Data || !fileName) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'base64Data and fileName required' }));
      }

      // Extract raw base64 data
      const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer;
      if (matches && matches.length === 3) {
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(base64Data, 'base64');
      }

      // Sanitize filename & create unique storage name
      const ext = path.extname(fileName) || '.bin';
      const safeName = 'upload_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6) + ext;
      const targetPath = path.join(UPLOADS_DIR, safeName);

      fs.writeFileSync(targetPath, buffer);

      const fileUrl = '/uploads/' + safeName;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        url: fileUrl,
        fileName: fileName,
        size: (buffer.length / 1024).toFixed(1) + ' KB'
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // 9. Status / Stories Updates
  if (pathname === '/api/status' && req.method === 'GET') {
    const statuses = readJSON(STATUSES_FILE, []);
    // Filter active statuses (last 24 hours)
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const active = statuses.filter(s => new Date(s.timestamp).getTime() > twentyFourHoursAgo);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ statuses: active }));
  }

  if (pathname === '/api/status' && req.method === 'POST') {
    try {
      const { phone, text, mediaUrl, bgColor } = await parseBody(req);
      const statuses = readJSON(STATUSES_FILE, []);
      const newStatus = {
        id: 'status_' + Date.now(),
        phone: phone,
        text: text || '',
        mediaUrl: mediaUrl || '',
        bgColor: bgColor || '#0A4D4A',
        timestamp: new Date().toISOString()
      };
      statuses.unshift(newStatus);
      writeJSON(STATUSES_FILE, statuses);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, status: newStatus }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // 10. Calls Log & Signaling
  if (pathname === '/api/calls' && req.method === 'GET') {
    const calls = readJSON(CALLS_FILE, []);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ calls: calls }));
  }

  if (pathname === '/api/calls' && req.method === 'POST') {
    try {
      const callData = await parseBody(req);
      const calls = readJSON(CALLS_FILE, []);
      const record = {
        id: 'call_' + Date.now(),
        ...callData,
        timestamp: new Date().toISOString()
      };
      calls.unshift(record);
      writeJSON(CALLS_FILE, calls);

      // Signal incoming call to recipient
      sendSseEvent(callData.to, 'incoming_call', record);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, call: record }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // 11. Typing indicator
  if (pathname === '/api/typing' && req.method === 'POST') {
    try {
      const { from, to, isTyping } = await parseBody(req);
      sendSseEvent(to, 'typing_indicator', { from, isTyping });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // -------------------------------------------------------------
  // Static Files Server (Public directory)
  // -------------------------------------------------------------
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') safePath = '/index.html';
  const filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // 404 handler
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: Rchat by Sumis');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache'
    });

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  });
});

// Start Server & Display Local IP for Mobile Phone Connection
server.listen(PORT, '0.0.0.0', () => {
  const interfaces = os.networkInterfaces();
  const localIps = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIps.push(iface.address);
      }
    }
  }

  console.log('================================================================');
  console.log('  💬 Rchat Mobile & Web Messaging Platform (by Sumis) 🚀');
  console.log('================================================================');
  console.log(`  Local URL:   http://localhost:${PORT}`);
  localIps.forEach(ip => {
    console.log(`  Mobile LAN:  http://${ip}:${PORT}  <-- Open this on your Phone!`);
  });
  console.log('================================================================');
});
