export function shortId(value: string): string {
  return value.slice(0, 8);
}

export function formatPrice(value: number): string {
  if (Number.isInteger(value)) {
    return `${value}\u20bd`;
  }
  return `${value.toFixed(2)}\u20bd`;
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ru-RU");
}
