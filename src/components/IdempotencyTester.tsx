import React, { useState, useEffect } from 'react';
import { Repeat } from 'lucide-react';
import { globalIdempotencyManager } from '../core/IdempotencyManager.js';
import { globalChaosEngine } from '../simulator/ChaosEngine.js';
import { HeaderBanner } from './Common/HeaderBanner.js';
import { IdempotencyPlayground } from './Idempotency/IdempotencyPlayground.js';
import { IdempotencyStatsGrid } from './Idempotency/IdempotencyStatsGrid.js';
import { DeduplicationTestOutput } from './Idempotency/DeduplicationTestOutput.js';
import { IdempotencyLogLedger } from './Idempotency/IdempotencyLogLedger.js';

export function IdempotencyTester() {
  const [idempotencyKey, setIdempotencyKey] = useState(`idemp_key_${Math.floor(100000 + Math.random() * 900000)}`);
  const [sku, setSku] = useState('ITEM-GPU-4090');
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(1599);

  const [stats, setStats] = useState(globalIdempotencyManager.getStats());
  const [history, setHistory] = useState(globalIdempotencyManager.getHistory());
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<any>(null);

  useEffect(() => {
    const unsub = globalIdempotencyManager.onIdempotencyEvent(() => {
      setStats(globalIdempotencyManager.getStats());
      setHistory(globalIdempotencyManager.getHistory());
    });
    return () => unsub();
  }, []);

  const handleGenerateKey = () => {
    setIdempotencyKey(`idemp_key_${Math.floor(100000 + Math.random() * 900000)}`);
    setLastTestResult(null);
  };

  const handleRun5xDuplicates = async () => {
    setIsExecuting(true);
    setLastTestResult(null);

    const result = await globalChaosEngine.runIdempotencyTest(5);
    setLastTestResult(result);
    setIsExecuting(false);
  };

  const handleClearIdempotencyStore = () => {
    globalIdempotencyManager.clear();
    setStats(globalIdempotencyManager.getStats());
    setHistory(globalIdempotencyManager.getHistory());
    setLastTestResult(null);
  };

  return (
    <div className="space-y-6">
      <HeaderBanner
        icon={Repeat}
        tag="Request Deduplication Engine"
        title="Idempotency & Double-Submit Prevention Lab"
        description="Distributed networks inevitably encounter duplicate requests caused by client retries, payment gateway webhooks, or network lag. OrderFlow utilizes strict Idempotency-Key headers and payload hash validation to guarantee exactly-once payment processing."
        color="purple"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <IdempotencyPlayground
          idempotencyKey={idempotencyKey}
          setIdempotencyKey={setIdempotencyKey}
          sku={sku}
          setSku={setSku}
          quantity={quantity}
          setQuantity={setQuantity}
          price={price}
          setPrice={setPrice}
          isExecuting={isExecuting}
          onGenerateKey={handleGenerateKey}
          onRun5x={handleRun5xDuplicates}
          onClearStore={handleClearIdempotencyStore}
        />

        <div className="lg:col-span-7 space-y-6">
          <IdempotencyStatsGrid stats={stats} />
          <DeduplicationTestOutput lastTestResult={lastTestResult} />
          <IdempotencyLogLedger history={history} />
        </div>
      </div>
    </div>
  );
}

export default IdempotencyTester;
