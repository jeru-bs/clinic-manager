import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { GOOGLE_DRIVE_ROOT_FOLDER_ID } from "@/lib/google-workspace";

const tokenFilePath = join(process.cwd(), "work", "local-data", "google-token.json");

const scopes = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/spreadsheets"
];

type StoredGoogleToken = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  created_at: string;
};

export type GoogleConnectionStatus = {
  configured: boolean;
  connected: boolean;
  rootFolderId: string;
  connectedAt?: string;
  expiresAt?: string;
  scopes: string[];
};

export function hasGoogleOAuthConfig(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function getRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/google/callback`;
}

export function buildGoogleAuthorizationUrl(origin: string, state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");

  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID || "");
  url.searchParams.set("redirect_uri", getRedirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");

  return url.toString();
}

export async function exchangeCodeForTokens(
  origin: string,
  code: string
): Promise<StoredGoogleToken> {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    code,
    grant_type: "authorization_code",
    redirect_uri: getRedirectUri(origin)
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    throw new Error(`Google OAuth failed with status ${response.status}`);
  }

  const token = (await response.json()) as Omit<StoredGoogleToken, "created_at">;

  return {
    ...token,
    created_at: new Date().toISOString()
  };
}

async function readStoredGoogleToken(): Promise<StoredGoogleToken | null> {
  try {
    return JSON.parse(await readFile(tokenFilePath, "utf8")) as StoredGoogleToken;
  } catch {
    return null;
  }
}

function isTokenFresh(token: StoredGoogleToken): boolean {
  if (!token.expires_in) return true;

  const expiresAt = new Date(token.created_at).getTime() + token.expires_in * 1000;
  return expiresAt > Date.now() + 60_000;
}

async function refreshGoogleToken(
  token: StoredGoogleToken
): Promise<StoredGoogleToken | null> {
  if (!token.refresh_token || !hasGoogleOAuthConfig()) {
    return null;
  }

  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    grant_type: "refresh_token",
    refresh_token: token.refresh_token
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    return null;
  }

  const refreshed = (await response.json()) as Omit<
    StoredGoogleToken,
    "created_at" | "refresh_token"
  >;
  const nextToken: StoredGoogleToken = {
    ...token,
    ...refreshed,
    refresh_token: token.refresh_token,
    created_at: new Date().toISOString()
  };

  await writeGoogleToken(nextToken);
  return nextToken;
}

export async function getGoogleAccessToken(): Promise<string | null> {
  const token = await readStoredGoogleToken();

  if (!token) {
    return null;
  }

  if (isTokenFresh(token)) {
    return token.access_token;
  }

  const refreshed = await refreshGoogleToken(token);
  return refreshed?.access_token || token.access_token;
}

export async function writeGoogleToken(token: StoredGoogleToken): Promise<void> {
  await mkdir(dirname(tokenFilePath), { recursive: true });
  await writeFile(tokenFilePath, `${JSON.stringify(token, null, 2)}\n`, "utf8");
}

export async function clearGoogleToken(): Promise<void> {
  await rm(tokenFilePath, { force: true });
}

export async function getGoogleConnectionStatus(): Promise<GoogleConnectionStatus> {
  const token = await readStoredGoogleToken();
  const createdAt = token?.created_at;
  const expiresAt =
    createdAt && token.expires_in
      ? new Date(new Date(createdAt).getTime() + token.expires_in * 1000).toISOString()
      : undefined;

  return {
    configured: hasGoogleOAuthConfig(),
    connected: Boolean(token?.access_token),
    rootFolderId: GOOGLE_DRIVE_ROOT_FOLDER_ID,
    connectedAt: createdAt,
    expiresAt,
    scopes
  };
}
