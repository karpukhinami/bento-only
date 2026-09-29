import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

/** Scopes used when obtaining the refresh token (Drive + Sheets). */
export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
] as const;

function oauthEnv() {
  return {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID?.trim(),
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim(),
    refreshToken: process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim(),
  };
}

export function isGoogleArchiveConfigured(): boolean {
  const { clientId, clientSecret, refreshToken } = oauthEnv();
  return Boolean(clientId && clientSecret && refreshToken);
}

/** OAuth2 client for Drive and Sheets (personal Google account via refresh token). */
export function getGoogleAuth(): OAuth2Client {
  const { clientId, clientSecret, refreshToken } = oauthEnv();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Google OAuth не настроен: задайте GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET и GOOGLE_OAUTH_REFRESH_TOKEN",
    );
  }

  const client = new google.auth.OAuth2(clientId, clientSecret);
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}
