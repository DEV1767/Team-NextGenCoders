import { apiRequest } from './client'

export async function getDueFlashcards() {
  return apiRequest('/flashcards/due')
}

export async function reviewFlashcard(cardId, status) {
  return apiRequest(`/flashcards/${encodeURIComponent(cardId)}/review`, {
    method: 'PATCH',
    body: { status },
  })
}

export async function answerFlashcard(cardId, userAnswer) {
  return apiRequest(`/flashcards/${encodeURIComponent(cardId)}/answer`, {
    method: 'POST',
    body: { userAnswer },
  })
}
