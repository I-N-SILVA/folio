import { describe, it, expect } from 'vitest'
import type { ReviewComment } from '@/components/viewer/ReviewDrawer'

function addCommentHelper(
  comments: ReviewComment[],
  newComment: { author: string; text: string; pageNumber: number }
): ReviewComment[] {
  return [
    ...comments,
    {
      id: `rev-${Date.now()}-${Math.random()}`,
      author: newComment.author || 'Reviewer',
      text: newComment.text,
      pageNumber: newComment.pageNumber,
      timestamp: 'Just now',
      resolved: false,
    },
  ]
}

function resolveCommentHelper(comments: ReviewComment[], id: string): ReviewComment[] {
  return comments.map((c) => (c.id === id ? { ...c, resolved: true } : c))
}

function filterCommentsByPage(comments: ReviewComment[], pageNumber: number): ReviewComment[] {
  return comments.filter((c) => c.pageNumber === pageNumber)
}

describe('Client Review & Proofing Drawer Engine', () => {
  it('adds a new comment with correct page association and unresolved status', () => {
    let comments: ReviewComment[] = []
    comments = addCommentHelper(comments, { author: 'Art Director', text: 'Adjust contrast on title', pageNumber: 2 })

    expect(comments.length).toBe(1)
    expect(comments[0].author).toBe('Art Director')
    expect(comments[0].text).toBe('Adjust contrast on title')
    expect(comments[0].pageNumber).toBe(2)
    expect(comments[0].resolved).toBe(false)
  })

  it('filters comments strictly by active page number', () => {
    let comments: ReviewComment[] = []
    comments = addCommentHelper(comments, { author: 'Editor', text: 'Fix typo', pageNumber: 1 })
    comments = addCommentHelper(comments, { author: 'Designer', text: 'Replace image', pageNumber: 2 })

    expect(filterCommentsByPage(comments, 1).length).toBe(1)
    expect(filterCommentsByPage(comments, 1)[0].text).toBe('Fix typo')
    expect(filterCommentsByPage(comments, 2).length).toBe(1)
    expect(filterCommentsByPage(comments, 3).length).toBe(0)
  })

  it('marks comment as resolved without deleting it', () => {
    let comments: ReviewComment[] = [
      { id: 'c1', author: 'Client', text: 'Add logo', pageNumber: 1, timestamp: '1h ago', resolved: false },
    ]

    comments = resolveCommentHelper(comments, 'c1')
    expect(comments.length).toBe(1)
    expect(comments[0].resolved).toBe(true)
  })
})
