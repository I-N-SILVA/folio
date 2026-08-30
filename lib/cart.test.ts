import { describe, it, expect } from 'vitest'
import type { CartItem } from '@/components/viewer/CartDrawer'

function calculateSubtotal(items: CartItem[]): number {
  return items.reduce((acc, item) => acc + item.numericPrice * item.quantity, 0)
}

function addToCartHelper(items: CartItem[], newItem: Omit<CartItem, 'quantity'>): CartItem[] {
  const existing = items.find((i) => i.id === newItem.id)
  if (existing) {
    return items.map((i) => (i.id === newItem.id ? { ...i, quantity: i.quantity + 1 } : i))
  }
  return [...items, { ...newItem, quantity: 1 }]
}

function updateQuantityHelper(items: CartItem[], id: string, qty: number): CartItem[] {
  if (qty <= 0) return items.filter((i) => i.id !== id)
  return items.map((i) => (i.id === id ? { ...i, quantity: qty } : i))
}

describe('Shoppable Magazine Cart Engine', () => {
  it('correctly calculates subtotal for multiple items and quantities', () => {
    const items: CartItem[] = [
      { id: '1', title: 'Silk Trench', price: '$480', numericPrice: 480, quantity: 2 },
      { id: '2', title: 'Linen Throw', price: '$48', numericPrice: 48, quantity: 1 },
    ]
    expect(calculateSubtotal(items)).toBe(480 * 2 + 48)
  })

  it('increments quantity when adding an existing item', () => {
    let items: CartItem[] = [
      { id: '1', title: 'Silk Trench', price: '$480', numericPrice: 480, quantity: 1 },
    ]

    items = addToCartHelper(items, { id: '1', title: 'Silk Trench', price: '$480', numericPrice: 480 })
    expect(items.length).toBe(1)
    expect(items[0].quantity).toBe(2)
  })

  it('appends new item with quantity 1 when item is not in cart', () => {
    let items: CartItem[] = [
      { id: '1', title: 'Silk Trench', price: '$480', numericPrice: 480, quantity: 1 },
    ]

    items = addToCartHelper(items, { id: '2', title: 'Wool Beanie', price: '$65', numericPrice: 65 })
    expect(items.length).toBe(2)
    expect(items[1].quantity).toBe(1)
  })

  it('removes item when quantity reaches 0', () => {
    let items: CartItem[] = [
      { id: '1', title: 'Silk Trench', price: '$480', numericPrice: 480, quantity: 1 },
    ]

    items = updateQuantityHelper(items, '1', 0)
    expect(items.length).toBe(0)
  })
})
