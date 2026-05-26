// src/api/cashier.js
import client from './client'

export const getShiftStatus = () =>
  client.get('/api/v1/finance/cashier/shift-status/')

export const getPaymentQueue = () =>
  client.get('/api/v1/jobs/cashier/queue/')

export const getCashierSummary = () =>
  client.get('/api/v1/jobs/cashier/summary/')

export const confirmPayment = (jobId, payload) =>
  client.post(`/api/v1/jobs/${jobId}/cashier/confirm/`, payload)

export const getReceipts = (params) =>
  client.get('/api/v1/finance/receipts/', { params })

export const getCreditAccounts = () =>
  client.get('/api/v1/finance/credit-accounts/')

export const settleCreditAccount = (accountId, payload) =>
  client.post(`/api/v1/finance/credit-accounts/${accountId}/settle/`, payload)
