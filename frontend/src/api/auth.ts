import client from './client'
import type { User } from '@/types/api'

export interface LoginResponse {
  access: string
  refresh: string
  requires2fa: boolean
  requires_2fa?: boolean
  role: string
}

export const login = (email: string, password: string) =>
  client.post<LoginResponse>('/auth/token/', { email, password })

export const logout = (refresh: string) => client.post('/auth/token/logout/', { refresh })

export const getMe = () => client.get<User>('/auth/me/')
export const updateMe = (data: Partial<User>) => client.patch<User>('/auth/me/', data)
export const changePassword = (data: { oldPassword: string; newPassword: string }) =>
  client.post('/auth/me/password/', data)

export const setup2FA = () => client.get<{ qrCode: string; secret: string }>('/auth/2fa/setup/')
export const enable2FA = (otp: string) => client.post('/auth/2fa/setup/', { otp })
export const verify2FA = (otp: string) =>
  client.post<{ access: string; refresh: string }>('/auth/2fa/verify/', { otp })

export const getUsers = (params?: Record<string, string>) =>
  client.get('/auth/users/', { params })
export const createUser = (data: Record<string, unknown>) => client.post('/auth/users/', data)
export const updateUser = (id: number, data: Record<string, unknown>) =>
  client.patch(`/auth/users/${id}/`, data)
export const suspendUser = (id: number) => client.post(`/auth/users/${id}/suspend/`)
export const reactivateUser = (id: number) => client.post(`/auth/users/${id}/reactivate/`)

export const getDepartments = () => client.get('/auth/departments/')

export const getDelegation = () => client.get('/auth/delegation/')
export const setDelegation = (data: Record<string, unknown>) => client.post('/auth/delegation/', data)
export const removeDelegation = () => client.delete('/auth/delegation/')

export const authApi = {
  login,
  logout,
  getMe,
  updateMe,
  changePassword,
  setup2FA,
  enable2FA,
  verify2FA,
  getUsers,
  createUser,
  updateUser,
  suspendUser,
  reactivateUser,
  getDepartments,
  getDelegation,
  setDelegation,
  removeDelegation,
}
