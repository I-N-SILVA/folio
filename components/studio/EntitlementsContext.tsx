'use client'

import { createContext, useContext } from 'react'
import { PLANS, type Entitlements } from '@/lib/plans'

/**
 * The signed-in author's entitlements, for the studio UI.
 *
 * This exists so a locked control can say so *before* it is used, rather than
 * letting an author configure a lead gate the server will decline to apply. It
 * is presentation only — every entitlement is enforced server-side as well
 * (see `lib/plans.ts`), because anything a client can read a client can lie
 * about.
 *
 * A context rather than a prop: the settings panel is rendered from two places
 * (the desktop inspector and the mobile bottom sheet), and only one of them
 * has a path back to the page that loaded the plan.
 */

export type StudioEntitlements = Entitlements & { planName: string; planId: string }

const FALLBACK: StudioEntitlements = {
  ...PLANS.free.entitlements,
  planName: PLANS.free.name,
  planId: PLANS.free.id,
}

const EntitlementsContext = createContext<StudioEntitlements>(FALLBACK)

export function EntitlementsProvider({
  value,
  children,
}: {
  value: StudioEntitlements
  children: React.ReactNode
}) {
  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>
}

/** Defaults to Free, so a component that ends up outside the provider locks rather than unlocks. */
export function useEntitlements(): StudioEntitlements {
  return useContext(EntitlementsContext)
}
