// src/api/bm.js
// All BM portal API calls — single source of truth.

import client from './client'

// ── Sheet & Finance ───────────────────────────────────────────────
export const getTodaySummary  = () =>
  client.get('/api/v1/finance/sheets/today/summary/')

export const getLockStatus    = () =>
  client.get('/api/v1/finance/lock-status/')

export const closeSheet       = (sheetId, payload) =>
  client.post(`/api/v1/finance/sheets/${sheetId}/close/`, payload, { timeout: 30000 })

export const getSheetSummary  = (sheetId) =>
  client.get(`/api/v1/finance/sheets/${sheetId}/summary/`)

// ── Jobs ──────────────────────────────────────────────────────────
export const getJobs          = (params) =>
  client.get('/api/v1/jobs/', { params })

export const getJobStats      = (params) =>
  client.get('/api/v1/jobs/stats/', { params })

export const getWorkload      = () =>
  client.get('/api/v1/jobs/workload/')

export const getEODPrediction = () =>
  client.get('/api/v1/analytics/prediction/')

export const downloadBranchStatement = (dateFrom, dateTo) =>
  client.get('/api/v1/finance/branch-statement/', {
    params: { date_from: dateFrom, date_to: dateTo },
    responseType: 'blob',
  })

export const markSheetDisrupted = (sheetId, payload) =>
  client.post(`/api/v1/finance/sheets/${sheetId}/mark-disrupted/`, payload)

export const reportMissingDayDisruption = (payload) =>
  client.post('/api/v1/finance/sheets/report-disruption/', payload)

export const approveDisruption = (sheetId) =>
  client.post(`/api/v1/finance/sheets/${sheetId}/approve-disruption/`)

export const rejectDisruption = (sheetId, rejectionReason) =>
  client.post(`/api/v1/finance/sheets/${sheetId}/reject-disruption/`, {
    rejection_reason: rejectionReason,
  })

export const getJobDetail     = (jobId) =>
  client.get(`/api/v1/jobs/${jobId}/`)

export const transitionJob    = (jobId, payload) =>
  client.post(`/api/v1/jobs/${jobId}/transition/`, payload)

export const createJob        = (payload) =>
  client.post('/api/v1/jobs/create/', payload)

export const getServices      = () =>
  client.get('/api/v1/jobs/services/')

export const calculatePrice   = (params) =>
  client.get('/api/v1/jobs/price/calculate/', { params })

export const getBulkPricing   = (branchId) =>
  client.get('/api/v1/jobs/price/bulk/', { params: { branch: branchId } })

export const createLateJob    = (payload) =>
  client.post('/api/v1/jobs/late/', payload)

// ── Customers ─────────────────────────────────────────────────────
export const getCustomers     = (params) =>
  client.get('/api/v1/customers/', { params })

export const getCustomerDetail = (pk) =>
  client.get(`/api/v1/customers/${pk}/`)

export const createCustomer   = (payload) =>
  client.post('/api/v1/customers/create/', payload)

export const lookupCustomer   = (params) =>
  client.get('/api/v1/customers/lookup/', { params })

// ── Staff ─────────────────────────────────────────────────────────
export const getStaff         = () =>
  client.get('/api/v1/accounts/users/')

// ── Inventory ─────────────────────────────────────────────────────
export const getStock         = () =>
  client.get('/api/v1/inventory/stock/')

export const receiveStock     = (payload) =>
  client.post('/api/v1/inventory/stock/receive/', payload)

export const getStockMovements = (params) =>
  client.get('/api/v1/inventory/movements/', { params })

// ── Communications (Inbox) ────────────────────────────────────────
export const getInbox         = (params) =>
  client.get('/api/v1/communications/', { params })

export const replyToMessage   = (pk, payload) =>
  client.post(`/api/v1/communications/${pk}/reply/`, payload)

// ── Reports ───────────────────────────────────────────────────────
export const getWeeklyReports = () =>
  client.get('/api/v1/finance/weekly/')

export const getMonthlyClose  = () =>
  client.get('/api/v1/finance/monthly-close/')

// ── Notifications ─────────────────────────────────────────────────
export const getNotifications     = () =>
  client.get('/api/v1/notifications/')

export const getUnreadCount       = () =>
  client.get('/api/v1/notifications/unread-count/')

export const markNotificationRead = (id) =>
  client.post(`/api/v1/notifications/${id}/read/`)

export const markAllNotificationsRead = () =>
  client.post('/api/v1/notifications/read-all/')

// ── Receipts ──────────────────────────────────────────────────────
export const getJobReceipt        = (jobId, params = {}) =>
  client.get('/api/v1/finance/receipts/', { params: jobId ? { job: jobId, ...params } : params })

export const sendReceiptWhatsApp  = (receiptId) =>
  client.post(`/api/v1/finance/receipts/${receiptId}/send-whatsapp/`)

// ── Invoices ──────────────────────────────────────────────────────
export const getJobInvoices       = (jobId) =>
  client.get('/api/v1/finance/invoices/', { params: { job: jobId } })

export const createInvoice        = (payload) =>
  client.post('/api/v1/finance/invoices/create/', payload)

export const sendInvoice          = (invoiceId) =>
  client.post(`/api/v1/finance/invoices/${invoiceId}/send/`)

export const getInvoicePdfUrl     = (invoiceId) =>
  `/api/v1/finance/invoices/${invoiceId}/pdf/`