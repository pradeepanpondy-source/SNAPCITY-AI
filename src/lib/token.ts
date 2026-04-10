/** Generates a unique Snap City report token in format: SC-YYYY-XXXXXXXX */
export function generateToken(): string {
  const year = new Date().getFullYear();
  // Generate 8 random hex characters for uniqueness
  const hex = Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 16).toString(16).toUpperCase()
  ).join('');
  return `SC-${year}-${hex}`;
}
