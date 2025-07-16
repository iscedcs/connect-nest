export function isPlate(value: string): boolean {
  // Use a regular expression to check if the string contains both letters and numbers
  return /[a-zA-Z]/.test(value) && /\d/.test(value);
}

const plateNumberRegex = /[A-Z]{2,3}[0-9]{2,3}[A-Z]{2,3}/;

export function isValidPlate(value: string): boolean {
  return isPlate(value) && plateNumberRegex.test(value);
}


