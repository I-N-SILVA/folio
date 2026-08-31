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
  Compass,
  Star,
  Tag,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/**
 * The icons a hotspot may use — one list, shared by the studio's picker and the
 * reader that renders the result.
 */
export const HOTSPOT_ICONS: Record<string, LucideIcon> = {
  Info,
  Star,
  Zap,
  Compass,
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
