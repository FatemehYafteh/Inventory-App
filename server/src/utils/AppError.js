export class AppError extends Error {
  /**
   * `errors` holds field-level validation messages. `details` holds safe, structured facts the
   * client may read (such as reference counts); only services build it, from values they computed.
   * `errorCodes` maps each field of `errors` to a stable message code (validation only).
   */
  constructor(status, code, message, errors, details, errorCodes) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.errors = errors;
    this.details = details;
    this.errorCodes = errorCodes;
  }
}
