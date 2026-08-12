import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { apiRouter } from './api/gateway.js';
import { wsServer } from './websocket/server.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api', apiRouter);

const httpServer = http.createServer(app);
wsServer.initialize(httpServer);

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    console.log(`🚀 OrderFlow API Gateway & WebSocket Server listening on port ${PORT}`);
  });
}

export default app;
