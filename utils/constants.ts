if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
export const jwtSecret = process.env.JWT_SECRET;
