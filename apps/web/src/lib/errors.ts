/** An expected problem with a request (bad input, clash, limit...), shown to the user with an HTTP status. */
export class BookingError extends Error {
  constructor(message: string, readonly status: number = 400) {
    super(message);
  }
}
