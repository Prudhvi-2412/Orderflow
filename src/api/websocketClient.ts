export class OrderFlowWebSocketClient {
  private socket: WebSocket | null = null;
  private listeners: ((event: any) => void)[] = [];

  connect(url = 'ws://localhost:4000/ws'): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return;

    try {
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        console.log('⚡ Connected to OrderFlow Backend WebSocket Stream');
      };

      this.socket.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          this.listeners.forEach((listener) => listener(data));
        } catch (e) {}
      };

      this.socket.onclose = () => {
        // Auto-reconnect after 3s
        setTimeout(() => this.connect(url), 3000);
      };
    } catch (e) {}
  }

  subscribe(listener: (event: any) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}

export const wsClient = new OrderFlowWebSocketClient();
