export const CURRENCY_STORAGE_KEY = "splitpay:currency-display";

// Every amount the API returns is USD (see docs/ARCHITECTURE.md) -- this
// only swaps the displayed symbol/formatting per the Settings page
// preference, it does not convert the underlying value.
export function formatCurrency(amount) {
  const currency = localStorage.getItem(CURRENCY_STORAGE_KEY) || "USD";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function initial(name) {
  return name ? name.charAt(0).toUpperCase() : "?";
}

export function memberCountLabel(count) {
  return `${count} member${count === 1 ? "" : "s"}`;
}
