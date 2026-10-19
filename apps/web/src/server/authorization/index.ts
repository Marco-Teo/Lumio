export class AccessError extends Error {
  constructor(
    public readonly status: 401 | 403 | 404,
    message = 'Accesso non consentito',
  ) {
    super(message);
  }
}
