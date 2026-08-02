import { redirect } from 'next/navigation'

/**
 * The studio had two creation flows: this wizard, which posted to
 * /api/books, and CreateBookModal, which inserted straight from the browser.
 * Two write paths meant two sets of rules, and the one that skipped the API's
 * validation shipped a broken import. The modal is now the single entry point
 * — it covers blank, PDF, and image imports, shows plan quota, and takes the
 * custom slug this wizard used to be the only source of.
 *
 * Kept as a redirect so existing links and bookmarks still land somewhere
 * useful.
 */
export default function CreateRedirectPage() {
  redirect('/dashboard?new=1')
}
