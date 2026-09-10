import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * The service-role key used to fall back to the anon key.
 *
 * That single line turned every server-side "admin" client into an anonymous
 * one on any deployment that had not set the key, silently and with nothing in
 * the logs — which broke saving outright, in two different ways depending on
 * whether the edition happened to be published:
 *
 *   - Draft: `books` RLS ("owner_all") gives an anonymous reader nothing, so
 *     the ownership check in PUT /api/books/[id]/pages found no row and told the
 *     legitimate owner 403 Forbidden.
 *   - Published: "public_read_published" lets that check through, and the save
 *     died inside `replace_book_pages`, which is granted only to service_role.
 */
describe('the admin client refuses to masquerade as anon', () => {
  const saved = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.SUPABASE_SERVICE_KEY
  })

  afterEach(() => {
    process.env = { ...saved }
  })

  it('reports that it cannot do admin work when no service key is set', async () => {
    const { hasServiceRoleKey } = await import('./supabase')
    expect(hasServiceRoleKey()).toBe(false)
  })

  it('throws something actionable rather than quietly using the anon key', async () => {
    const { getSupabaseAdmin } = await import('./supabase')
    expect(() => getSupabaseAdmin()).toThrowError(/SUPABASE_SERVICE_ROLE_KEY is not set/)
  })

  it('never builds a client from the anon key', async () => {
    const createClient = vi.fn()
    vi.doMock('@supabase/supabase-js', () => ({ createClient, SupabaseClient: class {} }))
    const { getSupabaseAdmin } = await import('./supabase')
    expect(() => getSupabaseAdmin()).toThrow()
    expect(createClient).not.toHaveBeenCalled()
    vi.doUnmock('@supabase/supabase-js')
  })

  it('accepts either env name', async () => {
    process.env.SUPABASE_SERVICE_KEY = 'service-key'
    const { hasServiceRoleKey, getSupabaseAdmin } = await import('./supabase')
    expect(hasServiceRoleKey()).toBe(true)
    expect(() => getSupabaseAdmin()).not.toThrow()
  })

  it('SUPABASE_SERVICE_ROLE_KEY is enough on its own', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'role-key'
    const { hasServiceRoleKey } = await import('./supabase')
    expect(hasServiceRoleKey()).toBe(true)
  })
})
