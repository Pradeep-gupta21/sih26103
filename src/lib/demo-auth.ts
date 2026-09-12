import { useEffect, useState } from "react";

export const DEMO_CREDENTIALS = {
  email: "admin@paimana.gov.in",
  password: "paimana2026",
} as const;

const SESSION_KEY = "paimana-demo-authenticated";
const SESSION_EMAIL_KEY = "paimana-demo-email";
const DEFAULT_DISPLAY_NAME = "Admin";

export function isDemoAuthenticated(): boolean {
  return typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY) === "true";
}

export function startDemoSession(email: string): void {
  sessionStorage.setItem(SESSION_KEY, "true");
  sessionStorage.setItem(SESSION_EMAIL_KEY, email.trim());
}

export function endDemoSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_EMAIL_KEY);
}

export function getDemoDisplayName(): string {
  if (typeof window === "undefined") return DEFAULT_DISPLAY_NAME;
  const email = sessionStorage.getItem(SESSION_EMAIL_KEY)?.trim();
  if (!email) return DEFAULT_DISPLAY_NAME;
  const separator = email.indexOf("@");
  return separator > 0 ? email.slice(0, separator) : DEFAULT_DISPLAY_NAME;
}

export function getDemoEmail(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(SESSION_EMAIL_KEY)?.trim() ?? "";
}

export function useDemoDisplayName(): string {
  const [displayName, setDisplayName] = useState(DEFAULT_DISPLAY_NAME);

  useEffect(() => {
    setDisplayName(getDemoDisplayName());
  }, []);

  return displayName;
}

export function useDemoEmail(): string {
  const [email, setEmail] = useState("");

  useEffect(() => {
    setEmail(getDemoEmail());
  }, []);

  return email;
}
