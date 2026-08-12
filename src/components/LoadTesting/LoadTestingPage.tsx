import React, { useState } from 'react';
import {
  Flame,
  Play,
  Square,
  RotateCcw,
  TrendingUp,
  Clock,
  Radio,
  CheckCircle2,
  Users,
  Activity,
  Layers,
  ArrowRight,
  X,
  Zap,
  BarChart2
} from 'lucide-react';
import { HeaderBanner } from '../Common/HeaderBanner.js';

export interface LoadTestRun {
  id: string;
  date: string;
  virtualUsers: number;
  durationSec: number;
  endpoint: string;
  totalRequests: number;
  throughputRps: number;
  successRate: number;
  errorRate: number;
  p50: number;
  p95: number;
  p99: number;
  status: 'COMPLETED' | 'RUNNING' | 'ABORTED';
}

export function LoadTestingPage() {
  // Configuration State
  const [virtualUsers, setVirtualUsers] = useState(100);
  const [durationSec, setDurationSec] = useState(60);
  const [rampUpSec, setRampUpSec] = useState(10);
  const [targetEndpoint, setTargetEndpoint] = useState('/api/orders');
  const [targetRps, setTargetRps] = useState(1000);

  // Execution State
  const [isRunning, setIsRunning] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentResults, setCurrentResults] = useState<LoadTestRun | null>({
    id: 'LT-20260813-001',
    date: new Date().toLocaleTimeString(),
    virtualUsers: 100,
    durationSec: 60,
    endpoint: '/api/orders',
    totalRequests: 52421,
    throughputRps: 873,
    successRate: 99.7,
    errorRate: 0.3,
    p50: 18,
    p95: 84,
    p99: 142,
    status: 'COMPLETED'
  });

  const [selectedHistoryRun, setSelectedHistoryRun] = useState<LoadTestRun | null>(null);

  // Test History List
  const [history, setHistory] = useState<LoadTestRun[]>([
    {
      id: 'LT-20260813-001',
      date: '10:42:15 AM',
      virtualUsers: 100,
      durationSec: 60,
      endpoint: '/api/orders',
      totalRequests: 52421,
      throughputRps: 873,
      successRate: 99.7,
      errorRate: 0.3,
      p50: 18,
      p95: 84,
      p99: 142,
      status: 'COMPLETED'
    },
    {
      id: 'LT-20260813-002',
      date: '10:15:30 AM',
      virtualUsers: 50,
      durationSec: 30,
      endpoint: '/api/payments',
      totalRequests: 24100,
      throughputRps: 803,
      successRate: 99.9,
      errorRate: 0.1,
      p50: 12,
      p95: 45,
      p99: 88,
      status: 'COMPLETED'
    },
    {
      id: 'LT-20260812-005',
      date: 'Yesterday, 04:12 PM',
      virtualUsers: 250,
      durationSec: 120,
      endpoint: '/api/orders',
      totalRequests: 114500,
      throughputRps: 954,
      successRate: 98.4,
      errorRate: 1.6,
      p50: 24,
      p95: 112,
      p99: 210,
      status: 'COMPLETED'
    }
  ]);

  const handleRunLoadTest = () => {
    setIsRunning(true);
    setProgressPercent(0);

    let current = 0;
    const interval = setInterval(() => {
      current += 10;
      setProgressPercent(current);

      if (current >= 100) {
        clearInterval(interval);
        setIsRunning(false);

        const newRun: LoadTestRun = {
          id: `LT-${Date.now().toString().slice(-6)}`,
          date: new Date().toLocaleTimeString(),
          virtualUsers,
          durationSec,
          endpoint: targetEndpoint,
          totalRequests: Math.round(virtualUsers * durationSec * (8.5 + Math.random() * 2)),
          throughputRps: Math.round(virtualUsers * (8.5 + Math.random() * 2)),
          successRate: Number((99.2 + Math.random() * 0.7).toFixed(1)),
          errorRate: Number((0.1 + Math.random() * 0.7).toFixed(1)),
          p50: Math.round(15 + Math.random() * 8),
          p95: Math.round(75 + Math.random() * 25),
          p99: Math.round(130 + Math.random() * 30),
          status: 'COMPLETED'
        };

        setCurrentResults(newRun);
        setHistory((prev) => [newRun, ...prev]);
      }
    }, 300);
  };

  const handleStopTest = () => {
    setIsRunning(false);
    setProgressPercent(0);
  };

  const handleResetConfig = () => {
    setVirtualUsers(100);
    setDurationSec(60);
    setRampUpSec(10);
    setTargetEndpoint('/api/orders');
    setTargetRps(1000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <HeaderBanner
        icon={Flame}
        tag="Distributed Capacity & Throughput Profiler"
        title="Load Testing & Performance Benchmarks"
        description="Configure virtual users, simulate continuous request rates, measure system throughput (RPS), inspect P50/P95/P99 latencies, and profile API endpoint limits under heavy load."
        color="rose"
      />

      {/* Mode Badge & Note */}
      <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-blue-900">
        <div className="flex items-center space-x-2.5">
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-600 text-white shadow-xs">
            SIMULATION
          </span>
          <span>
            Load test executed via simulated virtual user threads. Full production k6 load test script is available at{' '}
            <code className="font-mono font-bold text-blue-800">k6/flash_sale_load_test.ts</code>.
          </span>
        </div>
      </div>

      {/* Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Load Test Configuration Card */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center justify-between">
            <span>Load Test Configuration</span>
            <span className="text-xs font-mono text-slate-500 font-normal">HTTP / REST</span>
          </h3>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Virtual Users (VUs):</span>
                <span className="font-mono text-blue-700 font-bold">{virtualUsers} VUs</span>
              </div>
              <input
                type="range"
                min="10"
                max="500"
                step="10"
                value={virtualUsers}
                onChange={(e) => setVirtualUsers(Number(e.target.value))}
                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Test Duration (s)</label>
                <input
                  type="number"
                  min="10"
                  max="600"
                  value={durationSec}
                  onChange={(e) => setDurationSec(Number(e.target.value))}
                  className="w-full input-enterprise px-3 py-2 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ramp-up (s)</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={rampUpSec}
                  onChange={(e) => setRampUpSec(Number(e.target.value))}
                  className="w-full input-enterprise px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Endpoint</label>
              <select
                value={targetEndpoint}
                onChange={(e) => setTargetEndpoint(e.target.value)}
                className="w-full input-enterprise px-3 py-2 text-xs font-mono text-blue-700 font-bold bg-white"
              >
                <option value="/api/orders">POST /api/orders (Saga Order Submission)</option>
                <option value="/api/orders/list">GET /api/orders (Order History List)</option>
                <option value="/api/inventory/sku">GET /api/inventory/:sku (Stock Query)</option>
                <option value="/api/payments">POST /api/payments (Payment Processing)</option>
                <option value="/api/auth/login">POST /api/auth/login (Auth Benchmark)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Request Rate (RPS limit)</label>
              <input
                type="number"
                min="100"
                max="5000"
                step="100"
                value={targetRps}
                onChange={(e) => setTargetRps(Number(e.target.value))}
                className="w-full input-enterprise px-3 py-2 text-xs font-mono"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
            <button
              onClick={handleResetConfig}
              className="px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>

            {isRunning ? (
              <button
                onClick={handleStopTest}
                className="flex-1 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-sm transition"
              >
                <Square className="h-4 w-4" />
                <span>Stop Test</span>
              </button>
            ) : (
              <button
                onClick={handleRunLoadTest}
                className="flex-1 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-sm transition"
              >
                <Play className="h-4 w-4 fill-white" />
                <span>Run Load Test</span>
              </button>
            )}
          </div>
        </div>

        {/* Load Test KPI Cards & Live Simulation Feedback */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between shadow-xs">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>Load Test Execution Metrics</span>
              {currentResults && (
                <span className="text-xs font-mono text-slate-500">ID: {currentResults.id}</span>
              )}
            </h3>

            {isRunning && (
              <div className="space-y-2 mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl">
                <div className="flex justify-between text-xs font-mono text-rose-900 font-bold">
                  <span>Executing Load Test Simulation...</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="h-3 w-full bg-rose-100 rounded-full overflow-hidden border border-rose-200">
                  <div
                    className="h-full bg-rose-600 transition-all duration-150"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
              </div>
            )}

            {currentResults ? (
              <div className="space-y-5">
                {/* 7 KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 text-[10px] font-mono block">TOTAL REQUESTS</span>
                    <div className="text-xl font-extrabold font-mono text-slate-900 mt-1">
                      {currentResults.totalRequests.toLocaleString()}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 text-[10px] font-mono block">THROUGHPUT</span>
                    <div className="text-xl font-extrabold font-mono text-blue-700 mt-1">
                      {currentResults.throughputRps} <span className="text-xs font-normal text-slate-500">req/s</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 text-[10px] font-mono block">SUCCESS RATE</span>
                    <div className="text-xl font-extrabold font-mono text-emerald-700 mt-1">
                      {currentResults.successRate}%
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 text-[10px] font-mono block">ERROR RATE</span>
                    <div className="text-xl font-extrabold font-mono text-rose-700 mt-1">
                      {currentResults.errorRate}%
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 text-[10px] font-mono block">LATENCY P50</span>
                    <div className="text-lg font-bold font-mono text-indigo-700 mt-1">{currentResults.p50} ms</div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 text-[10px] font-mono block">LATENCY P95</span>
                    <div className="text-lg font-bold font-mono text-indigo-700 mt-1">{currentResults.p95} ms</div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 text-[10px] font-mono block">LATENCY P99</span>
                    <div className="text-lg font-bold font-mono text-indigo-700 mt-1">{currentResults.p99} ms</div>
                  </div>
                </div>

                {/* Simulated Performance Charts Section */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                    <span>Performance Curves & Metrics Timeline</span>
                    <span className="text-[11px] font-mono text-slate-500">60s Sampling Window</span>
                  </h4>

                  <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-500 text-[11px] block mb-1">1. Throughput (RPS Curve)</span>
                      <div className="h-16 flex items-end justify-between gap-1 pt-2">
                        {[40, 65, 80, 95, 100, 98, 92, 88, 95, 100, 85].map((h, i) => (
                          <div
                            key={i}
                            className="bg-blue-600 rounded-t w-full transition-all"
                            style={{ height: `${h}%` }}
                          ></div>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-500 text-[11px] block mb-1">2. Response Latency Distribution</span>
                      <div className="h-16 flex items-end justify-between gap-1 pt-2">
                        {[30, 35, 40, 50, 65, 84, 90, 84, 80, 84, 82].map((h, i) => (
                          <div
                            key={i}
                            className="bg-indigo-600 rounded-t w-full transition-all"
                            style={{ height: `${h}%` }}
                          ></div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl text-center p-6 text-slate-400 bg-slate-50/50">
                <BarChart2 className="h-10 w-10 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-600">Ready for Load Test Execution</p>
                <p className="text-xs text-slate-500 mt-1">
                  Adjust virtual users and duration on the left, then click "Run Load Test".
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Endpoint Performance Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-600" />
          Endpoint Capacity & Latency Distribution Table
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-[11px] bg-slate-50">
                <th className="p-3">Endpoint Route</th>
                <th className="p-3">Total Requests</th>
                <th className="p-3">Success Count</th>
                <th className="p-3">Error Count</th>
                <th className="p-3">P50 Latency</th>
                <th className="p-3">P95 Latency</th>
                <th className="p-3 text-right">P99 Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr className="hover:bg-slate-50">
                <td className="p-3 font-bold text-blue-700">POST /api/orders</td>
                <td className="p-3">52,421</td>
                <td className="p-3 text-emerald-700 font-bold">52,263</td>
                <td className="p-3 text-rose-700 font-bold">158</td>
                <td className="p-3 text-slate-800">18 ms</td>
                <td className="p-3 text-indigo-700 font-bold">84 ms</td>
                <td className="p-3 text-right text-indigo-700 font-bold">142 ms</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="p-3 font-bold text-blue-700">GET /api/orders</td>
                <td className="p-3">38,100</td>
                <td className="p-3 text-emerald-700 font-bold">38,095</td>
                <td className="p-3 text-slate-400">5</td>
                <td className="p-3 text-slate-800">8 ms</td>
                <td className="p-3 text-indigo-700 font-bold">28 ms</td>
                <td className="p-3 text-right text-indigo-700 font-bold">54 ms</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="p-3 font-bold text-blue-700">GET /api/inventory/:sku</td>
                <td className="p-3">84,200</td>
                <td className="p-3 text-emerald-700 font-bold">84,200</td>
                <td className="p-3 text-slate-400">0</td>
                <td className="p-3 text-slate-800">4 ms</td>
                <td className="p-3 text-indigo-700 font-bold">14 ms</td>
                <td className="p-3 text-right text-indigo-700 font-bold">29 ms</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="p-3 font-bold text-blue-700">POST /api/payments</td>
                <td className="p-3">24,100</td>
                <td className="p-3 text-emerald-700 font-bold">24,075</td>
                <td className="p-3 text-rose-700 font-bold">25</td>
                <td className="p-3 text-slate-800">32 ms</td>
                <td className="p-3 text-indigo-700 font-bold">95 ms</td>
                <td className="p-3 text-right text-indigo-700 font-bold">185 ms</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Load Test History */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center justify-between">
          <span>Recent Load Test History</span>
          <span className="text-xs font-mono text-slate-500 font-normal">Past Runs Ledger</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-[11px] bg-slate-50">
                <th className="p-3">Test ID</th>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Target Endpoint</th>
                <th className="p-3">VUs</th>
                <th className="p-3">Duration</th>
                <th className="p-3">Requests</th>
                <th className="p-3">P95 Latency</th>
                <th className="p-3">Success Rate</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {history.map((run) => (
                <tr key={run.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-blue-700">{run.id}</td>
                  <td className="p-3 text-slate-500">{run.date}</td>
                  <td className="p-3 font-bold text-slate-800">{run.endpoint}</td>
                  <td className="p-3">{run.virtualUsers} VUs</td>
                  <td className="p-3">{run.durationSec} s</td>
                  <td className="p-3 font-bold">{run.totalRequests.toLocaleString()}</td>
                  <td className="p-3 text-indigo-700 font-bold">{run.p95} ms</td>
                  <td className="p-3 text-emerald-700 font-bold">{run.successRate}%</td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => setSelectedHistoryRun(run)}
                      className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 font-bold hover:bg-blue-100 transition"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* History Inspector Modal */}
      {selectedHistoryRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 relative border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
                  <Flame className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Load Test Details</h3>
                  <p className="text-xs text-slate-500 font-mono">ID: {selectedHistoryRun.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedHistoryRun(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs text-slate-700">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Timestamp:</span>
                  <span className="font-bold">{selectedHistoryRun.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Endpoint:</span>
                  <span className="font-bold text-blue-700">{selectedHistoryRun.endpoint}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Virtual Users:</span>
                  <span className="font-bold">{selectedHistoryRun.virtualUsers} VUs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Duration:</span>
                  <span className="font-bold">{selectedHistoryRun.durationSec} seconds</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Requests:</span>
                  <span className="font-bold text-slate-900">{selectedHistoryRun.totalRequests.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Throughput:</span>
                  <span className="font-bold text-blue-700">{selectedHistoryRun.throughputRps} req/s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Success Rate:</span>
                  <span className="font-bold text-emerald-700">{selectedHistoryRun.successRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">P95 Latency:</span>
                  <span className="font-bold text-indigo-700">{selectedHistoryRun.p95} ms</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedHistoryRun(null)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LoadTestingPage;
