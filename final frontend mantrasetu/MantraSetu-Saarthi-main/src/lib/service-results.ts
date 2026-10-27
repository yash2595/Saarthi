export function localDateInputValue(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function hasCalculatedChart(data: { houses?: { sign?: string; planets?: string[] }[] }): boolean {
  return Boolean(data.houses?.some(house => house.sign || house.planets?.length));
}

export function serviceErrorMessage(data: { status?: string; detail?: unknown; message?: string }): string | null {
  if (data.status === 'configuration_required') {
    return 'This service is temporarily unavailable. Please try again later.';
  }
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail) && data.detail.length) {
    return 'Kuch jaankari sahi nahi hai. Kripya highlighted fields check karke dobara try karein.';
  }
  return data.message || null;
}
