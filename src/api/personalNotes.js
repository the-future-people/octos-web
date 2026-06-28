// src/api/personalNotes.js
import client from './client'

export const getPinStatus = () =>
  client.get('/api/v1/personal-notes/pin/status/')

export const setPin = (pin) =>
  client.post('/api/v1/personal-notes/pin/set/', { pin })

export const verifyPin = (pin) =>
  client.post('/api/v1/personal-notes/pin/verify/', { pin })

export const getNotes = () =>
  client.get('/api/v1/personal-notes/')

export const createNote = (payload) =>
  client.post('/api/v1/personal-notes/', payload)

export const updateNote = (id, payload) =>
  client.patch(`/api/v1/personal-notes/${id}/`, payload)

export const deleteNote = (id) =>
  client.delete(`/api/v1/personal-notes/${id}/`)

export const getDueReminders = () =>
  client.get('/api/v1/personal-notes/due-reminders/')

export const dismissReminder = (id) =>
  client.post(`/api/v1/personal-notes/${id}/dismiss-reminder/`)

export const completeTask = (id) =>
  client.post(`/api/v1/personal-notes/${id}/complete/`)

export const acknowledgeCheckpoint = (id) =>
  client.post(`/api/v1/personal-notes/checkpoints/${id}/acknowledge/`)