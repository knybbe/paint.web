import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** 44px icon tools (Play / Split class). */
export const TOOLBAR_BTN =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md p-0 leading-none";

/** 32px header / card icon. */
export const ICON_BTN =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md p-0 leading-none";

/** Solid primary. Sits in the header. */
export const PRIMARY_BTN =
  "inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-primary px-3 text-sm font-semibold leading-none text-primary-foreground disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-transparent disabled:text-foreground/40 disabled:opacity-100";

