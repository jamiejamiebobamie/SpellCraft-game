import { AssetLoader, LoaderProperties } from '../AssetLoader/AssetLoader';
import { AudioType, SoundEffectName, SFX_REGISTRY } from '../types'

export class AudioHandler {
    private readonly BACKGROUND_MUSIC_SRC = './Audio/Music/Magic Escape Room.mp3';

    private readonly MAX_SOUND_EFFECT_LVL = 0.5;
    private readonly MAX_MUSIC_LVL = 0.4;

    private backgroundMusic: HTMLAudioElement | null = null;
    private backgroundMusicStarted: boolean = false;

    private musicAudioLevel: number = 0.5;
    private effectsAudioLevel: number = 0.5;

    // A memory registry holding our preloaded audio blueprints
    private sfxLibrary: Map<SoundEffectName, HTMLAudioElement> = new Map();

    // A tracker cataloging currently playing audio tracks so we can kill them instantly
    private activeSfxInstances: HTMLAudioElement[] = [];

    constructor(assetLoader: AssetLoader) {
        this.preloadSoundEffects(assetLoader);
    }

    /**
     * 1. PRELOADER PIPELINE
     * Instantiates audio configurations immediately at game mount initialization.
     * Setting preload="auto" instructs browser network nodes to start fetching binaries.
     */
    private preloadSoundEffects = (assetLoader: AssetLoader) => {
        Object.entries(SFX_REGISTRY).forEach(([name, path]) => {
            const audioBlueprint = new Audio(path);
            audioBlueprint.preload = 'auto'; // Forces background download ahead of time
            this.sfxLibrary.set(name as SoundEffectName, audioBlueprint);
        });
        const loaderObj: Map<LoaderProperties, boolean> = new Map<LoaderProperties, boolean>();
        loaderObj.set('isSoundsEffectsLoaded', true);
        assetLoader.setIsLoading(loaderObj);
    }

    startBackgroundMusic = () => {
        if (this.backgroundMusicStarted) return;
        this.backgroundMusicStarted = true;
        this.backgroundMusic = new Audio(this.BACKGROUND_MUSIC_SRC);
        this.backgroundMusic.loop = true;
        this.backgroundMusic.volume = this.musicAudioLevel;
        this.backgroundMusic.play()
            .then(_ => { /* this.backgroundMusicStarted = true; */ })
            .catch(err => console.log("Autoplay blocked:", err));
    }

    /**
     * 2. POLYPHONIC SFX PLAYER
     * Clones the cached file blueprint node so the same clip can fire repeatedly 
     * and overlap seamlessly without cutting off previous layers.
     */
    startSoundEffect = (name: SoundEffectName, volumeScalar = this.effectsAudioLevel) => {
        const blueprint = this.sfxLibrary.get(name);
        if (!blueprint) {
            console.error(`Sound effect registry key "${name}" not found!`);
            return;
        }

        // Clone node guarantees overlapping files don't hijack timeline trackers
        const activeClone = blueprint.cloneNode(true) as HTMLAudioElement;
        activeClone.volume = volumeScalar;

        // Keep a reference to the active channel so it can be terminated on demand
        this.activeSfxInstances.push(activeClone);

        // Auto-remove instance from tracking cache stack once it hits completion
        activeClone.addEventListener('ended', () => {
            this.activeSfxInstances = this.activeSfxInstances.filter(instance => instance !== activeClone);
        });

        activeClone.play().catch(err => console.log(`SFX "${name}" playback blocked:`, err));
    }

    /**
     * 3. GLOBAL TERMINATION DESK
     * Enumerates over all active, loose channels and kills them instantly.
     */
    stopAllSoundEffects = () => {
        this.activeSfxInstances.forEach(instance => {
            instance.pause();
            instance.src = ''; // Force browser memory pipelines to release resource buffers immediately
        });
        this.activeSfxInstances = [];
    }

    stopBackgroundMusic = () => {
        if (this.backgroundMusic) {
            this.backgroundMusic.pause();
            this.backgroundMusic.currentTime = 0;
            this.backgroundMusicStarted = false;
        }
    }

    toggleAudio = (audioType: AudioType, isMuted?: boolean): void => {
        if (audioType == 'fx') {
            this.effectsAudioLevel = isMuted || this.effectsAudioLevel == this.MAX_SOUND_EFFECT_LVL ? 0 : this.MAX_SOUND_EFFECT_LVL
        } else {
            this.musicAudioLevel = isMuted || this.musicAudioLevel == this.MAX_MUSIC_LVL ? 0 : this.MAX_MUSIC_LVL;
            if (this.backgroundMusic) {
                this.backgroundMusic.volume = this.musicAudioLevel;
            }
        }
    }

    getIsMusicMuted = (): boolean => {
        return this.musicAudioLevel != this.MAX_MUSIC_LVL;
    }

    getIsFxMuted = (): boolean => {
        return this.effectsAudioLevel != this.MAX_SOUND_EFFECT_LVL;
    }

    getIsBackgroundMusicStarted = (): boolean => {
        return this.backgroundMusicStarted;
    }

    getEffectsAudioLevel = (): number => {
        return this.effectsAudioLevel;
    }
}
