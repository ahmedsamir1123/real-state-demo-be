export class AppError extends Error {
    constructor(message: string, public statusCode: number) { super(message); }
}

export class conflictException extends AppError {
    constructor(message: string) { super(message, 409); }
}

export class NotAuthException extends AppError {
    constructor(message: string) { super(message, 401); }
}

export class NotFoundException extends AppError {
    constructor(message: string) { super(message, 404); }
}
export class BadRequestException extends AppError {
    constructor(message: string) { super(message, 400); }
}