import React, { useState } from 'react';
import { X, PlusCircle } from 'lucide-react';
import { globalInventoryService } from '../../services/InventoryService.js';
import { globalOrderService } from '../../services/OrderService.js';
import { createBackendOrder } from '../../api/orderflowApi.js';

export interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (order: any) => void;
}

export function CreateOrderModal({ isOpen, onClose, onSuccess }: CreateOrderModalProps) {
  const items = globalInventoryService.getAllItems();

  const [sku, setSku] = useState('ITEM-IPHONE-15');
  const [quantity, setQuantity] = useState<number | string>(1);
  const [customerEmail, setCustomerEmail] = useState('alex.dev@example.com');
  const [lockStrategy, setLockStrategy] = useState<'PESSIMISTIC' | 'OPTIMISTIC' | 'NONE'>('PESSIMISTIC');
  const [idempotencyKey, setIdempotencyKey] = useState(`idemp_user_${Math.floor(1000 + Math.random() * 9000)}`);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    const selectedItem = items.find((i) => i.id === sku);
    const price = selectedItem?.id === 'ITEM-IPHONE-15' ? 999 : selectedItem?.id === 'ITEM-GPU-4090' ? 1599 : 499;

    try {
      let order: any;
      try {
        order = await createBackendOrder({
          sku,
          quantity: parseInt(quantity.toString()),
          price,
          customerEmail,
          idempotencyKey,
          lockStrategy
        });
      } catch (backendErr: any) {
        console.warn('[Backend Offline] Falling back to local in-memory simulation:', backendErr.message);
        order = await globalOrderService.submitOrder({
          sku,
          quantity: parseInt(quantity.toString()),
          price,
          idempotencyKey,
          lockStrategy,
          customerEmail
        });
      }

      setIsSubmitting(false);
      onSuccess(order);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-lg rounded-2xl p-6 relative border border-slate-700 shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2 text-cyan-400 font-bold text-base">
            <PlusCircle className="h-5 w-5" />
            <span>Create Custom Order</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Select Product</label>
            <select
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="w-full glass-input rounded-xl px-3 py-2 text-sm font-medium"
            >
              {items.map((item) => (
                <option key={item.id} value={item.id} className="bg-slate-900 text-slate-100">
                  {item.name} (Available: {item.stock})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                max="5"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Customer Email</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Idempotency Key</label>
            <input
              type="text"
              value={idempotencyKey}
              onChange={(e) => setIdempotencyKey(e.target.value)}
              className="w-full glass-input rounded-xl px-3 py-2 text-xs font-mono text-cyan-300"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Concurrency Locking Strategy</label>
            <select
              value={lockStrategy}
              onChange={(e) => setLockStrategy(e.target.value as 'PESSIMISTIC' | 'OPTIMISTIC' | 'NONE')}
              className="w-full glass-input rounded-xl px-3 py-2 text-sm font-medium"
            >
              <option value="PESSIMISTIC" className="bg-slate-900 text-emerald-400">
                PESSIMISTIC (PostgreSQL SELECT FOR UPDATE)
              </option>
              <option value="OPTIMISTIC" className="bg-slate-900 text-amber-400">
                OPTIMISTIC (Version CAS Compare-and-Swap)
              </option>
              <option value="NONE" className="bg-slate-900 text-rose-400">
                NONE (Race Condition Simulation)
              </option>
            </select>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white text-xs font-bold shadow-lg shadow-cyan-500/25 hover:from-cyan-400 hover:to-indigo-500 transition"
            >
              {isSubmitting ? 'Processing Saga...' : 'Submit Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
