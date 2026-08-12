import React, { useState } from 'react';
import { ShoppingCart, Search, Filter, Eye, X, CheckCircle2, AlertTriangle, Clock, Layers } from 'lucide-react';
import { globalOrderService, SagaState } from '../../services/OrderService.js';
import { StatusBadge } from '../Common/StatusBadge.js';
import { SagaStepTimeline } from '../Saga/SagaStepTimeline.js';

export function OrderManagementPage() {
  const orders = globalOrderService.getAllOrders();
  const [selectedOrder, setSelectedOrder] = useState<SagaState | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filteredOrders = orders.filter((ord) => {
    const matchesSearch =
      ord.orderId.toLowerCase().includes(search.toLowerCase()) ||
      ord.customerEmail.toLowerCase().includes(search.toLowerCase()) ||
      ord.sku.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || ord.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Order Management</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
              {orders.length} Total Orders
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Track multi-service saga states, idempotency keys, and payment settlements.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="relative w-full md:w-96">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search Order ID, Customer, SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
          />
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 font-medium bg-white focus:outline-none focus:border-blue-600"
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">CONFIRMED (Completed)</option>
            <option value="PAYMENT_PROCESSING">PAYMENT_PENDING</option>
            <option value="INVENTORY_RESERVATION">INVENTORY_RESERVED</option>
            <option value="CANCELLED">FAILED / CANCELLED</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Product SKU</th>
                <th className="py-3 px-4">Qty</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Lock Strategy</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No orders recorded yet. Submit an order from the top bar!
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => (
                  <tr key={ord.orderId} className="hover:bg-blue-50/40 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">{ord.orderId}</td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">{ord.customerEmail}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{ord.sku}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">{ord.quantity}</td>
                    <td className="py-3.5 px-4 font-mono font-extrabold text-emerald-700">${ord.totalAmount}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-600 text-[11px]">{ord.lockStrategy}</td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={ord.status} type="saga" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedOrder(ord)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-[11px] transition border border-blue-200"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Slide Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white h-full border-l border-slate-200 shadow-2xl p-6 overflow-y-auto space-y-6 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-bold font-mono text-slate-900">{selectedOrder.orderId}</h2>
                  <StatusBadge status={selectedOrder.status} type="saga" />
                </div>
                <p className="text-xs text-slate-500 mt-1">Saga Distributed Transaction Drawer</p>
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Order Attributes */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 font-mono">Customer:</span>
                <p className="font-bold text-slate-900 mt-0.5">{selectedOrder.customerEmail}</p>
              </div>
              <div>
                <span className="text-slate-400 font-mono">Total Amount:</span>
                <p className="font-extrabold text-emerald-700 text-sm mt-0.5">${selectedOrder.totalAmount}</p>
              </div>
              <div>
                <span className="text-slate-400 font-mono">Product SKU:</span>
                <p className="font-bold text-slate-900 mt-0.5">{selectedOrder.sku} (Qty: {selectedOrder.quantity})</p>
              </div>
              <div>
                <span className="text-slate-400 font-mono">Lock Strategy:</span>
                <p className="font-bold text-blue-700 mt-0.5">{selectedOrder.lockStrategy}</p>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 font-mono">Idempotency Key:</span>
                <p className="font-mono text-blue-700 bg-white px-2 py-1 rounded border border-slate-200 mt-1">
                  {selectedOrder.idempotencyKey}
                </p>
              </div>
            </div>

            {/* Step Timeline */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-3">Saga Execution Timeline</h3>
              <SagaStepTimeline steps={selectedOrder.steps} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
