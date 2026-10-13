export class AppError extends Error {
  constructor(status, code, message, errors) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}
