export type VoiceSessionPhase = 'off' | 'connecting' | 'microphone' | 'ready' | 'failed';

export function voiceSessionStatus(input: {
  enabled: boolean; connected: boolean; sessionReady: boolean; microphoneReady: boolean; error: string | null;
}): { phase: VoiceSessionPhase; message: string } {
  if (!input.enabled) return { phase: 'off', message: '' };
  if (input.error) return { phase: 'failed', message: input.error };
  if (!input.connected || !input.sessionReady) return {
    phase: 'connecting', message: 'Saarthi se jud rahe hain… Pehli baar connection mein thoda samay lag sakta hai.',
  };
  if (!input.microphoneReady) return { phase: 'microphone', message: 'Baat karne ke liye microphone ki permission dein.' };
  return { phase: 'ready', message: '' };
}

export function voiceTicketErrorMessage(data?: { status?: string }, code?: string): string {
  if (data?.status === 'configuration_required') return 'Saarthi ki voice service ka setup abhi poora nahi hua hai. Isliye abhi awaaz mein baat nahi ho sakti.';
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') return 'Voice service shuru hone mein samay lag raha hai. Dobara connect karke dekhein.';
  return 'Saarthi se connection nahi ho paaya. Dobara try karein ya manually aage badhein.';
}
