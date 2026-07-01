const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export const SESSION_COOKIE_NAME = "clinic_session";

type SessionPayload = {
  id: string;
  createdAt: number;
};

function base64UrlEncode(value: string): string {
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value: string): string {
  const paddedValue = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  return atob(paddedValue.replaceAll("-", "+").replaceAll("_", "/"));
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );

  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return mismatch === 0;
}

export async function createSessionToken(secret: string): Promise<string> {
  const payload: SessionPayload = {
    id: crypto.randomUUID(),
    createdAt: Date.now()
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${await sign(encodedPayload, secret)}`;
}

export async function verifySessionToken(
  token: string,
  secret: string
): Promise<boolean> {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return false;
  }

  const expectedSignature = await sign(encodedPayload, secret);

  if (!safeCompare(expectedSignature, signature)) {
    return false;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    return Date.now() - payload.createdAt <= SESSION_MAX_AGE_SECONDS * 1000;
  } catch {
    return false;
  }
}

export function getSessionMaxAgeSeconds(): number {
  return SESSION_MAX_AGE_SECONDS;
}
