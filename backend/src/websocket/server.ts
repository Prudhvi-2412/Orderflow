import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

export class OrderFlowWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients = new Set<WebSocket>();

  initialize(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);
      console.log(`🔌 [WebSocket] Client connected. Total active connections: ${this.clients.size}`);

      // Send initial welcome message
      ws.send(JSON.stringify({
        type: 'CONNECTED',
        message: 'Connected to OrderFlow Real-Time Operational Telemetry Stream',
        timestamp: new Date().toISOString()
      }));

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`🔌 [WebSocket] Client disconnected. Total active connections: ${this.clients.size}`);
      });

      ws.on('error', (err: Error) => {
        console.error('❌ [WebSocket] Client Error:', err.message);
        this.clients.delete(ws);
      });
    });

    console.log('✅ WebSocket Operational Server attached to HTTP server at path /ws.');
  }

  /**
   * Broadcast Telemetry Event to all connected UI clients
   */
  broadcast(type: string, data: any): void {
    const payload = JSON.stringify({
      type,
      data,
      timestamp: new Date().toISOString()
    });

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  getConnectedCount(): number {
    return this.clients.size;
  }
}

export const wsServer = new OrderFlowWebSocketServer();
