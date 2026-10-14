
// Define your raw manifest vectors
const imageSources = [
    // 'background-scene/QuickCast-Background-Test3.png',
    // Add all other essential UI / sprite sheet PNG paths here
];

export type LoaderProperties = 'isOnnxModelLoaded' | 'isFontsLoaded' | 'isSoundsEffectsLoaded' | 'isImgsLoaded';

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

    forceUpdate: Function | null = null;

    constructor() {
        this.loadFontsAndImgs();
    }

    setForceUpdate = (forceUpdate: Function): void => {
        this.forceUpdate = forceUpdate;
    }

    getIsLoading = (): boolean => loaders.some(k => !this[k as LoaderProperties]);
    setIsLoading = (loaderObj: Map<LoaderProperties, boolean>): void => {
        loaderObj.forEach((v, k) => {
            // console.log({ [k]: v })
            this[k as LoaderProperties] = v;
        })
        // TESTING: check what is loaded / not-loaded.
        loaders.forEach(k => console.log({ isLoading: this.getIsLoading(), [k]: this[k] }));
        this.forceUpdate && this.forceUpdate();
    };

    loadFonts = async () => {
        // document.fonts.ready resolves when all CSS-declared @font-face files finish streaming
        await document.fonts.ready;
    };

    loadImages = (sources: string[]) => {
        return Promise.all(
            sources.map((src) => {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.src = src;
                    img.onload = () => resolve(src);
                    img.onerror = () => reject(`Failed to load image: ${src}`);
                });
            })
        );
    };

    loadFontsAndImgs = async () => {
        try {
            await Promise.all([
                this.loadFonts(),
                this.loadImages(imageSources),
            ]);
        } catch (error) {
            console.error("Asset loading error context: ", error);
            // TO-DO:... retry???
        } finally {
            const loaderObj: Map<LoaderProperties, boolean> = new Map<LoaderProperties, boolean>();
            loaderObj.set('isFontsLoaded', true);
            loaderObj.set('isImgsLoaded', true);
            this.setIsLoading(loaderObj);
        }
    }
}