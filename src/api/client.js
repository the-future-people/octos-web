// src/api/client.js
// Central Axios instance — all API calls go through here.
// Handles JWT attach, token refresh, and 401 redirect.

import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const client = axios.create({
  baseURL: BASE_URL,
  // No default Content-Type: axios sets it per request (JSON for objects,
  // multipart with its boundary for FormData). A JSON default here made
  // axios turn every FormData into JSON and silently drop the files (11 Nov 2026).
})

// ── Attach access token to every request ─────────────────────────
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Handle 401 — attempt refresh, else redirect to login ─────────
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true

      try {
        const refresh = localStorage.getItem('refresh_token')
        if (!refresh) throw new Error('No refresh token')

        const { data } = await axios.post(`${BASE_URL}/api/v1/auth/token/refresh/`, {
          refresh,
        })

        localStorage.setItem('access_token', data.access)
        original.headers.Authorization = `Bearer ${data.access}`
        return client(original)
      } catch {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

export default client
