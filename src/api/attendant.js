// src/api/attendant.js
// Attendant end-of-day sign-off (13 Nov 2026).
import client from './client'

export const getSignOffStatus = () =>
  client.get('/api/v1/finance/attendant/signoff/status/')

export const getSignOffPreview = () =>
  client.get('/api/v1/finance/attendant/signoff/preview/')

// payload: { unpaid: { [jobId]: answer }, shelf: { [jobId]: answer }, handover_note }
export const submitSignOff = (payload) =>
  client.post('/api/v1/finance/attendant/signoff/', payload)

export const resolveSignOffItem = (itemId, note) =>
  client.post(`/api/v1/finance/attendant-signoff-items/${itemId}/resolve/`, { note })
