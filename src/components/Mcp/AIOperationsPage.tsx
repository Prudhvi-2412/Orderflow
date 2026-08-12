import React, { useState, useEffect } from 'react';
import { Bot, Cpu, Play, ShieldAlert, CheckCircle2, AlertTriangle, ArrowRight, Database, Server, RefreshCw, Terminal, Lock } from 'lucide-react';

export function AIOperationsPage() {
  const [prompt, setPrompt] = useState('Why did order ORD-1001 fail?');
  const [orderIdInput, setOrderIdInput] = useState('ORD-1001');
  const [loading, setLoading] = useState(false);
  const [investigationResult, setInvestigationResult] = useState<any>(null);
  const [toolsList, setToolsList] = useState<any[]>([]);
  const [resourcesList, setResourcesList] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'investigate' | 'tools' | 'resources' | 'write'>('investigate');

  // Confirmation modal state for write tools
  const [selectedWriteTool, setSelectedWriteTool] = useState<string | null>(null);
  const [targetOrderId, setTargetOrderId] = useState('ORD-1001');
  const [userRole, setUserRole] = useState<'ADMIN' | 'OPERATOR' | 'VIEWER'>('ADMIN');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [writeResult, setWriteResult] = useState<any>(null);
  const [writeLoading, setWriteLoading] = useState(false);

  useEffect(() => {
    fetch('/api/mcp/tools')
      .then((res) => res.json())
      .then((data) => setToolsList(data.tools || []))
      .catch(console.error);

    fetch('/api/mcp/resources')
      .then((res) => res.json())
      .then((data) => setResourcesList(data.resources || []))
      .catch(console.error);
  }, []);

  const handleRunInvestigation = async (customPrompt?: string, targetId?: string) => {
    setLoading(true);
    setInvestigationResult(null);

    const queryPrompt = customPrompt || prompt;
    const queryOrder = targetId || orderIdInput;

    try {
      const res = await fetch('/api/mcp/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: queryPrompt, orderId: queryOrder })
      });
      const data = await res.json();
      setInvestigationResult(data);
    } catch (err: any) {
      setInvestigationResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteWriteTool = async () => {
    if (!selectedWriteTool) return;
    setWriteLoading(true);
    setWriteResult(null);

    try {
      const res = await fetch('/api/mcp/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: selectedWriteTool,
          arguments: {
            orderId: targetOrderId,
            messageId: targetOrderId,
            eventId: `evt_${targetOrderId}`,
            serviceName: 'payment-service',
            userRole,
            confirmationConfirmed: isConfirmed
          }
        })
      });
      const data = await res.json();
      setWriteResult(data);
    } catch (err: any) {
      setWriteResult({ error: err.message });
    } finally {
      setWriteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-lg border border-indigo-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <span className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <Bot className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight">AI Operations Control Plane (MCP)</h1>
              <p className="text-xs text-indigo-200/80">Model Context Protocol Layer for Distributed Diagnostics & Operations</p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-slate-300">MCP Protocol Server: ACTIVE</span>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('investigate')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
            activeTab === 'investigate'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          🔍 AI Investigation Assistant
        </button>

        <button
          onClick={() => setActiveTab('tools')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
            activeTab === 'tools'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          🛠️ MCP Tools Registry ({toolsList.length})
        </button>

        <button
          onClick={() => setActiveTab('resources')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
            activeTab === 'resources'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          📚 MCP Resources ({resourcesList.length})
        </button>

        <button
          onClick={() => setActiveTab('write')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
            activeTab === 'write'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          🛡️ Safe Write Operations & RBAC
        </button>
      </div>

      {/* TAB 1: AI INVESTIGATION ASSISTANT */}
      {activeTab === 'investigate' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Demo Prompts */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-2">
                <Terminal className="h-4 w-4 text-blue-600" />
                <span>AI Operational Investigation Query</span>
              </h2>

              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ask AI assistant about system failures or order state..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={orderIdInput}
                  onChange={(e) => setOrderIdInput(e.target.value)}
                  placeholder="Order ID"
                  className="w-32 px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  onClick={() => handleRunInvestigation()}
                  disabled={loading}
                  className="px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition flex items-center space-x-2 shadow"
                >
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  <span>Run AI Agent</span>
                </button>
              </div>

              {/* Demo Buttons */}
              <div className="pt-2">
                <p className="text-[11px] font-bold text-slate-400 mb-2">Example Investigation Scenarios:</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setPrompt('Why did order ORD-1001 fail?');
                      setOrderIdInput('ORD-1001');
                      handleRunInvestigation('Why did order ORD-1001 fail?', 'ORD-1001');
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition"
                  >
                    DEMO 1: "Why did ORD-1001 fail?"
                  </button>
                  <button
                    onClick={() => {
                      setPrompt('Check infrastructure health across services');
                      handleRunInvestigation('Check infrastructure health across services', 'ORD-1001');
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition"
                  >
                    DEMO 2: "Check infrastructure health"
                  </button>
                  <button
                    onClick={() => {
                      setPrompt('Inspect Saga lifecycle status for order');
                      setOrderIdInput('ORD-1001');
                      handleRunInvestigation('Inspect Saga lifecycle status for order', 'ORD-1001');
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition"
                  >
                    DEMO 3: "Saga lifecycle trace"
                  </button>
                </div>
              </div>
            </div>

            {/* AI Reasoning & Tools Executed Panel */}
            {investigationResult && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                    <Bot className="h-4 w-4 text-indigo-600" />
                    <span>AI Assistant Investigation Finding</span>
                  </h3>
                  <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                    REAL TOOL DATA
                  </span>
                </div>

                {/* Explanation Result */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                    {investigationResult.explanation}
                  </p>
                </div>

                {/* Tools Executed Sequence */}
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    MCP Tool Execution Sequence:
                  </h4>
                  <div className="flex items-center space-x-2 overflow-x-auto pb-2">
                    {investigationResult.toolsUsed?.map((tool: string, idx: number) => (
                      <React.Fragment key={idx}>
                        <div className="flex items-center space-x-1.5 bg-indigo-50 text-indigo-800 px-3 py-1.5 rounded-lg border border-indigo-200 text-xs font-mono font-bold">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span>{tool}</span>
                        </div>
                        {idx < investigationResult.toolsUsed.length - 1 && (
                          <ArrowRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Raw Tool Output Inspector */}
                <div className="bg-slate-950 p-4 rounded-xl text-slate-200 text-[11px] font-mono overflow-x-auto space-y-2">
                  <p className="text-slate-400 border-b border-slate-800 pb-1">
                    // Tool Results Payload (Sanitized - Credentials Redacted)
                  </p>
                  <pre>{JSON.stringify(investigationResult.investigationDetails, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Architecture Principles */}
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                MCP Operational Guarantees
              </h3>

              <ul className="space-y-3 text-xs text-slate-600">
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Source of Truth:</strong> Never bypasses PostgreSQL or business rules.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Zero Direct DB Mutation:</strong> Write actions call existing service handlers.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Human Confirmation:</strong> Dangerous operations require explicit approval.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Telemetry Instrumented:</strong> Metrics & OpenTelemetry trace integration.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TOOLS REGISTRY */}
      {activeTab === 'tools' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Registered MCP Tools ({toolsList.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {toolsList.map((t) => {
              const isWrite = ['retry_order', 'redrive_dlq_message', 'replay_event', 'reset_circuit_breaker'].includes(t.name);
              return (
                <div key={t.name} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-900">{t.name}</span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                      isWrite ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-blue-100 text-blue-800 border border-blue-300'
                    }`}>
                      {isWrite ? 'WRITE (REQUIRES AUTH)' : 'READ ONLY'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{t.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: RESOURCES EXPLORER */}
      {activeTab === 'resources' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900">MCP Resources ({resourcesList.length})</h2>
          <div className="space-y-3">
            {resourcesList.map((r) => (
              <div key={r.uri} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs font-bold text-blue-600">{r.uri}</span>
                  <p className="text-xs text-slate-600 mt-1">{r.description}</p>
                </div>
                <button
                  onClick={() => {
                    fetch(`/api/mcp/resources/read?uri=${encodeURIComponent(r.uri)}`)
                      .then((res) => res.json())
                      .then((data) => alert(JSON.stringify(data, null, 2)))
                      .catch(console.error);
                  }}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg transition"
                >
                  Read Resource
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: SAFE WRITE OPERATIONS */}
      {activeTab === 'write' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Lock className="h-4 w-4 text-amber-600" />
              <span>Controlled Write Operations & Human Approval Guard</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Demonstrates RBAC authorization, human confirmation guards, and calling existing OrderFlow business logic.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Select Write Tool:</label>
                <select
                  value={selectedWriteTool || ''}
                  onChange={(e) => setSelectedWriteTool(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                >
                  <option value="">-- Choose Tool --</option>
                  <option value="retry_order">retry_order (Saga Execution)</option>
                  <option value="redrive_dlq_message">redrive_dlq_message (RabbitMQ DLQ)</option>
                  <option value="replay_event">replay_event (Outbox Kafka Replay)</option>
                  <option value="reset_circuit_breaker">reset_circuit_breaker (Payment Gateway)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Target Order / Resource ID:</label>
                <input
                  type="text"
                  value={targetOrderId}
                  onChange={(e) => setTargetOrderId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Simulated User Role:</label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                >
                  <option value="ADMIN">ADMIN (Allowed)</option>
                  <option value="OPERATOR">OPERATOR (Allowed)</option>
                  <option value="VIEWER">VIEWER (Will be Rejected)</option>
                </select>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="confirmCheck"
                  checked={isConfirmed}
                  onChange={(e) => setIsConfirmed(e.target.checked)}
                  className="h-4 w-4 text-amber-600 rounded focus:ring-amber-500"
                />
                <label htmlFor="confirmCheck" className="text-xs font-semibold text-amber-900 cursor-pointer">
                  I explicitly confirm execution of this write operation (Human Approval Guard)
                </label>
              </div>

              <button
                onClick={handleExecuteWriteTool}
                disabled={writeLoading || !selectedWriteTool}
                className="w-full py-2.5 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 transition flex items-center justify-center space-x-2"
              >
                {writeLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                <span>Execute Write Operation</span>
              </button>
            </div>

            {/* Output result */}
            <div className="bg-slate-950 p-4 rounded-xl text-slate-200 text-[11px] font-mono space-y-2 overflow-x-auto">
              <p className="text-slate-400 border-b border-slate-800 pb-1">// Write Execution Result</p>
              {writeResult ? (
                <pre>{JSON.stringify(writeResult, null, 2)}</pre>
              ) : (
                <p className="text-slate-600 italic">Select tool and execute to test authorization...</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
