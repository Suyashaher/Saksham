/**
 * Formats a monetary value in Indian Rupees (INR) with standard Lakh/Crore grouping.
 * Accepts string Decimal or number, formats without float precision loss.
 * E.g., "1250000" -> "₹12,50,000.00" or "₹12,50,000"
 */
export function formatINR(value: string | number | null | undefined, showDecimals: boolean = false): string {
  if (value === null || value === undefined || value === '') {
    return '₹0';
  }

  const rawStr = String(value).trim();
  const isNegative = rawStr.startsWith('-');
  const cleanStr = isNegative ? rawStr.slice(1) : rawStr;

  const parts = cleanStr.split('.');
  let integerPart = parts[0] || '0';
  let decimalPart = parts[1] || '';

  // Remove leading zeros unless it's just '0'
  integerPart = integerPart.replace(/^0+(?=\d)/, '');

  // Format integer part using Indian numbering system
  // Last 3 digits, then groups of 2 digits
  let lastThree = integerPart.slice(-3);
  const otherNumbers = integerPart.slice(0, -3);

  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }

  const formattedInteger =
    otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;

  let result = `₹${isNegative ? '-' : ''}${formattedInteger}`;

  if (showDecimals) {
    decimalPart = decimalPart.padEnd(2, '0').slice(0, 2);
    result += `.${decimalPart}`;
  } else if (decimalPart && decimalPart !== '00') {
    result += `.${decimalPart.slice(0, 2)}`;
  }

  return result;
}

/**
 * Formats an ISO date string to DD MMM YYYY in Asia/Kolkata timezone.
 * E.g., "2026-10-27T14:30:00Z" -> "27 Oct 2026"
 */
export function formatDateIST(dateStr: string | null | undefined, includeTime: boolean = false): string {
  if (!dateStr) return '—';

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '—';

    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      ...(includeTime
        ? {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          }
        : {}),
    };

    return new Intl.DateTimeFormat('en-IN', options).format(date);
  } catch {
    return String(dateStr);
  }
}

/**
 * Returns number of days remaining until maturityDate relative to today.
 * Negative number means expired/matured.
 */
export function getDaysRemaining(targetDateStr: string | null | undefined): number | null {
  if (!targetDateStr) return null;
  try {
    const target = new Date(targetDateStr);
    const today = new Date();
    // Normalize to midnight UTC for pure calendar day calculation
    const utcTarget = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
    const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const diffMs = utcTarget - utcToday;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

/**
 * Helper to display human-readable status labels.
 */
export function formatStatusLabel(status: string): string {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
