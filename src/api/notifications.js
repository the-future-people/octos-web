import client from './client'

export const getNotifications         = () => client.get('/api/v1/notifications/')
export const getUnreadCount           = () => client.get('/api/v1/notifications/unread-count/')
export const markNotificationRead     = (id) => client.post(`/api/v1/notifications/${id}/read/`)
export const markAllNotificationsRead = () => client.post('/api/v1/notifications/read-all/')