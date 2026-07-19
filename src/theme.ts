const PROFILE_COLORS = [
  "linear-gradient(135deg, #3a72f2, #2450c8)",
  "linear-gradient(135deg, #f2c025, #d99a10)",
  "linear-gradient(135deg, #40b38c, #1f8f6a)",
  "linear-gradient(135deg, #e64d59, #c22d3a)",
  "linear-gradient(135deg, #a666e6, #7a3fce)",
  "linear-gradient(135deg, #f28c33, #d96a15)",
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function profileColor(id: string): string {
  return PROFILE_COLORS[hashString(id) % PROFILE_COLORS.length];
}
