/**
 * Sound Notification Service
 * Handles audio notifications for messages, mentions, and other events
 */

export interface SoundOptions {
  volume?: number;
  loop?: boolean;
  playbackRate?: number;
}

export class SoundService {
  private static instance: SoundService;
  private audioContext: AudioContext | null = null;
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private enabled: boolean = true;

  private constructor() {
    // Initialize audio context if supported
    if ('AudioContext' in window || 'webkitAudioContext' in window) {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (error) {
        console.warn('Could not create audio context:', error);
      }
    }
  }

  static getInstance(): SoundService {
    if (!SoundService.instance) {
      SoundService.instance = new SoundService();
    }
    return SoundService.instance;
  }

  /**
   * Enable or disable sound notifications
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if sound notifications are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Generate a simple beep sound using Web Audio API
   */
  private generateBeep(frequency: number, duration: number, volume: number = 0.3): Promise<void> {
    return new Promise((resolve) => {
      if (!this.audioContext) {
        resolve();
        return;
      }

      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);

      oscillator.onended = () => resolve();
    });
  }

  /**
   * Play a sound file or generate a beep if file is not available
   */
  private async playSound(soundId: string, fallbackFrequency: number, options: SoundOptions = {}): Promise<void> {
    if (!this.enabled) return;

    try {
      // Try to resume audio context if it's suspended
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Try to play audio file first
      let audio = this.sounds.get(soundId);
      if (!audio) {
        audio = new Audio(`/sounds/${soundId}.mp3`);
        audio.volume = options.volume || 0.5;
        audio.playbackRate = options.playbackRate || 1.0;
        audio.loop = options.loop || false;
        this.sounds.set(soundId, audio);
      }

      try {
        await audio.play();
      } catch (audioError) {
        // Fallback to generated beep if audio file fails
        console.log(`Audio file failed, using fallback beep for ${soundId}`);
        await this.generateBeep(fallbackFrequency, 0.2, options.volume || 0.3);
      }
    } catch (error) {
      console.warn(`Failed to play sound ${soundId}:`, error);
    }
  }

  /**
   * Play notification sound for regular messages
   */
  async playMessageSound(options: SoundOptions = {}): Promise<void> {
    await this.playSound('message', 800, options);
  }

  /**
   * Play notification sound for mentions
   */
  async playMentionSound(options: SoundOptions = {}): Promise<void> {
    await this.playSound('mention', 1000, { ...options, volume: (options.volume || 0.5) * 1.2 });
  }

  /**
   * Play notification sound for direct messages
   */
  async playDirectMessageSound(options: SoundOptions = {}): Promise<void> {
    await this.playSound('direct-message', 1200, options);
  }

  /**
   * Play notification sound for reactions
   */
  async playReactionSound(options: SoundOptions = {}): Promise<void> {
    await this.playSound('reaction', 600, { ...options, volume: (options.volume || 0.5) * 0.8 });
  }

  /**
   * Play a custom notification pattern
   */
  async playNotificationPattern(pattern: { frequency: number; duration: number; gap?: number }[], options: SoundOptions = {}): Promise<void> {
    if (!this.enabled) return;

    for (let i = 0; i < pattern.length; i++) {
      const { frequency, duration, gap } = pattern[i];
      await this.generateBeep(frequency, duration, options.volume || 0.3);
      
      if (gap && i < pattern.length - 1) {
        await new Promise(resolve => setTimeout(resolve, gap));
      }
    }
  }

  /**
   * Play a multi-tone notification (for high priority)
   */
  async playHighPrioritySound(options: SoundOptions = {}): Promise<void> {
    await this.playNotificationPattern([
      { frequency: 800, duration: 0.1, gap: 50 },
      { frequency: 1000, duration: 0.1, gap: 50 },
      { frequency: 1200, duration: 0.2 }
    ], options);
  }

  /**
   * Play a subtle notification (for low priority)
   */
  async playSubtleSound(options: SoundOptions = {}): Promise<void> {
    await this.generateBeep(400, 0.1, (options.volume || 0.3) * 0.5);
  }

  /**
   * Stop all currently playing sounds
   */
  stopAllSounds(): void {
    this.sounds.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
  }

  /**
   * Test sound - useful for settings
   */
  async playTestSound(): Promise<void> {
    await this.playNotificationPattern([
      { frequency: 600, duration: 0.15, gap: 100 },
      { frequency: 800, duration: 0.15, gap: 100 },
      { frequency: 1000, duration: 0.2 }
    ], { volume: 0.4 });
  }

  /**
   * Preload sound files
   */
  preloadSounds(): void {
    const soundFiles = ['message', 'mention', 'direct-message', 'reaction'];
    
    soundFiles.forEach(soundId => {
      const audio = new Audio(`/sounds/${soundId}.mp3`);
      audio.preload = 'auto';
      audio.volume = 0.5;
      this.sounds.set(soundId, audio);
    });
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.stopAllSounds();
    this.sounds.clear();
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}