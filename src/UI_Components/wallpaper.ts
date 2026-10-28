/**
 * The wallpaper around the game (index.css: --wallpaper-image): one of these seamless tiles, picked at random
 * as the page loads and kept until it's loaded again (a refresh, or a return to the site picks afresh).
 * The tiles are 900 x 900 WebPs, shrunk from the 3600 x 3600 originals (kept outside the project) with
 * their edges wrapped, so they stay seamless. To add one: put it in public/Wallpapers and list it here.
 * Each is shown its own `width` wide (px: one tile; --wallpaper-width).
 */
export const WALLPAPERS: Array<{ file: string; width: number }> = [
  { file: 'Wallpapers/1.webp', width: 1250 },
  { file: 'Wallpapers/3.webp', width: 400 },
  { file: 'Wallpapers/4.webp', width: 1000 },
  { file: 'Wallpapers/5.webp', width: 850 },
  { file: 'Wallpapers/7.webp', width: 1050 },
  { file: 'Wallpapers/8.webp', width: 900 },
  { file: 'Wallpapers/10.webp', width: 1200 },
];

const chosen = WALLPAPERS[Math.floor(Math.random() * WALLPAPERS.length)];
/** This visit's wallpaper (the asset loader waits for it, with the rest of the scene). */
export const chosenWallpaper: string = chosen.file;

// (from the site's root: a relative url in a custom property resolves against the stylesheet using it, in the build
// /assets/, where it isn't)
document.documentElement.style.setProperty('--wallpaper-image', `url('/${chosen.file}')`);
document.documentElement.style.setProperty('--wallpaper-width', `${chosen.width}px`);

/**
 * While developing, for choosing: ] and [ the next and previous wallpaper (at its own width), = and - the
 * tiles bigger and smaller (--wallpaper-width, by `step` px), shown in a label at the top left (which
 * wallpaper, and its width).
 */
const WALLPAPER_TUNING = { step: 50, minWidth: 100 };
if (import.meta.env.DEV) {
  let index = WALLPAPERS.indexOf(chosen);
  let label: HTMLDivElement | null = null;
  const root = document.documentElement;
  const show = (): void => {
    const width = parseFloat(getComputedStyle(root).getPropertyValue('--wallpaper-width')) || 450;
    label ??= Object.assign(document.createElement('div'), {
      style: 'position: fixed; top: 8px; left: 8px; z-index: 200000; padding: 4px 10px; border-radius: 6px; background: rgba(0, 0, 0, 0.75); color: #fff; font: 14px/1.4 system-ui, sans-serif; pointer-events: none;',
    });
    if (!label.isConnected) document.body.append(label);
    const number = WALLPAPERS[index].file.match(/(\d+)\.webp/)?.[1];
    label.textContent = `Wallpaper ${number} (${index + 1} of ${WALLPAPERS.length}) · ${width}px wide   ( [ ] change · - = size )`;
  };
  window.addEventListener('keyup', e => {
    const width = parseFloat(getComputedStyle(root).getPropertyValue('--wallpaper-width')) || 450;
    if (e.key === ']' || e.key === '[') {
      index = (index + (e.key === ']' ? 1 : -1) + WALLPAPERS.length) % WALLPAPERS.length;
      root.style.setProperty('--wallpaper-image', `url('/${WALLPAPERS[index].file}')`);
      root.style.setProperty('--wallpaper-width', `${WALLPAPERS[index].width}px`);
    } else if (e.key === '=' || e.key === '+' || e.key === '-') {
      const next = Math.max(WALLPAPER_TUNING.minWidth, width + (e.key === '-' ? -1 : 1) * WALLPAPER_TUNING.step);
      root.style.setProperty('--wallpaper-width', `${next}px`);
    } else return;
    show();
  });
}
