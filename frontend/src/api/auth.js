import client from './client'

export const login = (email, password) =>
  client.post('/auth/token/', { email, password })

export const logout = (refresh) =>
  client.post('/auth/token/logout/', { refresh })

export const refreshToken = (refresh) =>
  client.post('/auth/token/refresh/', { refresh })

export const getMe = () => client.get('/auth/me/')
export const updateMe = (data) => client.patch('/auth/me/', data)
export const changePassword = (data) => client.post('/auth/me/password/', data)

export const setup2FA = () => client.get('/auth/2fa/setup/')
export const enable2FA = (otp) => client.post('/auth/2fa/setup/', { otp })
export const verify2FA = (otp) => client.post('/auth/2fa/verify/', { otp })

export const getUsers = (params) => client.get('/auth/users/', { params })
export const createUser = (data) => client.post('/auth/users/', data)
export const updateUser = (id, data) => client.patch(`/auth/users/${id}/`, data)
export const suspendUser = (id) => client.post(`/auth/users/${id}/suspend/`)
export const reactivateUser = (id) => client.post(`/auth/users/${id}/reactivate/`)

export const getDepartments = () => client.get('/auth/departments/')

export const getDelegation = () => client.get('/auth/delegation/')
export const setDelegation = (data) => client.post('/auth/delegation/', data)
export const removeDelegation = () => client.delete('/auth/delegation/')
