'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  CheckCircle2,
  Lock,
  CreditCard,
  Truck,
  ShieldCheck,
  ArrowRight,
  Printer,
  ShoppingBag,
  Sparkles,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { CartItem } from './CartDrawer'

interface CheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  items: CartItem[]
  onClearCart: () => void
  bookTitle?: string
}

export function CheckoutModal({
  isOpen,
  onClose,
  items,
  onClearCart,
  bookTitle,
}: CheckoutModalProps) {
  const [step, setStep] = useState<'checkout' | 'processing' | 'confirmed'>('checkout')
  const [shippingMethod, setShippingMethod] = useState<'standard' | 'express'>('standard')
  const [formData, setFormData] = useState({
    name: 'Elena Rostova',
    email: 'elena.rostova@editorial.luxury',
    address: 'Via Montenapoleone 14',
    city: 'Milan',
    postalCode: '20121',
    country: 'Italy',
    cardNumber: '•••• •••• •••• 4242',
    expDate: '08/28',
    cvv: '888',
  })
  const [orderNumber, setOrderNumber] = useState('')

  const subtotal = items.reduce((acc, item) => acc + item.numericPrice * item.quantity, 0)
  const currencySymbol = items[0]?.price.match(/[$€£¥]/)?.[0] || '$'
  const shippingCost = shippingMethod === 'express' ? 25 : 0
  const tax = subtotal * 0.08
  const total = subtotal + shippingCost + tax

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault()
    setStep('processing')

    setTimeout(() => {
      const generatedOrder = `FL-${Math.floor(100000 + Math.random() * 900000)}`
      setOrderNumber(generatedOrder)
      setStep('confirmed')
      onClearCart()
      toast.success('Order placed successfully!')
    }, 1800)
  }

  const handlePrintReceipt = () => {
    window.print()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={step === 'processing' ? undefined : onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c0e] text-white shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-amber-400">
                <Lock size={15} />
              </div>
              <div>
                <h3 className="font-display text-base font-semibold tracking-tight">
                  {step === 'confirmed' ? 'Order Confirmed' : 'Boutique Express Checkout'}
                </h3>
                <p className="text-[11px] text-neutral-400">
                  {bookTitle ? `Order from ${bookTitle}` : 'Direct In-Edition Secure Checkout'}
                </p>
              </div>
            </div>

            {step !== 'processing' && (
              <button
                type="button"
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 hover:bg-white/10 hover:text-white transition"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Body Steps */}
          {step === 'checkout' && (
            <form onSubmit={handlePlaceOrder} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Order Items Preview */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Order Items ({items.reduce((acc, i) => acc + i.quantity, 0)})
                </span>
                <div className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[0.02] p-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2.5 px-3">
                      <div className="flex items-center gap-3">
                        {item.image ? (
                          <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-black/40">
                            <Image src={item.image} alt={item.title} fill className="object-cover" />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-neutral-400">
                            <ShoppingBag size={16} />
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-semibold text-white">{item.title}</p>
                          <p className="text-[11px] text-neutral-400 font-mono">
                            Qty: {item.quantity} × {item.price}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-white font-mono">
                        {currencySymbol}{(item.numericPrice * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shipping Details */}
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <Truck size={13} />
                  Shipping Destination
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-white/30 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">Email for Receipt</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-white/30 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[11px] text-neutral-400 mb-1">Street Address</label>
                    <input
                      type="text"
                      required
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-white/30 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">City / Country</label>
                    <input
                      type="text"
                      required
                      value={`${formData.city}, ${formData.country}`}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-white/30 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Speed Options */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Delivery Method
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setShippingMethod('standard')}
                    className={`flex flex-col items-start p-3 rounded-2xl border transition text-left ${
                      shippingMethod === 'standard'
                        ? 'border-amber-400/80 bg-amber-400/10 text-white'
                        : 'border-white/10 bg-white/[0.02] text-neutral-400 hover:border-white/20'
                    }`}
                  >
                    <span className="text-xs font-bold text-white">Complimentary Express</span>
                    <span className="text-[10px] text-neutral-400 mt-0.5">3-5 business days · Free</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShippingMethod('express')}
                    className={`flex flex-col items-start p-3 rounded-2xl border transition text-left ${
                      shippingMethod === 'express'
                        ? 'border-amber-400/80 bg-amber-400/10 text-white'
                        : 'border-white/10 bg-white/[0.02] text-neutral-400 hover:border-white/20'
                    }`}
                  >
                    <span className="text-xs font-bold text-white">Priority White Glove (+$25)</span>
                    <span className="text-[10px] text-neutral-400 mt-0.5">Next morning delivery</span>
                  </button>
                </div>
              </div>

              {/* Payment Card Form */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                    <CreditCard size={13} />
                    Payment Details
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                    <ShieldCheck size={12} />
                    256-Bit Encrypted
                  </span>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3.5 space-y-3">
                  <div>
                    <label className="block text-[10px] text-neutral-400 mb-1">Card Number</label>
                    <input
                      type="text"
                      required
                      value={formData.cardNumber}
                      onChange={(e) => setFormData({ ...formData, cardNumber: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-mono text-white focus:border-white/30 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-neutral-400 mb-1">Expiry Date</label>
                      <input
                        type="text"
                        required
                        value={formData.expDate}
                        onChange={(e) => setFormData({ ...formData, expDate: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-mono text-white focus:border-white/30 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-neutral-400 mb-1">CVC / CVV</label>
                      <input
                        type="text"
                        required
                        value={formData.cvv}
                        onChange={(e) => setFormData({ ...formData, cvv: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-mono text-white focus:border-white/30 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
                <div className="flex justify-between text-xs text-neutral-400">
                  <span>Subtotal</span>
                  <span className="font-mono text-white">{currencySymbol}{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-neutral-400">
                  <span>Shipping</span>
                  <span className="font-mono text-white">{shippingCost === 0 ? 'Free' : `${currencySymbol}${shippingCost.toFixed(2)}`}</span>
                </div>
                <div className="flex justify-between text-xs text-neutral-400">
                  <span>Estimated Tax (8%)</span>
                  <span className="font-mono text-white">{currencySymbol}{tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-white/10 text-sm font-bold text-white">
                  <span>Total Due</span>
                  <span className="font-mono text-amber-300 text-base">{currencySymbol}{total.toFixed(2)}</span>
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-4 text-sm font-bold text-black shadow-xl hover:bg-neutral-200 active:scale-[0.99] transition"
              >
                <span>Authorize & Pay {currencySymbol}{total.toFixed(2)}</span>
                <ArrowRight size={16} />
              </button>
            </form>
          )}

          {step === 'processing' && (
            <div className="py-20 px-6 text-center space-y-4">
              <Loader2 size={40} className="mx-auto animate-spin text-amber-400" />
              <h4 className="font-display text-lg font-semibold">Processing Secure Checkout…</h4>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Authorizing payment and preparing instant boutique order confirmation.
              </p>
            </div>
          )}

          {step === 'confirmed' && (
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-center">
              <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 size={36} strokeWidth={2.5} />
              </div>

              <div>
                <h4 className="font-display text-xl font-bold text-white">Thank You for Your Order!</h4>
                <p className="text-xs text-neutral-300 mt-1">
                  Your bespoke pieces are being prepared. A confirmation receipt has been sent to{' '}
                  <span className="font-semibold text-white">{formData.email}</span>.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-left space-y-3">
                <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                  <span className="text-xs text-neutral-400">Order Number</span>
                  <span className="text-xs font-mono font-bold text-amber-300">{orderNumber}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                  <span className="text-xs text-neutral-400">Recipient</span>
                  <span className="text-xs font-semibold text-white">{formData.name}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                  <span className="text-xs text-neutral-400">Delivery Address</span>
                  <span className="text-xs text-neutral-300">{formData.address}, {formData.city}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-neutral-400">Total Charged</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">{currencySymbol}{total.toFixed(2)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-xs font-semibold text-white hover:bg-white/10 transition"
                >
                  <Printer size={14} />
                  Print Receipt
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex items-center justify-center gap-2 rounded-xl bg-white py-3 text-xs font-bold text-black hover:bg-neutral-200 transition"
                >
                  Continue Reading
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
