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
