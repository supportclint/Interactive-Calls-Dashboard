const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- DATABASE HANDLING ---
// Define data directory
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper to read DB
const readDb = () => {
  if (fs.existsSync(DB_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
      console.error("DB Read Error:", e);
      return {};
    }
  }
  return {}; // Default empty DB
};

// --- API ROUTES (Prefixed with /api) ---

// GET /api/db - Retrieve all data
app.get('/api/db', (req, res) => {
  try {
    const data = readDb();
    res.json(data);
  } catch (error) {
    console.error("Read Error:", error);
    res.status(500).json({ error: "Failed to read database" });
  }
});

// POST /api/db - Save all data
app.post('/api/db', (req, res) => {
  try {
    const newData = req.body;
    fs.writeFileSync(DB_FILE, JSON.stringify(newData, null, 2));
    res.json({ status: "success" });
  } catch (error) {
    console.error("Save Error:", error);
    res.status(500).json({ error: "Failed to save database" });
  }
});

// GET /api/vapi - Proxy Vapi requests
app.get('/api/vapi', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }

    // Forward the query string (limit=50, etc)
    const queryString = new URLSearchParams(req.query).toString();
    const url = `https://api.vapi.ai/call?${queryString}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Vapi Proxy Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/create-payment - Placeholder for Stripe integration
app.post('/api/create-payment', async (req, res) => {
  // In a real implementation, you would use the Stripe SDK here
  // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  console.log("Payment request received:", req.body);
  
  // Mock response for now
  res.json({ 
    url: "#", 
    error: "Stripe backend not fully configured. This is a placeholder response." 
  });
});

// --- SERVE FRONTEND (For Render Production) ---
// Serve static files from the 'dist' directory (Frontend build)
// We go up one level from 'backend' to find 'dist'
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  // Catch-all handler: Send index.html for any other route (React Router support)
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});