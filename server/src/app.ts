import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { setupRoutes } from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    name: 'Touchline API',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// Setup all routes
setupRoutes(app);

// Global error handler - MUST be after all routes but before static serving
app.use(errorHandler);

// Serve the built frontend (production mode)
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));

// All non-API routes serve the frontend (SPA routing)
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Start server
app.listen(Number(PORT), HOST, () => {
  console.log(`\n⚽ Touchline is running!`);
  console.log(`\n   Open in your browser: http://localhost:${PORT}\n`);
});

export default app;
