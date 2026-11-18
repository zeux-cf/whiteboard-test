import type { BoardElement, BoardRole } from '../shared/model'

export type { BoardRole } from '../shared/model'
export type InviteRole = Exclude<BoardRole, 'owner'>

export interface BoardSummary {
  id: string
  title: string
  role: BoardRole
  updatedAt: string
  preview?: BoardElement[]
}

export interface ShareAccess {
  members: Array<{ id: string; name: string; role: BoardRole }>
  invites: Array<{ id: string; role: InviteRole; createdAt: string }>
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    const { error } = await response.json().catch(() => ({})) as { error?: string }
    throw new ApiError(error ?? 'The request could not be completed.', response.status)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

const boardPath = (id: string) => `/boards/${encodeURIComponent(id)}`
export const boardUrl = boardPath

export const api = {
  config: () => request<{ googleEnabled: boolean }>('/config'),
  list: () => request<{ boards: BoardSummary[] }>('/boards'),
  create: () => request<{ board: BoardSummary }>('/boards', 'POST', {}),
  board: (id: string) => request<{ board: BoardSummary }>(boardPath(id)),
  rename: (id: string, title: string) => request<{ board: BoardSummary }>(boardPath(id), 'PATCH', { title }),
  remove: (id: string) => request<void>(boardPath(id), 'DELETE'),
  access: (id: string) => request<ShareAccess>(`${boardPath(id)}/access`),
  invite: (id: string, role: InviteRole) =>
    request<{ invite: ShareAccess['invites'][number]; url: string }>(`${boardPath(id)}/invites`, 'POST', { role }),
  revokeInvite: (id: string, inviteId: string) =>
    request<void>(`${boardPath(id)}/invites/${encodeURIComponent(inviteId)}`, 'DELETE'),
  revokeMember: (id: string, userId: string) =>
    request<void>(`${boardPath(id)}/members/${encodeURIComponent(userId)}`, 'DELETE'),
  redeem: (token: string) =>
    request<{ board: BoardSummary }>(`/invites/${encodeURIComponent(token)}`, 'POST', {}),
}

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong.'
