export function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getAppName(): string {
  return process.env.NEXT_PUBLIC_APP_NAME || "ניהול קליניקה";
}
