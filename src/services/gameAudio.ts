import { menuAudio } from "./menuAudio";

const BACKGROUND_TRACK = "/audio/Mario/Super Mario Galaxy Soundtrack - Buoy Base Galaxy.mp3";
const BUMPER_TRACK = "/audio/Mario/Bumper.wav";
const OBSTACLE_BUMP_TRACK = "/audio/Mario/POW_BLOCK_QUAKE.wav";
const MUSHROOM_TRACK = "/audio/Mario/Spin_Champi.wav";
const TELEPORT_TRACK = "/audio/Mario/Teleportation.wav";
const SLINGSHOT_TRACK = "/audio/Mario/Slingshot.wav";
const BALL_LOST_TRACK = "/audio/Mario/Perd_Balle.wav";

// Keep gameplay music below the global music slider so SFX stay readable.
const BACKGROUND_VOLUME_RATIO = 0.35;

class GameAudioController {
  private enabled = false;
  private unlocked = false;
  private backgroundAudio: HTMLAudioElement | null = null;
  private backgroundPending = false;

  enable(): void {
    this.enabled = true;
    this.bindUnlock();
  }

  playBackgroundMusic(): void {
    if (!this.enabled) return;

    if (!this.backgroundAudio) {
      this.backgroundAudio = new Audio(BACKGROUND_TRACK);
      this.backgroundAudio.loop = true;
    }

    this.applyBackgroundPreferences();
    this.tryPlayBackground();
  }

  pauseBackgroundMusic(): void {
    this.backgroundPending = false;
    this.backgroundAudio?.pause();
  }

  playBumper(): void {
    this.playOneShot(BUMPER_TRACK);
  }

  playObstacleBump(): void {
    this.playOneShot(OBSTACLE_BUMP_TRACK);
  }

  playMushroom(): void {
    this.playOneShot(MUSHROOM_TRACK);
  }

  playTeleport(): void {
    this.playOneShot(TELEPORT_TRACK);
  }

  playSlingshot(): void {
    this.playOneShot(SLINGSHOT_TRACK);
  }

  playBallLost(): void {
    this.playOneShot(BALL_LOST_TRACK);
  }

  private playOneShot(src: string): void {
    if (!this.enabled) return;
    const audio = new Audio(src);
    audio.volume = menuAudio.getSfxVolume() / 100;
    void audio.play().catch((err) => {
      console.warn("[gameAudio] play() blocked by browser:", err);
    });
  }

  private tryPlayBackground(): void {
    if (!this.backgroundAudio) return;

    void this.backgroundAudio.play().catch(() => {
      this.backgroundPending = true;
      this.bindUnlock();
    });
  }

  private applyBackgroundPreferences(): void {
    if (!this.backgroundAudio) return;

    this.backgroundAudio.volume = (menuAudio.getMusicVolume() / 100) * BACKGROUND_VOLUME_RATIO;
    this.backgroundAudio.muted = menuAudio.isMuted();
  }

  private bindUnlock(): void {
    if (this.unlocked) return;

    const unlock = () => {
      this.unlocked = true;
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      if (this.backgroundPending) {
        this.backgroundPending = false;
        this.applyBackgroundPreferences();
        this.tryPlayBackground();
      }
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
  }
}

export const gameAudio = new GameAudioController();
