// src/api/eye.js
// The Eye of Agamotto: the owner's view. Owner-only, read-only.
import client from './client'

const get = (path, params) => client.get(`/api/v1/eye/${path}/`, { params }).then(r => r.data)

export const eyeMe       = () => get('me')
export const eyeOverview = (p) => get('overview', p)
export const eyePeople   = (p) => get('people', p)
export const eyePerson   = (id, p) => get(`people/${id}`, p)
export const eyeMoney    = (p) => get('money', p)
export const eyeJobs     = (p) => get('jobs', p)
export const eyeJob      = (id) => get(`jobs/${id}`)
export const eyeMachines = (p) => get('machines', p)
export const eyeMachine  = (id, p) => get(`machines/${id}`, p)
export const eyeStock    = (p) => get('inventory', p)
export const eyeCustomers = (p) => get('customers', p)
export const eyeCustomer = (id) => get(`customers/${id}`)
export const eyeOnline   = (p) => get('online', p)
export const eyeApp      = (p) => get('app', p)
export const eyeHealth   = () => get('health')
