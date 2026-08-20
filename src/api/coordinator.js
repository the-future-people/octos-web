// src/api/coordinator.js
import client from './client'

export const getVerificationQueue = () =>
  client.get('/api/v1/jobs/coordinator/verification-queue/')

export const getProductionBoard = () =>
  client.get('/api/v1/jobs/coordinator/board/')

export const verifyJob = (id, payload) =>
  client.post(`/api/v1/jobs/${id}/verify/`, payload)

export const rejectVerification = (id, payload) =>
  client.post(`/api/v1/jobs/${id}/verify/reject/`, payload)

export const moveJobAxis = (id, payload) =>
  client.post(`/api/v1/jobs/${id}/move/`, payload)

export const haltJob = (id, payload) =>
  client.post(`/api/v1/jobs/${id}/halt/`, payload)

export const resumeJob = (id) =>
  client.post(`/api/v1/jobs/${id}/resume/`)

export const getJobDetail = (id) =>
  client.get(`/api/v1/jobs/${id}/`)

export const getMachines = () =>
  client.get('/api/v1/production/machines/')

export const machineDown = (id, payload) =>
  client.post(`/api/v1/production/machines/${id}/down/`, payload)

export const machineUp = (id, payload) =>
  client.post(`/api/v1/production/machines/${id}/up/`, payload)

export const getSuspendedJobs = () =>
  client.get('/api/v1/jobs/coordinator/suspended/')

export const suspendJob = (id, payload) =>
  client.post(`/api/v1/jobs/${id}/verify/suspend/`, payload)