import React, { useState } from 'react';
import { X, PlusCircle, ShieldCheck, ArrowRight } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl p-6 relative border border-slate-200 shadow-2xl space-y-5">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center space-x-2.5 text-slate-900 font-bold text-lg">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
              <PlusCircle className="h-5 w-5" />
            </div>
            <span>Create Custom Order</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Order Flow Preview */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-[11px] font-mono text-slate-600">
          <span>Order</span>
          <ArrowRight className="h-3 w-3 text-slate-400" />
          <span>Inventory</span>
          <ArrowRight className="h-3 w-3 text-slate-400" />
          <span>Payment</span>
          <ArrowRight className="h-3 w-3 text-slate-400" />
          <span>Fulfillment</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-mono">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Product</label>
            <select
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="w-full input-enterprise px-3 py-2 text-xs font-medium"
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} (Stock: {item.stock})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                max="5"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full input-enterprise px-3 py-2 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Email</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full input-enterprise px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Idempotency Key</label>
            <input
              type="text"
              value={idempotencyKey}
              onChange={(e) => setIdempotencyKey(e.target.value)}
              className="w-full input-enterprise px-3 py-2 text-xs font-mono text-blue-700"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Locking Strategy</label>
            <select
              value={lockStrategy}
              onChange={(e) => setLockStrategy(e.target.value as 'PESSIMISTIC' | 'OPTIMISTIC' | 'NONE')}
              className="w-full input-enterprise px-3 py-2 text-xs font-medium"
            >
              <option value="PESSIMISTIC">PESSIMISTIC (Redis Redlock Mutex)</option>
              <option value="OPTIMISTIC">OPTIMISTIC (Version CAS Compare-and-Swap)</option>
              <option value="NONE">NONE (Race Condition Simulation)</option>
            </select>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-1 text-[11px] font-mono text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
              <span>Compensating Rollback Protected</span>
            </div>

            <div className="flex space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold shadow-sm hover:bg-blue-700 transition"
              >
                {isSubmitting ? 'Processing Saga...' : 'Submit Order'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
