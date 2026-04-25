const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'

let unauthorizedHandler = null

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === 'function' ? handler : null
}

function buildHeaders(body, headers) {
  if (body instanceof FormData) {
    return headers
  }
  return {
    'Content-Type': 'application/json',
    ...headers,
  }
}

async function parsePayload(response, responseType = 'json') {
  if (responseType === 'blob') {
    return response.blob()
  }

  if (response.status === 204) {
    return null
  }

  const payload = await response.json().catch(() => ({}))
  return payload?.data ?? payload
}

export async function apiRequest(path, options = {}) {
  const {
    method = 'GET',
    body,
    headers,
    credentials = 'include',
    responseType = 'json',
  } = options

  const requestUrl = `${API_BASE}${path}`
  let response

  try {
    response = await fetch(requestUrl, {
      method,
      credentials,
      headers: buildHeaders(body, headers),
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(
      `Unable to reach API server at ${API_BASE}. Check whether backend is running and VITE_API_BASE_URL is correct.`,
      0,
      { path, requestUrl },
    )
  }

  const payload = await parsePayload(response, responseType)

  if (!response.ok) {
    if (response.status === 401 && unauthorizedHandler) {
      unauthorizedHandler()
    }

    const message = payload?.message || 'Request failed'
    throw new ApiError(message, response.status, payload)
  }

  return payload
}