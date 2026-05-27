// src/api/auth.js
import client from './client'

export const login = async (email, password) => {
  const { data } = await client.post('/api/v1/auth/token/', { email, password })
  return data // { access, refresh }
}

export const getMe = async () => {
  const { data } = await client.get('/api/v1/accounts/me/')
  return data
}