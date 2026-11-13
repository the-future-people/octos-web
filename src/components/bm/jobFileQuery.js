// src/components/bm/jobFileQuery.js
// How a job's file is fetched, shared by the job page and the pages that open
// it. Kept apart from JobFile.jsx: a component file exports only components
// (fast refresh). Prefetching on hover makes the page open already filled (13 Nov 2026).

import { useQueryClient } from '@tanstack/react-query'
import client from '../../api/client'
import { getJobInvoices } from '../../api/bm'

export const FRESH = 30_000

export const fileQuery = id => ({
  queryKey: ['job-file', id],
  queryFn: () => client.get(`/api/v1/jobs/${id}/file/`).then(r => r.data),
  staleTime: FRESH,
})

export const invoicesQuery = id => ({
  queryKey: ['job-invoices', id],
  queryFn: () => getJobInvoices(id).then(r => r.data),
  staleTime: FRESH,
})

export function usePrefetchJobFile() {
  const queryClient = useQueryClient()
  return id => {
    if (!id) return
    queryClient.prefetchQuery(fileQuery(id))
    queryClient.prefetchQuery(invoicesQuery(id))
  }
}
