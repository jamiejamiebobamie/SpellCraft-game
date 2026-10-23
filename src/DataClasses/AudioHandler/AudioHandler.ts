import { AssetLoader, LoaderProperties } from '../AssetLoader/AssetLoader';
import { AudioType, SoundEffectName, SFX_REGISTRY } from '../types'
import { ref } from 'valtio';

export class AudioHandler {
    private readonly BACKGROUND_MUSIC_SRC = './Audio/Music/Magic Escape Room.mp3';

    private readonly MAX_SOUND_EFFECT_LVL = 0.5;
    private readonly MAX_MUSIC_LVL = 0.5;

    private backgroundMusic: HTMLAudioElement | null = null;
    private backgroundMusicStarted: boolean = false;

    private musicAudioLevel: number = this.MAX_MUSIC_LVL;
    private effectsAudioLevel: number = this.MAX_SOUND_EFFECT_LVL;

    // Decoded sound effects, held in memory so they play instantly.
    // ref() keeps valtio from proxying native audio objects (which breaks their methods).
    private readonly audioContext: AudioContext = ref(new AudioContext());
    private sfxLibrary: Map<SoundEffectName, AudioBuffer> = new Map();

    // A tracker cataloging currently playing sound effects so we can kill them instantly
    private activeSfxInstances: Set<AudioBufferSourceNode> = new Set();

    constructor(assetLoader: AssetLoader) {
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
        this.backgroundMusic.volume = this.musicAudioLevel;
        this.backgroundMusic.play()
            .then(_ => { /* this.backgroundMusicStarted = true; */ })
            .catch(err => console.log("Autoplay blocked:", err));
    }

    /**
     * 2. POLYPHONIC SFX PLAYER
     * Each play gets its own source node from the shared decoded buffer, so the same clip can
     * fire repeatedly and overlap without cutting off previous layers.
     */
    startSoundEffect = (name: SoundEffectName, volumeScalar = this.effectsAudioLevel) => {
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
}
