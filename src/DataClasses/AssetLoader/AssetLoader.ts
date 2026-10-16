
// Define your raw manifest vectors
const sceneImageSrcs = [
    'background-scene/QuickCast-Background-Test3.png',
    'background-scene/Chandelier/Chandelier-candle-flames.png',
    'background-scene/Chandelier/Chandelier-candles-holder-iron.png',
    'background-scene/Chandelier/Chandelier-chain-iron.png',
    'background-scene/Clock/Clock-body.png',
    'background-scene/Clock/Clock-inside-back.png',
    'background-scene/Clock/Clock-left-chime.png',
    'background-scene/Clock/Clock-right-chime.png',
];

const buttonImgSrcs = [
    'mask-icons/1mask-icon-Normal.png',
    'mask-icons/2mask-icon-Hard.png',
    'mask-icons/3mask-icon-Brutal.png',
    'spell-icons/spellbook-icon.png',
];

const avatarImgSrcs = [
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

export type LoaderProperties = 'isOnnxModelLoaded' | 'isFontsLoaded' | 'isSoundsEffectsLoaded' | 'isImgsLoaded' | 'isSceneImgsLoaded';

const loaders: Array<LoaderProperties> = [
    'isOnnxModelLoaded',
    'isFontsLoaded',
    'isSoundsEffectsLoaded',
    'isImgsLoaded'
];

export class AssetLoader {
    isOnnxModelLoaded: boolean = false;
    isFontsLoaded: boolean = false;
    isSoundsEffectsLoaded: boolean = false;
    isImgsLoaded: boolean = false;

    isSceneImgsLoaded: boolean = false;

    forceUpdate: Function | null = null;

    constructor() {
        this.loadFontsAndImgs();
    }

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
        // document.fonts.ready resolves when all CSS-declared @font-face files finish streaming
        await document.fonts.ready;
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

    loadFontsAndImgs = async () => {
        try {
            await Promise.all([
                this.loadFonts(),
                this.loadImages(sceneImageSrcs, () => {
                    const loaderObj: Map<LoaderProperties, boolean> = new Map<LoaderProperties, boolean>();
                    loaderObj.set('isSceneImgsLoaded', true);
                    this.setIsLoading(loaderObj);
                }),
                this.loadImages(buttonImgSrcs),
                this.loadImages(avatarImgSrcs),
                this.loadImages(tooltipImgs)
            ]);
        } catch (error) {
            console.error("Asset loading error context: ", error);
        } finally {
            const loaderObj: Map<LoaderProperties, boolean> = new Map<LoaderProperties, boolean>();
            loaderObj.set('isFontsLoaded', true);
            loaderObj.set('isImgsLoaded', true);
            this.setIsLoading(loaderObj);
        }
    }
}