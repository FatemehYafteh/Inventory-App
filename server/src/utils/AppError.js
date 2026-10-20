export class AppError extends Error {
  /**
   * `errors` holds field-level validation messages. `details` holds safe, structured facts the
   * client may read (such as reference counts); only services build it, from values they computed.
   */
  constructor(status, code, message, errors, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.errors = errors;
    this.details = details;
  }
}
