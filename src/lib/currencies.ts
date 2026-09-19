import { z } from "zod";

// Curated list, not the ~150+ entries Intl.supportedValuesOf("currency") would
// give us — each entry carries an explicit display symbol, which Intl does
// not, and a currency an owner picks here always resolves to a real one.
export const currencyOptions = [
  { value: "EUR", label: "Euro (EUR €)", name: "Euro", symbol: "€" },
  { value: "USD", label: "US Dollar (USD $)", name: "US Dollar", symbol: "$" },
  { value: "GBP", label: "British Pound (GBP £)", name: "British Pound", symbol: "£" },
  { value: "AED", label: "UAE Dirham (AED د.إ)", name: "UAE Dirham", symbol: "د.إ" },
  { value: "AUD", label: "Australian Dollar (AUD A$)", name: "Australian Dollar", symbol: "A$" },
  { value: "BGN", label: "Bulgarian Lev (BGN лв)", name: "Bulgarian Lev", symbol: "лв" },
  { value: "BRL", label: "Brazilian Real (BRL R$)", name: "Brazilian Real", symbol: "R$" },
  { value: "CAD", label: "Canadian Dollar (CAD C$)", name: "Canadian Dollar", symbol: "C$" },
  { value: "CHF", label: "Swiss Franc (CHF)", name: "Swiss Franc", symbol: "CHF" },
  { value: "CNY", label: "Chinese Yuan (CNY ¥)", name: "Chinese Yuan", symbol: "¥" },
  { value: "CZK", label: "Czech Koruna (CZK Kč)", name: "Czech Koruna", symbol: "Kč" },
  { value: "DKK", label: "Danish Krone (DKK kr)", name: "Danish Krone", symbol: "kr" },
  { value: "HKD", label: "Hong Kong Dollar (HKD HK$)", name: "Hong Kong Dollar", symbol: "HK$" },
  { value: "HUF", label: "Hungarian Forint (HUF Ft)", name: "Hungarian Forint", symbol: "Ft" },
  { value: "IDR", label: "Indonesian Rupiah (IDR Rp)", name: "Indonesian Rupiah", symbol: "Rp" },
  { value: "ILS", label: "Israeli New Shekel (ILS ₪)", name: "Israeli New Shekel", symbol: "₪" },
  { value: "INR", label: "Indian Rupee (INR ₹)", name: "Indian Rupee", symbol: "₹" },
  { value: "JPY", label: "Japanese Yen (JPY ¥)", name: "Japanese Yen", symbol: "¥" },
  { value: "KRW", label: "South Korean Won (KRW ₩)", name: "South Korean Won", symbol: "₩" },
  { value: "MXN", label: "Mexican Peso (MXN MX$)", name: "Mexican Peso", symbol: "MX$" },
  { value: "MYR", label: "Malaysian Ringgit (MYR RM)", name: "Malaysian Ringgit", symbol: "RM" },
  { value: "NOK", label: "Norwegian Krone (NOK kr)", name: "Norwegian Krone", symbol: "kr" },
  {
    value: "NZD",
    label: "New Zealand Dollar (NZD NZ$)",
    name: "New Zealand Dollar",
    symbol: "NZ$",
  },
  { value: "PHP", label: "Philippine Peso (PHP ₱)", name: "Philippine Peso", symbol: "₱" },
  { value: "PLN", label: "Polish Złoty (PLN zł)", name: "Polish Złoty", symbol: "zł" },
  { value: "RON", label: "Romanian Leu (RON lei)", name: "Romanian Leu", symbol: "lei" },
  { value: "SEK", label: "Swedish Krona (SEK kr)", name: "Swedish Krona", symbol: "kr" },
  { value: "SGD", label: "Singapore Dollar (SGD S$)", name: "Singapore Dollar", symbol: "S$" },
  { value: "THB", label: "Thai Baht (THB ฿)", name: "Thai Baht", symbol: "฿" },
  { value: "TRY", label: "Turkish Lira (TRY ₺)", name: "Turkish Lira", symbol: "₺" },
  { value: "UAH", label: "Ukrainian Hryvnia (UAH ₴)", name: "Ukrainian Hryvnia", symbol: "₴" },
  { value: "VND", label: "Vietnamese Đồng (VND ₫)", name: "Vietnamese Đồng", symbol: "₫" },
  { value: "ZAR", label: "South African Rand (ZAR R)", name: "South African Rand", symbol: "R" },
] as const;

const CURRENCY_CODES = currencyOptions.map((option) => option.value) as [string, ...string[]];

export const currencyCodeSchema = z.enum(CURRENCY_CODES);

export type CurrencyCode = (typeof currencyOptions)[number]["value"];

const CURRENCY_BY_CODE = new Map(currencyOptions.map((option) => [option.value, option]));

// organization_settings.currency has only a loose DB check (3 uppercase
// letters), so a value stored before the curated list changes -- or added
// directly in the database -- may not be in CURRENCY_BY_CODE. Falling back to
// EUR keeps callers from having to handle "unknown currency" themselves.
export function resolveCurrency(code: string): { code: string; name: string; symbol: string } {
  const match = CURRENCY_BY_CODE.get(code as CurrencyCode);
  if (!match) return { code: "EUR", name: "Euro", symbol: "€" };
  return { code: match.value, name: match.name, symbol: match.symbol };
}
