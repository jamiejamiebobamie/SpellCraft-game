
import { ref } from 'valtio';

// Assets load in two batches: the priority batch (the title font and the logo's images, so the
// loading screen can show the logo first), then everything else (images, sounds, models).

/** The loading screen's font (index.css). */
const PRIORITY_FONT = "1em 'EnchantedLand'";

/** Images the loading screen's logo is made of: the clock and the avatars' parts. */
const logoImgSrcs = [
    'background-scene/Clock/Clock-body.png',
    'background-scene/Clock/Clock-inside-back.png',
    'background-scene/Clock/Clock-left-chime.png',
    'background-scene/Clock/Clock-right-chime.png',
    'player_avatars/Bicep1.png',
    'player_avatars/Bicep2.png',
    'player_avatars/Forearm.png',
    'player_avatars/Head1.png',
    'player_avatars/Head2.png',
    'player_avatars/RightArm.png',
    'player_avatars/Robe1a.png',
    'player_avatars/Robe2a.png',
    'player_avatars/WandHand.png',
];

/** The rest of the background scene (the clock is in logoImgSrcs). */
const sceneImageSrcs = [
    'background-scene/QuickCast-Background-Test3.png',
    'background-scene/Chandelier/Chandelier-candle-flames.png',
    'background-scene/Chandelier/Chandelier-candles-holder-iron.png',
    'background-scene/Chandelier/Chandelier-chain-iron.png',
];

const buttonImgSrcs = [
    'mask-icons/1mask-icon-Normal.png',
    'mask-icons/2mask-icon-Hard.png',
    'mask-icons/3mask-icon-Brutal.png',
    'spell-icons/spellbook-icon.png',
];

const tooltipImgs = [
    'tooltip-imgs/out-of-bed.png',
    'tooltip-imgs/how-to-play.gif',
    'tooltip-imgs/casting-area.gif',
    'tooltip-imgs/spell-book.gif',
    'tooltip-imgs/ticking-clock.png',
    'tooltip-imgs/sunrise.png',
    'tooltip-imgs/many-ways-to-play.png',
    'tooltip-imgs/out-of-focus.gif',
    'tooltip-imgs/regaining-focus.gif',
    'tooltip-imgs/blood-magic.gif',
    'tooltip-imgs/speed-and-damage.gif',
    'tooltip-imgs/winners-and-losers.gif'
];

export type LoaderProperties = 'isOnnxModelLoaded' | 'isNpcModelLoaded' | 'isFontsLoaded' | 'isSoundsEffectsLoaded' | 'isImgsLoaded' | 'isSceneImgsLoaded' | 'isPriorityAssetsLoaded' | 'isMinLoadingTimeElapsed';

/**
 * The least time "Loading..." shows before the Play button, even if everything loads sooner. 0: none
 * (the boot screen in index.html now shows from the first paint; was 1500).
 */
const MIN_LOADING_TIME_MILLI = 0;

const loaders: Array<LoaderProperties> = [
    'isOnnxModelLoaded',
    'isNpcModelLoaded', // the trained NPC (NpcBrain); set even if it fails to load, as the NPC then plays randomly
    'isFontsLoaded',
    'isSoundsEffectsLoaded',
    'isImgsLoaded',
    'isPriorityAssetsLoaded',
    'isMinLoadingTimeElapsed', // counted from when "Loading..." appears (once the priority batch is in)
];

export class AssetLoader {
    isOnnxModelLoaded: boolean = false;
    isNpcModelLoaded: boolean = false;
    isFontsLoaded: boolean = false;
    isSoundsEffectsLoaded: boolean = false;
    isImgsLoaded: boolean = false;

    isSceneImgsLoaded: boolean = false;
    isPriorityAssetsLoaded: boolean = false;
    isMinLoadingTimeElapsed: boolean = false;

    forceUpdate: Function | null = null;

    private priorityAssets: Promise<void>;

    constructor() {
        // ref(): keep valtio (Game proxies the loader) from proxying the promise
        this.priorityAssets = ref(this.loadPriorityAssets());
        this.priorityAssets.then(() => {
            setTimeout(() => this.setIsLoading(new Map([['isMinLoadingTimeElapsed', true]])), MIN_LOADING_TIME_MILLI);
            this.loadFontsAndImgs();
        });
    }

    /**
     * Resolves once the priority batch (font, logo images) is in: the other loaders (sounds, models)
     * wait for it, so they don't slow it down. Never rejects (failed assets are logged).
     */
    whenPriorityAssetsLoaded = (): Promise<void> => this.priorityAssets;
    getIsPriorityAssetsLoaded = (): boolean => this.isPriorityAssetsLoaded;

    setForceUpdate = (forceUpdate: Function): void => {
        this.forceUpdate = forceUpdate;
    }

    getIsFontLoaded = (): boolean => this.isFontsLoaded;
    getIsSceneImgsLoaded = (): boolean => this.isSceneImgsLoaded;

    getIsLoading = (): boolean => loaders.some(k => !this[k as LoaderProperties]);
    setIsLoading = (loaderObj: Map<LoaderProperties, boolean>): void => {
        loaderObj.forEach((v, k) => {
            this[k as LoaderProperties] = v;
        })
        this.forceUpdate && this.forceUpdate();
    };

    loadFonts = async () => {
        // Request the font itself: document.fonts.ready alone only waits for fonts already in use
        await document.fonts.load(PRIORITY_FONT);
        await document.fonts.ready;
    };

    private loadPriorityAssets = async (): Promise<void> => {
        try {
            await Promise.all([this.loadFonts(), this.loadImages(logoImgSrcs)]);
        } catch (error) {
            console.error("Priority asset loading error: ", error);
        } finally {
            this.setIsLoading(new Map<LoaderProperties, boolean>([['isFontsLoaded', true], ['isPriorityAssetsLoaded', true]]));
        }
    };

    loadImages = (sources: string[], successCallback?: Function) => {
        return Promise.all(
            sources.map((src) => {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.src = src;
                    img.onload = () => resolve(src);
                    img.onerror = () => reject(`Failed to load image: ${src}`);
                });
            })
        ).then(_ => successCallback && successCallback());
    };

    /** The second batch's images (the sounds and models load themselves, after the priority batch). */
    loadFontsAndImgs = async () => {
        try {
            await Promise.all([
                this.loadImages(sceneImageSrcs, () => {
                    const loaderObj: Map<LoaderProperties, boolean> = new Map<LoaderProperties, boolean>();
                    loaderObj.set('isSceneImgsLoaded', true);
                    this.setIsLoading(loaderObj);
                }),
                this.loadImages(buttonImgSrcs),
                this.loadImages(tooltipImgs)
            ]);
        } catch (error) {
            console.error("Asset loading error context: ", error);
        } finally {
            const loaderObj: Map<LoaderProperties, boolean> = new Map<LoaderProperties, boolean>();
            loaderObj.set('isImgsLoaded', true);
            this.setIsLoading(loaderObj);
        }
    }
}