import React, { useState, useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import { globalPaymentService, ChaosConfig } from '../services/PaymentService.js';
import { globalEventBus, DLQItem } from '../core/EventBus.js';
import { CircuitBreakerState } from '../core/CircuitBreaker.js';
import { HeaderBanner } from './Common/HeaderBanner.js';
import { CircuitBreakerHud } from './Resilience/CircuitBreakerHud.js';
import { ChaosControlPanel } from './Resilience/ChaosControlPanel.js';
import { DeadLetterQueueManager } from './Resilience/DeadLetterQueueManager.js';

export function ResiliencePanel() {
  const [cbState, setCbState] = useState(globalPaymentService.circuitBreaker.getState());
  const [cbHistory, setCbHistory] = useState(globalPaymentService.circuitBreaker.history);

  const [chaos, setChaos] = useState<ChaosConfig>(globalPaymentService.chaos);
  const [dlqItems, setDlqItems] = useState<DLQItem[]>(globalEventBus.getDLQ());

  useEffect(() => {
    const interval = setInterval(() => {
      setCbState(globalPaymentService.circuitBreaker.getState());
      setCbHistory([...globalPaymentService.circuitBreaker.history]);
      setDlqItems([...globalEventBus.getDLQ()]);
    }, 500);

    const unsubCB = globalPaymentService.circuitBreaker.onStateChange(() => {
      setCbState(globalPaymentService.circuitBreaker.getState());
    });

    const unsubEB = globalEventBus.onEvent(() => {
      setDlqItems([...globalEventBus.getDLQ()]);
    });

    return () => {
      clearInterval(interval);
      unsubCB();
      unsubEB();
    };
  }, []);

  const handleChaosChange = (key: keyof ChaosConfig, value: any) => {
    const updated = { ...chaos, [key]: value };
    setChaos(updated);
    globalPaymentService.setChaosConfig(updated);
  };

  const handleForceCBState = (state: CircuitBreakerState) => {
    globalPaymentService.circuitBreaker.forceState(state);
    setCbState(globalPaymentService.circuitBreaker.getState());
  };

  const handleRedriveDLQ = async (eventId: string) => {
    await globalEventBus.redriveDLQItem(eventId);
    setDlqItems([...globalEventBus.getDLQ()]);
  };

  const handlePurgeDLQ = () => {
    globalEventBus.purgeDLQ();
    setDlqItems([]);
  };

  return (
    <div className="space-y-6">
      <HeaderBanner
        icon={ShieldAlert}
        tag="Resilience & Chaos Engineering"
        title="Circuit Breakers, Fault Injection & Dead Letter Queues"
        description="Simulate third-party dependency outages, test automatic Circuit Breaker state transitions, and inspect unrecoverable messages routed to the Dead Letter Queue (DLQ) for manual re-drive."
        color="rose"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <CircuitBreakerHud cbState={cbState} cbHistory={cbHistory} onForceState={handleForceCBState} />

        <ChaosControlPanel chaos={chaos} onChaosChange={handleChaosChange} />
      </div>

      <DeadLetterQueueManager
        dlqItems={dlqItems}
        maxRetries={globalEventBus.maxRetries}
        onRedrive={handleRedriveDLQ}
        onPurge={handlePurgeDLQ}
      />
    </div>
  );
}

export default ResiliencePanel;
