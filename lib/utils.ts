import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function currencyFromCents(cents: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2
  }).format(cents / 100);
}

export function currencyFromPrice(price: unknown) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2
  }).format(normalizeCurrencyNumber(price));
}

export function normalizeCurrencyNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Number(value.toFixed(2));
  const cleaned = String(value ?? "")
    .trim()
    .replace(/[£,\s]/g, "");
  if (!/^\d*(\.\d{0,2})?$/.test(cleaned) || cleaned === "" || cleaned === ".") return 0;
  return Number(Number(cleaned).toFixed(2));
}

export function normalizeCurrencyString(value: unknown) {
  const normalized = normalizeCurrencyNumber(value);
  return Number.isInteger(normalized)
    ? String(normalized)
    : String(normalized).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

export function safeText(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

export function humanize(value: unknown, fallback = "Unknown") {
  const text = safeText(value, fallback).trim();
  if (!text) return fallback;
  return text.replace(/_/g, " ");
}

export function safeLower(value: unknown) {
  return safeText(value).toLowerCase();
}

export function safeUpper(value: unknown) {
  return safeText(value).toUpperCase();
}

export function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export function safeDate(value: unknown) {
  const date = new Date(safeText(value));
  return Number.isNaN(date.getTime()) ? null : date;
}
