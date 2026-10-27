// src/api/operator.js
// The operator's machine screen. An operator is whoever is currently
// assigned to a machine, whatever their role; the server decides.

import client from './client'

export const getOperatorQueue = () =>
  client.get('/api/v1/jobs/operator/queue/')

export const startStep = (stepId) =>
  client.post(`/api/v1/jobs/operator/steps/${stepId}/start/`)

// payload: { made, spoilt }
export const finishStep = (stepId, payload) =>
  client.post(`/api/v1/jobs/operator/steps/${stepId}/done/`, payload)

// payload: { kind: 'MACHINE_DOWN' | 'FILE_FAULT' | 'MATERIAL_OUT', note }
export const reportProblem = (stepId, payload) =>
  client.post(`/api/v1/jobs/operator/steps/${stepId}/problem/`, payload)

export const unlockStation = (password) =>
  client.post('/api/v1/jobs/operator/unlock/', { password })

// File links come back relative and already signed. They open in a new
// tab, outside axios, so they need the API's full address in front.
export const fileUrl = (path) => `${client.defaults.baseURL}${path}`