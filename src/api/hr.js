// src/api/hr.js
// HR portal calls. The portal is moving here from the Django template
// (hr_portal.js) one pane at a time; Vacancies is first.

import client from './client'

// ── Vacancies ────────────────────────────────────────────────
export const getVacancies = () =>
  client.get('/api/v1/recruitment/vacancies/')

export const createVacancy = (payload) =>
  client.post('/api/v1/recruitment/vacancies/', payload)

export const updateVacancy = (id, payload) =>
  client.patch(`/api/v1/recruitment/vacancies/${id}/`, payload)

// ── Dropdowns ────────────────────────────────────────────────
export const getBranchOptions = () =>
  client.get('/api/v1/organization/branches/dropdown/')

export const getRoleOptions = () =>
  client.get('/api/v1/accounts/roles/dropdown/')

// ── Public careers page link for a vacancy ───────────────────
// The website (farhat-web) shows each role at /careers/<id>-<title-slug>.
const WEBSITE = (import.meta.env.VITE_WEBSITE_URL || 'https://farhatprintingpress.com').replace(/\/$/, '')

export const slugify = (text) =>
  String(text || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export const careersUrl = (vacancy) => `${WEBSITE}/careers/${vacancy.id}-${slugify(vacancy.title)}`

// ── Applications ─────────────────────────────────────────────
export const getApplications = () =>
  client.get('/api/v1/recruitment/applications/')

export const getApplication = (id) =>
  client.get(`/api/v1/recruitment/applications/${id}/`)

// payload: { stage, q1_score…q5_score (1–5), general_comment }
export const screenApplication = (id, payload) =>
  client.post(`/api/v1/recruitment/applications/${id}/screen/`, payload)

// payload: { interview_scheduled_at, interview_location }
export const inviteToInterview = (id, payload) =>
  client.post(`/api/v1/recruitment/applications/${id}/invite/`, payload)

export const scoreInterview = (id, payload) =>
  client.post(`/api/v1/recruitment/applications/${id}/interview/`, payload)

// payload: { decision: 'HIRE' | 'REJECT', rejection_reason }
export const decideApplication = (id, payload) =>
  client.post(`/api/v1/recruitment/applications/${id}/decide/`, payload)

export const recordAcceptance = (id, accepted) =>
  client.post(`/api/v1/recruitment/applications/${id}/accept/`, { accepted })

// The CV, served by Django with the right file type. The access token rides in
// the address because an <iframe> can't send headers.
export const cvUrl = (id) =>
  `${client.defaults.baseURL}/api/v1/recruitment/applications/${id}/cv/?token=${encodeURIComponent(localStorage.getItem('access_token') || '')}`

// The new hire's onboarding form is a Django page on the API server
export const onboardingUrl = (token) => `${client.defaults.baseURL}/onboarding/${token}/`

export const CLASSIC_HR_URL = `${client.defaults.baseURL}/portal/hr/`
