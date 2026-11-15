// src/api/profile.js
// Staff profiles (15 Nov 2026): your own, and the Branch Manager's view of his staff.
import client from './client'

const photoForm = (file) => {
  const form = new FormData()
  form.append('photo', file, 'photo.jpg')
  return form
}

export const getProfile   = (period = 'week') => client.get('/api/v1/accounts/profile/', { params: { period } }).then(r => r.data)
export const savePhone    = (phone) => client.patch('/api/v1/accounts/profile/', { phone }).then(r => r.data)
export const uploadPhoto  = (file) => client.post('/api/v1/accounts/profile/photo/', photoForm(file)).then(r => r.data)
export const removePhoto  = () => client.delete('/api/v1/accounts/profile/photo/').then(r => r.data)

export const getStaffCards     = (period = 'week') => client.get('/api/v1/accounts/staff/', { params: { period } }).then(r => r.data)
export const saveStaffPhone    = (id, phone) => client.patch(`/api/v1/accounts/staff/${id}/`, { phone }).then(r => r.data)
export const uploadStaffPhoto  = (id, file) => client.post(`/api/v1/accounts/staff/${id}/photo/`, photoForm(file)).then(r => r.data)
export const removeStaffPhoto  = (id) => client.delete(`/api/v1/accounts/staff/${id}/photo/`).then(r => r.data)

// A photo shrunk in the browser before it goes up (at most 800px, JPEG), so
// a 6 MB phone photo uploads quickly on a slow connection. The server turns
// it upright and makes the final 600px copy.
export async function shrinkPhoto(file, side = 800) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise(done => canvas.toBlob(done, 'image/jpeg', 0.88))
    return blob || file
  } catch {
    return file   // an odd format the browser can't draw: send it as it is
  }
}

// The words to show when the server refuses a change.
export const refusal = (err) => err?.response?.data?.detail || "That didn't save. Try again."
