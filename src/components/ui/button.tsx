"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * The only three button styles in the application. `primary` is the single brand-green
 * fill; `secondary` is outlined; `ghost` has neither fill nor border.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost";

export function Button({ variant = "secondary", className = "", children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; children: ReactNode }) {
  return <button type="button" {...rest} className={`btn btn-${variant} ${className}`.trim()}>{children}</button>;
}
