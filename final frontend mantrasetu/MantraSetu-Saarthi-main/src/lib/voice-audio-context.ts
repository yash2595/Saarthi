type ResumableContext = { state: string; resume(): Promise<void> };

/** Called synchronously from the voice button, before network/permission awaits. */
export function unlockVoiceAudio<T extends ResumableContext>(
  playback: T | null,
  capture: T | null,
  create: (sampleRate?: number) => T,
  onError: () => void,
): { playback: T; capture: T } {
  const ensure = (existing: T | null, sampleRate: number) => {
    if (existing && existing.state !== 'closed') return existing;
    try { return create(sampleRate); } catch { return create(); }
  };
  const nextPlayback = ensure(playback, 24000);
  const nextCapture = ensure(capture, 16000);
  void nextPlayback.resume().catch(onError);
  void nextCapture.resume().catch(onError);
  return { playback: nextPlayback, capture: nextCapture };
}
