export class HttpError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}
