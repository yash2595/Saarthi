type TicketError = { status?: number; code?: string; data?: { status?: string }; response?: { status?: number; data?: { status?: string } } };

/** Allow one retry while a sleeping service starts; never retry setup/auth/rate-limit failures. */
export async function requestVoiceTicketWithRetry<T>(
  request: () => Promise<T>,
  isCurrent: () => boolean,
  pause: () => Promise<void> = () => new Promise(resolve => setTimeout(resolve, 3000)),
): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!isCurrent()) return null;
    try {
      const result = await request();
      return isCurrent() ? result : null;
    } catch (error) {
      if (!isCurrent()) return null;
      const failure = error as TicketError;
      const status = failure.status ?? failure.response?.status;
      const data = failure.data ?? failure.response?.data;
      const transient = [502, 503, 504].includes(status ?? 0) || ['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK'].includes(failure.code ?? '');
      if (attempt === 1 || !transient || data?.status === 'configuration_required') throw error;
      await pause();
    }
  }
  return null;
}
