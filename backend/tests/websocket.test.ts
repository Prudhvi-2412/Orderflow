import { wsServer } from '../src/websocket/server.js';

describe('WebSocket Real-Time Operational Stream Tests', () => {

  it('should maintain client registry and broadcast telemetry events without throwing', () => {
    expect(wsServer.getConnectedCount()).toBe(0);

    // Broadcast test event
    wsServer.broadcast('TEST_EVENT', { orderId: 'ORD-100', status: 'COMPLETED' });

    expect(wsServer).toBeDefined();
  });

});
