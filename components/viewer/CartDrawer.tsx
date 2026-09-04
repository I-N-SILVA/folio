'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Trash2, ShoppingBag, Plus, Minus, ArrowRight } from 'lucide-react'

export interface CartItem {
  id: string
  title: string
  price: string
  numericPrice: number
  quantity: number
  pageNumber?: number
  image?: string
}

export function CartDrawer({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  checkoutUrl,
}: {
  isOpen: boolean
  onClose: () => void
  items: CartItem[]
  onUpdateQuantity: (id: string, qty: number) => void
  onRemoveItem: (id: string) => void
  onCheckout?: () => void
  /**
   * The author's own checkout, from `book.settings.checkoutUrl`. QLICO takes no
   * payment itself, so without one there is no checkout button — an edition that
   * cannot complete a sale must not offer to.
   */
  checkoutUrl?: string
}) {
  const subtotal = items.reduce((acc, item) => acc + item.numericPrice * item.quantity, 0)
  const currencySymbol = items[0]?.price.match(/[$€£¥]/)?.[0] || '$'

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Drawer Panel */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-neutral-800 bg-[#09090b] p-6 text-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-2">
                <ShoppingBag size={20} className="text-white" />
                <h2 className="font-display text-lg font-semibold tracking-tight">Shopping Bag</h2>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-zinc-300">
                  {items.reduce((acc, i) => acc + i.quantity, 0)}
                </span>
              </div>
              <button
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close bag"
              >
                <X size={16} />
              </button>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-zinc-500">
                  <ShoppingBag size={36} className="mb-3 opacity-30" />
                  <p className="text-sm font-medium">Your bag is empty</p>
                  <p className="mt-1 text-xs text-zinc-600">Click product pins in the publication to add items.</p>
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/60 p-3.5 transition-colors"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-0.5 text-xs text-zinc-400 font-mono">
                        {item.price} {item.pageNumber ? `· Page ${item.pageNumber}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center rounded-lg border border-neutral-700 bg-black/60 p-0.5">
                        <button
                          onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                          className="grid h-6 w-6 place-items-center rounded text-zinc-400 transition-colors hover:bg-neutral-800 hover:text-white"
                          aria-label="Decrease quantity"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="min-w-[24px] text-center text-xs font-semibold tabular-nums text-white">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                          className="grid h-6 w-6 place-items-center rounded text-zinc-400 transition-colors hover:bg-neutral-800 hover:text-white"
                          aria-label="Increase quantity"
                        >
                          <Plus size={11} />
                        </button>
                      </div>

                      <button
                        onClick={() => onRemoveItem(item.id)}
                        className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-red-950/40 hover:text-red-400"
                        aria-label="Remove item"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer / Checkout */}
            {items.length > 0 && (
              <div className="border-t border-neutral-800 pt-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Subtotal</span>
                  <span className="font-display font-semibold text-base text-white tabular-nums">
                    {currencySymbol}{subtotal.toFixed(2)}
                  </span>
                </div>
                {checkoutUrl ? (
                  <>
                    <p className="text-[11px] text-zinc-500">
                      Taxes and shipping are calculated by the seller at checkout.
                    </p>
                    <a
                      href={checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={onCheckout}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 text-sm font-semibold text-black transition-all hover:bg-zinc-200 active:scale-[0.99]"
                    >
                      Continue to checkout
                      <ArrowRight size={15} />
                    </a>
                  </>
                ) : (
                  /* No pretend checkout. Say what is true and leave the reader a
                     way to reach a person, rather than taking a card number. */
                  <p className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-3.5 py-3 text-[12px] leading-5 text-zinc-400">
                    This edition doesn&apos;t take payment here yet. Note what you&apos;d like and
                    get in touch with the seller to order it.
                  </p>
                )}
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}
