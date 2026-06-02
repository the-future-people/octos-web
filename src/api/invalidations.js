// src/api/invalidations.js
// Centralised invalidation map — single source of truth for what gets
// refreshed after each action. Import the relevant function into any
// mutation's onSuccess handler instead of scattering invalidateQueries
// calls across components.

// ── Job created (BM or Attendant → Cashier queue) ─────────────────────────────
export const invalidateAfterJobCreated = (queryClient) => {
  // BM views
  queryClient.invalidateQueries({ queryKey: ['todaySummary'] })
  queryClient.invalidateQueries({ queryKey: ['jobStats'] })
  queryClient.invalidateQueries({ queryKey: ['recentJobs'] })
  queryClient.invalidateQueries({ queryKey: ['jobs'] })
  // Attendant views
  queryClient.invalidateQueries({ queryKey: ['attendant-stats'] })
  queryClient.invalidateQueries({ queryKey: ['attendant-my-jobs-recent'] })
  queryClient.invalidateQueries({ queryKey: ['attendant-my-jobs'] })
  // Cashier — most critical: new job must appear in queue immediately
  queryClient.invalidateQueries({ queryKey: ['paymentQueue'] })
  queryClient.invalidateQueries({ queryKey: ['cashierSummary'] })
  queryClient.invalidateQueries({ queryKey: ['notifCount'] })
  queryClient.invalidateQueries({ queryKey: ['notifications'] })
}

// ── Payment confirmed (Cashier) ───────────────────────────────────────────────
export const invalidateAfterPaymentConfirmed = (queryClient) => {
  // Cashier views
  queryClient.invalidateQueries({ queryKey: ['paymentQueue'] })
  queryClient.invalidateQueries({ queryKey: ['cashierSummary'] })
  queryClient.invalidateQueries({ queryKey: ['shiftStatus'] })
  // BM views
  queryClient.invalidateQueries({ queryKey: ['todaySummary'] })
  queryClient.invalidateQueries({ queryKey: ['jobStats'] })
  queryClient.invalidateQueries({ queryKey: ['recentJobs'] })
  queryClient.invalidateQueries({ queryKey: ['jobs'] })
  // Attendant views
  queryClient.invalidateQueries({ queryKey: ['attendant-my-jobs'] })
  queryClient.invalidateQueries({ queryKey: ['attendant-my-jobs-recent'] })
  queryClient.invalidateQueries({ queryKey: ['notifCount'] })
  queryClient.invalidateQueries({ queryKey: ['notifications'] })
}

// ── Job transitioned (BM detail panel) ───────────────────────────────────────
export const invalidateAfterJobTransitioned = (queryClient, jobId) => {
  queryClient.invalidateQueries({ queryKey: ['job-detail', jobId] })
  queryClient.invalidateQueries({ queryKey: ['jobs'] })
  queryClient.invalidateQueries({ queryKey: ['jobStats'] })
  queryClient.invalidateQueries({ queryKey: ['recentJobs'] })
  queryClient.invalidateQueries({ queryKey: ['paymentQueue'] })
  queryClient.invalidateQueries({ queryKey: ['attendant-my-jobs'] })
  queryClient.invalidateQueries({ queryKey: ['attendant-my-jobs-recent'] })
  queryClient.invalidateQueries({ queryKey: ['notifCount'] })
  queryClient.invalidateQueries({ queryKey: ['notifications'] })
}

// ── Sheet closed (BM) ─────────────────────────────────────────────────────────
export const invalidateAfterSheetClosed = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: ['todaySummary'] })
  queryClient.invalidateQueries({ queryKey: ['lockStatus'] })
  queryClient.invalidateQueries({ queryKey: ['shiftStatus'] })
  queryClient.invalidateQueries({ queryKey: ['jobStats'] })
  queryClient.invalidateQueries({ queryKey: ['cashierSummary'] })
}

// ── Customer registered ───────────────────────────────────────────────────────
export const invalidateAfterCustomerRegistered = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: ['customers'] })
}

// ── Notifications bell ────────────────────────────────────────────────────────
export const invalidateNotifications = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: ['notifCount'] })
  queryClient.invalidateQueries({ queryKey: ['notifications'] })
}