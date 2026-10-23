import { AssetLoader, LoaderProperties } from '../AssetLoader/AssetLoader';
import { AudioType, SoundEffectName, SFX_REGISTRY } from '../types'
import { ref } from 'valtio';

/**
 * The volume dials (in Settings): the level at a dial's middle (its default; 0 to 1), the dial's top (a
 * multiple of the middle; the bottom is silent), and where each kind's volume and muting are remembered.
 */
export const VOLUME = {
    middleLevel: 0.5,
    max: 2,
    storageKeys: {
        fx: { volume: 'quickCast-fxVolume', muted: 'quickCast-fxVolumeOff' },
        music: { volume: 'quickCast-musicVolume', muted: 'quickCast-musicVolumeOff' },
    } as Record<AudioType, { volume: string; muted: string }>,
};

export class AudioHandler {
    private readonly BACKGROUND_MUSIC_SRC = './Audio/Music/Magic Escape Room.mp3';

    private backgroundMusic: HTMLAudioElement | null = null;
    private backgroundMusicStarted: boolean = false;

    // Each kind's volume, as its dial shows it (0 to VOLUME.max; 1 is the middle), and whether it's
    // muted (kept apart, so unmuting goes back to the same volume); both remembered (VOLUME.storageKeys)
    private volumes: Record<AudioType, number> = { fx: 1, music: 1 };
    private muted: Record<AudioType, boolean> = { fx: false, music: false };

    // Decoded sound effects, held in memory so they play instantly.
    // ref() keeps valtio from proxying native audio objects (which breaks their methods).
    private readonly audioContext: AudioContext = ref(new AudioContext());
    private sfxLibrary: Map<SoundEffectName, AudioBuffer> = new Map();

    // A tracker cataloging currently playing sound effects so we can kill them instantly
    private activeSfxInstances: Set<AudioBufferSourceNode> = new Set();

    constructor(assetLoader: AssetLoader) {
        this.loadVolumes();
        this.preloadSoundEffects(assetLoader);
    }

    /**
     * 1. PRELOADER PIPELINE
     * Downloads and decodes every sound effect up front. Sound effects are only marked as loaded
     * once all of them are decoded (a failed file is logged and skipped).
     */
    private preloadSoundEffects = async (assetLoader: AssetLoader) => {
        await assetLoader.whenPriorityAssetsLoaded();
        await Promise.all(Object.entries(SFX_REGISTRY).map(async ([name, path]) => {
            try {
                const response = await fetch(path);
                const buffer = await this.audioContext.decodeAudioData(await response.arrayBuffer());
                this.sfxLibrary.set(name as SoundEffectName, buffer);
            } catch (err) {
                console.error(`Failed to load sound effect "${name}":`, err);
            }
        }));
        const loaderObj: Map<LoaderProperties, boolean> = new Map<LoaderProperties, boolean>();
        loaderObj.set('isSoundsEffectsLoaded', true);
        assetLoader.setIsLoading(loaderObj);
    }

    startBackgroundMusic = () => {
        if (this.backgroundMusicStarted) return;
        this.backgroundMusicStarted = true;
        this.backgroundMusic = new Audio(this.BACKGROUND_MUSIC_SRC);
        this.backgroundMusic.loop = true;
        this.backgroundMusic.volume = this.getLevel('music');
        this.backgroundMusic.play()
            .then(_ => { /* this.backgroundMusicStarted = true; */ })
            .catch(err => console.log("Autoplay blocked:", err));
    }

    /**
     * 2. POLYPHONIC SFX PLAYER
     * Each play gets its own source node from the shared decoded buffer, so the same clip can
     * fire repeatedly and overlap without cutting off previous layers.
     */
    startSoundEffect = (name: SoundEffectName, volumeScalar = this.getLevel('fx')) => {
        const buffer = this.sfxLibrary.get(name);
        if (!buffer) {
            console.error(`Sound effect registry key "${name}" not found!`);
            return;
        }

        // Browsers start the context suspended until the first user interaction
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(err => console.log(`SFX "${name}" playback blocked:`, err));
        }

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        const gain = this.audioContext.createGain();
        gain.gain.value = volumeScalar;
        source.connect(gain).connect(this.audioContext.destination);

        // Keep a reference to the active channel so it can be terminated on demand
        this.activeSfxInstances.add(source);

        // Auto-remove instance from tracking cache stack once it hits completion
        source.addEventListener('ended', () => {
            this.activeSfxInstances.delete(source);
        });

        source.start();
    }

    /** How loud a kind plays (0 to 1): its dial's volume, unless muted. */
    private getLevel = (audioType: AudioType): number => this.muted[audioType] ? 0 : this.volumes[audioType] * VOLUME.middleLevel;
    private applyMusicLevel = (): void => { if (this.backgroundMusic) this.backgroundMusic.volume = this.getLevel('music'); };

    /** Mutes or unmutes a kind (`isMuted`: which; else the other way round). */
    toggleAudio = (audioType: AudioType, isMuted?: boolean): void => {
        this.muted[audioType] = isMuted ?? !this.muted[audioType];
        this.applyMusicLevel();
        this.saveVolumes(audioType);
    }

    getVolume = (audioType: AudioType): number => this.volumes[audioType];
    /** A kind's dial turned to `volume` (0 to VOLUME.max): it's unmuted, unless turned right down. */
    setVolume = (audioType: AudioType, volume: number): void => {
        this.volumes[audioType] = Math.min(VOLUME.max, Math.max(0, volume));
        if (this.volumes[audioType] > 0) this.muted[audioType] = false;
        this.applyMusicLevel();
        this.saveVolumes(audioType);
    }

    getIsMusicMuted = (): boolean => this.getLevel('music') === 0;
    getIsFxMuted = (): boolean => this.getLevel('fx') === 0;

    private loadVolumes = (): void => {
        (['fx', 'music'] as Array<AudioType>).forEach(audioType => {
            try {
                const saved = window.localStorage.getItem(VOLUME.storageKeys[audioType].volume);
                if (saved !== null && Number.isFinite(Number(saved))) this.volumes[audioType] = Math.min(VOLUME.max, Math.max(0, Number(saved)));
                this.muted[audioType] = JSON.parse(window.localStorage.getItem(VOLUME.storageKeys[audioType].muted) ?? 'false') === true;
            } catch { /* (storage unavailable: the defaults) */ }
        });
    }
    private saveVolumes = (audioType: AudioType): void => {
        try {
            window.localStorage.setItem(VOLUME.storageKeys[audioType].volume, String(this.volumes[audioType]));
            window.localStorage.setItem(VOLUME.storageKeys[audioType].muted, JSON.stringify(this.muted[audioType]));
        } catch { /* (storage unavailable: not remembered) */ }
    }

    getIsBackgroundMusicStarted = (): boolean => {
        return this.backgroundMusicStarted;
    }
}
