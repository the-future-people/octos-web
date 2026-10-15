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

// predict=1 asks the server to work out when the floor will be clear of
// this job. Only the coordinator's workspace wants it — it is real work
// on the server, and nobody else reads the answer.
export const getJobDetail = (id, { predict = false } = {}) =>
  client.get(`/api/v1/jobs/${id}/${predict ? '?predict=1' : ''}`)

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

// Take the next job into the inspection workspace, or keep the claim
// alive while it is open. The server refuses (409) a job someone else
// holds or one that is not next — the strict queue is enforced there,
// not only by which buttons this page shows.
export const claimJob = (id) =>
  client.post(`/api/v1/jobs/${id}/inspect/`)

// Close the workspace without clearing or suspending. Frees only this
// coordinator's own claim.
export const releaseJob = (id) =>
  client.post(`/api/v1/jobs/${id}/inspect/release/`)

// Correct a line's specification during inspection, after the customer
// agreed on the recorded company line. Price never changes; the server
// refuses quantity, pages and anything else the price was built from.
export const changeSpecs = (id, lineId, payload) =>
  client.post(`/api/v1/jobs/${id}/lines/${lineId}/specs/`, payload)

// The floor: every machine with its line-up, the hand-finishing bench,
// and anything waiting for a machine to be chosen.
export const getFloor = () =>
  client.get('/api/v1/jobs/coordinator/floor/')

// The job on a machine is finished there; the next one moves up.
export const markStepDone = (stepId) =>
  client.post(`/api/v1/jobs/steps/${stepId}/done/`)

// Put a step on another machine of the same work that is up and fits.
export const moveStep = (stepId, machineId) =>
  client.post(`/api/v1/jobs/steps/${stepId}/move/`, { machine: machineId })