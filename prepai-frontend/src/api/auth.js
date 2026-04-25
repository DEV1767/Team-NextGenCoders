import { apiRequest } from './client'

export async function loginUser(payload) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: payload,
  })
}

export async function registerUser(payload) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: payload,
  })
}

export async function logoutUser() {
  return apiRequest('/auth/logout', {
    method: 'POST',
  })
}
