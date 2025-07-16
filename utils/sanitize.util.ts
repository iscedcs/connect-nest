export function sanitize(input: string) {
  // Use regex to replace any character that is not a letter or a number
  const sanitized = input.replace(/[^a-zA-Z0-9]/g, '');

  // Convert the remaining string to uppercase
  return sanitized.toUpperCase();
}
