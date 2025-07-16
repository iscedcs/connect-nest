export function isvCode(value: string): boolean {
  // Check if the string starts with T and has 11 to 13 digits
  if (/^V\d{11,13}$/i.test(value)) {
    return true;
  }

  // Check if the string starts with U and has 5 to 8 digits
  if (/^U\d{5,8}$/i.test(value)) {
    return true;
  }

  return false;
}
