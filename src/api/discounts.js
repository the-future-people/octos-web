// src/api/discounts.js
//
// Costs and discounts (17 Nov 2026): what things cost, bulk prices, and a
// price lowered on a proforma or a job by the Branch Manager or the owner.
import client from './client'

// kind is 'job' or 'proforma'
export const getDiscount = (kind, id) =>
  client.get('/api/v1/jobs/discounts/', { params: { [kind]: id } }).then(r => r.data)
export const lowerPrice = (kind, id, newTotal, reason) =>
  client.post('/api/v1/jobs/discounts/', { [kind]: id, new_total: newTotal, reason }).then(r => r.data)

export const getWaitingCuts = () => client.get('/api/v1/jobs/discounts/waiting/').then(r => r.data)
export const approveCut = id => client.post(`/api/v1/jobs/discounts/${id}/approve/`).then(r => r.data)
export const declineCut = (id, note) => client.post(`/api/v1/jobs/discounts/${id}/decline/`, { note }).then(r => r.data)

export const getCosts = () => client.get('/api/v1/jobs/costs/').then(r => r.data)
export const saveCosts = data => client.put('/api/v1/jobs/costs/', data).then(r => r.data)
export const saveServiceCost = (id, data) => client.patch(`/api/v1/jobs/services/${id}/cost/`, data).then(r => r.data)
export const saveBulkPrices = (ruleId, bands) =>
  client.patch(`/api/v1/jobs/pricing/${ruleId}/`, { bulk_prices: bands }).then(r => r.data)

// The owner decides prices below the floor; the Branch Manager lowers within it.
export const isOwner = user =>
  !!(user?.is_business_owner || user?.can_generate_branch_statement || user?.role_name === 'SUPER_ADMIN')
export const mayDiscount = user => isOwner(user) || user?.role_name === 'BRANCH_MANAGER'
