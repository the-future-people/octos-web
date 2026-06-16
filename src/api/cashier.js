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
  client.get('/api/v1/finance/credit/')

export const settleCreditAccount = (accountId, payload) =>
  client.post(`/api/v1/finance/credit/${accountId}/settle/`, payload)

export const getCashierReceipts = (params) =>
  client.get('/api/v1/finance/cashier/receipts/', { params })
export const getNotifications = () =>
  client.get('/api/v1/notifications/')

export const getUnreadCount = () =>
  client.get('/api/v1/notifications/unread-count/')

export const markNotificationRead = (id) =>
  client.post(`/api/v1/notifications/${id}/read/`)

export const markAllNotificationsRead = () =>
  client.post('/api/v1/notifications/read-all/')