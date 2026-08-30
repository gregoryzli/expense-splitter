// Currency is a per-group label (set when the group is created, agreed on
// by whoever's in it) -- not a personal/profile-wide preference, and not
// something the API tracks as a real currency. Nothing converts between
// currencies or verifies amounts were actually entered in this unit; it
// just picks which symbol/formatting Intl.NumberFormat applies. Defaults
// to USD for anywhere a group's currency isn't available (e.g. before a
// group has loaded).
export function formatCurrency(amount, currency = "USD") {
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
