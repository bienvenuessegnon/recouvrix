const currencyFormatterCache = new Map<string, Intl.NumberFormat>();

export function formatCurrency(amount: number, currency = 'XOF'): string {
  if (currency === 'XOF') {
    const integerFormatter = currencyFormatterCache.get('XOF_INT') ??
      new Intl.NumberFormat('fr-FR', {
        maximumFractionDigits: 0,
      });
    currencyFormatterCache.set('XOF_INT', integerFormatter);
    return `${integerFormatter.format(Math.round(amount))} FCFA`;
  }

  let formatter = currencyFormatterCache.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    currencyFormatterCache.set(currency, formatter);
  }
  return formatter.format(amount);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value);
}

export function formatDate(dateInput: Date | string): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) {
    return 'Date invalide';
  }
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(dateInput: Date | string): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) {
    return 'Date invalide';
  }
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDelayDays(days: number): string {
  if (days <= 0) {
    return 'À échoir';
  }
  return days === 1 ? '1 jour de retard' : `${formatNumber(days)} jours de retard`;
}
