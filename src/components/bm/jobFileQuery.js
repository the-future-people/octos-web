// src/components/bm/jobFileQuery.js
// How a job's file is fetched, shared by the job page and the pages that open
// it. Kept apart from JobFile.jsx: a component file exports only components
// (fast refresh). Prefetching on hover makes the page open already filled (13 Nov 2026).

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import client from '../../api/client'
import { createInvoice, getJobInvoices, sendInvoice } from '../../api/bm'
import { saveFile } from '../../api/saveFile'

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

// Everything the job page does, shared by the computer's panel and the
// phone's page (18 Nov 2026): the file, its invoice, and the actions with a
// one-line note saying how each went.
export async function download(path, filename) {
  const { data } = await client.get(path, { responseType: 'blob' })
  await saveFile(filename, data)
}

export async function printReceipt(id) {
  const { data } = await client.get(`/api/v1/finance/receipts/${id}/thermal/`)
  const win = window.open('', '_blank', 'width=400,height=600')
  if (!win) return
  win.document.write(`<html><head><title>Receipt</title><style>body{font-family:'Courier New',monospace;font-size:12px;white-space:pre;margin:10px;}</style></head><body>${(data.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body></html>`)
  win.document.close(); win.focus(); win.print(); win.close()
}

export function useJobFile(jobId) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState({ text: '', bad: false })
  const say = (text, bad = false) => setNote({ text, bad })
  const fail = err => say(err?.response?.data?.detail || 'That did not work. Try again.', true)

  const { data: file, isLoading, error } = useQuery({ ...fileQuery(jobId), enabled: !!jobId })
  const { data: invData } = useQuery({ ...invoicesQuery(jobId), enabled: !!jobId })
  const invoices = Array.isArray(invData) ? invData : (invData?.results || [])

  const sendReceipt = useMutation({
    mutationFn: id => client.post(`/api/v1/finance/receipts/${id}/send-whatsapp/`),
    onSuccess: r => { say(r.data?.detail || 'Receipt sent on WhatsApp.'); queryClient.invalidateQueries({ queryKey: ['job-file', jobId] }) },
    onError: fail,
  })
  const makeInvoice = useMutation({
    mutationFn: () => createInvoice({
      job_id: jobId, invoice_type: 'PROFORMA', delivery_channel: 'DOWNLOAD',
      bill_to_name: file?.owner?.name || '', bill_to_phone: file?.owner?.phone || '',
      bill_to_email: '', bill_to_company: '', bm_note: '',
    }),
    onSuccess: () => { say('Invoice generated.'); queryClient.invalidateQueries({ queryKey: ['job-invoices', jobId] }) },
    onError: fail,
  })
  const sendInv = useMutation({
    mutationFn: id => sendInvoice(id),
    onSuccess: r => { say(r?.data?.detail || 'Invoice sent.'); queryClient.invalidateQueries({ queryKey: ['job-invoices', jobId] }) },
    onError: fail,
  })
  const remind = useMutation({
    mutationFn: () => client.post(`/api/v1/jobs/${jobId}/remind/`),
    onSuccess: r => { say(r.data?.detail || 'Reminder sent.'); queryClient.invalidateQueries({ queryKey: ['job-file', jobId] }) },
    onError: fail,
  })

  return { file, isLoading, error, invoice: invoices[0] || null, note, say, fail, sendReceipt, makeInvoice, sendInv, remind }
}
