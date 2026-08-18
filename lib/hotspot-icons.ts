import {
  BarChart2,
  BookOpen,
  Gift,
  Heart,
  Info,
  Link as LinkIcon,
  MapPin,
  Pencil,
  Play,
  Quote,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Tag,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/**
 * The icons a hotspot may use — one list, shared by the studio's picker and the
 * reader that renders the result.
 *
 * `hotspot.icon` is a free string in the schema, and both surfaces used to index
 * the entire lucide module with it. In the reader that was a crash waiting to
 * happen: a name matching a non-component export (`createLucideIcon`, `default`,
 * an internal) resolves to something React cannot render and throws while
 * rendering a *published* edition, taking the page down for every reader of it.
 * The picker only ever offered real icons, but the API accepts any string, so the
 * reader could not assume the value came from the picker.
 *
 * A closed map fixes that by construction — an unknown name is simply not in it —
 * and stops the two surfaces drifting apart. It also keeps the bundle honest:
 * importing named icons lets the rest of the library be tree-shaken away, where a
 * namespace import pulls in all of it.
 */
export const HOTSPOT_ICONS: Record<string, LucideIcon> = {
  Info,
  Star,
  Zap,
  Sparkles,
  BookOpen,
  BarChart2,
  Play,
  Link: LinkIcon,
  ShoppingBag,
  ShoppingCart,
  Tag,
  Gift,
  Heart,
  MapPin,
  Quote,
  Pencil,
}

/** Names in picker order. */
export const HOTSPOT_ICON_NAMES = Object.keys(HOTSPOT_ICONS)

/** Always returns something renderable. */
export function hotspotIcon(name: string | undefined): LucideIcon {
  return (name && HOTSPOT_ICONS[name]) || Info
}
