const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Initialize token cache
let tokenCache = [];

app.use(cors());
app.use(express.json());

// Log server startup
console.log('Starting Express server...');

// Connect to PumpPortal WebSocket
let ws = new WebSocket('wss://pumpportal.fun/api/data');

ws.on('open', () => {
  console.log('Connected to PumpPortal WebSocket');
  ws.send(JSON.stringify({ method: 'subscribeNewToken' }));
  ws.send(JSON.stringify({ method: 'subscribeTokenTrade' }));
});

ws.on('message', (data) => {
  console.log('Received WebSocket message:', data.toString());
  try {
    const message = JSON.parse(data);
    if (message.mint && typeof message.marketCapSol === 'number') {
      const token = {
        name: message.name || 'Unknown',
        symbol: message.symbol || 'N/A',
        mintAddress: message.mint,
        marketCap: message.marketCapSol,
        volume: message.vSolInBondingCurve || 0,
        createdTimestamp: message.timestamp || Date.now()
      };
      tokenCache = [token, ...tokenCache.filter(t => t.mintAddress !== token.mintAddress)].slice(0, 10);
      console.log('Updated token cache:', JSON.stringify(tokenCache, null, 2));
    } else {
      console.log('Skipping invalid message (missing mint or marketCapSol):', message);
    }
  } catch (error) {
    console.error('Error processing WebSocket message:', error.message, 'Raw data:', data.toString());
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('WebSocket closed. Reconnecting in 5 seconds...');
  setTimeout(() => {
    const newWs = new WebSocket('wss://pumpportal.fun/api/data');
    newWs.on('open', () => {
      console.log('Reconnected to PumpPortal WebSocket');
      newWs.send(JSON.stringify({ method: 'subscribeNewToken' }));
      newWs.send(JSON.stringify({ method: 'subscribeTokenTrade' }));
    });
    newWs.on('error', (error) => {
      console.error('Reconnect WebSocket error:', error.message);
    });
    ws = newWs;
  }, 5000);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running', cacheSize: tokenCache.length });
});

// Serve cached tokens
app.get('/api/tokens', (req, res) => {
  try {
    console.log('Handling /api/tokens request. Current cache:', JSON.stringify(tokenCache, null, 2));
    res.status(200).json(tokenCache);
  } catch (error) {
    console.error('Error in /api/tokens:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.listen(port, (error) => {
  if (error) {
    console.error('Failed to start server:', error.message);
    return;
  }
  console.log(`Server running at http://localhost:${port}`);
});
