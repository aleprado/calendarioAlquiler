export class ServiceError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export const isServiceError = (error: unknown): error is ServiceError =>
  error instanceof ServiceError && typeof error.status === 'number'
