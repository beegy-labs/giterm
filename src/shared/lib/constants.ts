export const SSH_DEFAULT_PORT = 22;
export const MAX_PORT = 65535;
export const MAX_CONNECTIONS = 5;
export const MAX_SESSIONS = 5;
export const MAX_TUNNELS = 20;

export function isValidPort(value: string | number): boolean {
  const n = typeof value === "string" ? parseInt(value, 10) : value;
  return Number.isInteger(n) && n >= 1 && n <= MAX_PORT;
}
