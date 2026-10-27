// WallElements.tsx
// The hall's wall, in front of its background image: the picture frames and the suit of armour (their own
// images, so their brightness and blur can be tuned apart from the wall's), and the torch's green flame in
// the doorway on the right, flickering. Each image is the whole scene (1200 x 675, lined up with the
// background), shown cropped to where it has something, so its filters work on that area only.
import { Fragment } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { INTRO_WALK_ANIM_TIME } from '../Player/CharacterParts';
import { rootGameStore } from '../../DataClasses/store';

/** The scene images' size (pixels), and how many cqw a pixel is (the scene is 100cqw wide). */
const SCENE = { width: 1200, height: 675 };
const cqw = (px: number) => px * 100 / SCENE.width;

/**
 * The background image's brightness (as GameComponent's): the scene's brightness x this, dark on the landing
 * page and lit in play.
 */
export const BACKGROUND_IMAGE_BRIGHTNESS = { dark: 4, lit: 1.25 };

/**
 * The picture frames and the suit of armour. brightness: as the wall (1) or brighter or dimmer, on the landing
 * page and in play (the scene's brightness easing between them through the intro, as the wall's does). blur:
 * softening them into the wall (cqw; 0 none). hueRotate: shifting their colours round the colour wheel
 * (degrees; 0 as drawn). Each may have its own (overriding these). box: where the image has something
 * (pixels). shadow: on the floor beneath it (pixels; ShadowSpot): a wide, faint haze (spread), and darker patches
 * where it touches the floor (contacts), each a flat, blurred rounded patch (blur: cqw), at the floor's height (y).
 * scale: its width and height (1: as drawn), from the bottom of its middle (so it stays standing on the floor);
 * move: shifting it (pixels, of the 1200 x 675 scene: x right, y down). Its shadow moves and widens with it.
 */
export const WALL_ELEMENTS = {
  brightness: { landing: 1, play: 1 },
  blur: 0,
  hueRotate: 0,
  items: [
    { name: 'PictureFrames', box: { x: 220, y: 190, w: 288, h: 260 }, hueRotate: 0, scale: { x: 1, y: 1 }, move: { x: 0, y: 0 } } as WallItem,
    { name: 'SuitOfArmor', box: { x: 705, y: 45, w: 266, h: 460 }, hueRotate: 0, scale: { x: 1, y: 1 }, move: { x: 0, y: 0 }, shadow: {
      y: 484, blur: 0.5,
      spread: { x: 858, w: 230, h: 18, opacity: 0.4 },
      contacts: [{ x: 811, w: 52, h: 9, opacity: 0.75 }, { x: 869, w: 52, h: 9, opacity: 0.75 }, { x: 907, w: 14, h: 5, opacity: 0.6 }],
    } } as WallItem,
  ],
};
type WallItem = {
  name: string; box: { x: number; y: number; w: number; h: number };
  brightness?: { landing: number; play: number }; blur?: number; hueRotate?: number;
  shadow?: { y: number; blur: number; spread: ShadowSpot; contacts: Array<ShadowSpot> };
  scale?: { x: number; y: number }; move?: { x: number; y: number };
};

/** A patch of shadow on the floor: its middle (x), width and height (pixels), and how dark (opacity). */
type ShadowSpot = { x: number; w: number; h: number; opacity: number };

/** An element's shift and size (WallItem move, scale), from the bottom of its middle. */
const placing = (item: WallItem) => {
  const move = item.move ?? { x: 0, y: 0 }, scale = item.scale ?? { x: 1, y: 1 };
  return `transform-origin: 50% 100%; transform: translate(${cqw(move.x)}cqw, ${cqw(move.y)}cqw) scale(${scale.x}, ${scale.y});`;
};

/**
 * The torch's green flame in the doorway. brightness: on the landing page and in play (as the candles: it
 * eases between them through the intro). Its image's own glow is faded out toward its edges (fade: an ellipse
 * around the flame, from fully shown to gone, as fractions of its box's half-size), so as it flickers it stays
 * within the doorway. The flicker: a quick, uneven one (flickerSeconds), and a slower sway (swaySeconds,
 * swayDeg), as a torch's flame. box: the flame and its glow (pixels); base: where the flame stands (pixels).
 */
export const DOOR_FLAME = {
  brightness: { landing: 0.5, play: 1.15 },
  fade: { from: 0.55, to: 0.95 },
  flickerSeconds: 0.9,
  swaySeconds: 3.4,
  swayDeg: 3,
  box: { x: 1022, y: 195, w: 120, h: 120 },
  base: { x: 1082, y: 268 },
};

const isLit = (sceneBrightness: number) => sceneBrightness > rootGameStore.LOW_BRIGHTNESS;

/** A crop of a scene image (url) to `box`, placed where it is in the scene. */
const crop = (url: string, box: WallItem['box']) => css`
  position: absolute;
  left: ${cqw(box.x)}cqw;
  top: ${cqw(box.y)}cqw;
  width: ${cqw(box.w)}cqw;
  height: ${cqw(box.h)}cqw;
  background: url('${url}') no-repeat;
  background-size: 100cqw auto;
  background-position: ${-cqw(box.x)}cqw ${-cqw(box.y)}cqw;
  pointer-events: none;
`;

const WallItemImage = styled.div<{ $item: WallItem; $sceneBrightness: number }>`
  ${props => crop(`background-scene/BackgroundWallElements/${props.$item.name}.png`, props.$item.box)}
  ${props => placing(props.$item)}
  z-index: -1; /* (in front of the background, behind everything else) */
  transition: filter ${INTRO_WALK_ANIM_TIME}s;
  will-change: filter; /* (its own layer from the start, as the background's) */
  filter: ${props => {
    const lit = isLit(props.$sceneBrightness);
    const own = (props.$item.brightness ?? WALL_ELEMENTS.brightness)[lit ? 'play' : 'landing'];
    const blur = props.$item.blur ?? WALL_ELEMENTS.blur;
    const hue = props.$item.hueRotate ?? WALL_ELEMENTS.hueRotate;
    return `${hue ? `hue-rotate(${hue}deg) ` : ''}brightness(${props.$sceneBrightness * (lit ? BACKGROUND_IMAGE_BRIGHTNESS.lit : BACKGROUND_IMAGE_BRIGHTNESS.dark) * own})${blur > 0 ? ` blur(${blur}cqw)` : ''}`;
  }};
`;

/** An element's shadow on the floor (WallItem shadow), moving with it and as wide as it's scaled. */
const FloorShadow = styled.div<{ $item: WallItem }>`
  position: absolute;
  left: 0;
  top: 0;
  width: 100cqw;
  height: 100%;
  z-index: -1;
  pointer-events: none;
  transform-origin: ${props => cqw(props.$item.box.x + props.$item.box.w / 2)}cqw 0;
  transform: translate(${props => cqw(props.$item.move?.x ?? 0)}cqw, ${props => cqw(props.$item.move?.y ?? 0)}cqw) scaleX(${props => props.$item.scale?.x ?? 1});
`;
/** A patch of it: a flat, rounded, blurred dark patch. */
const ShadowPatch = styled.div<{ $spot: ShadowSpot; $y: number; $blur: number }>`
  position: absolute;
  left: ${props => cqw(props.$spot.x - props.$spot.w / 2)}cqw;
  top: ${props => cqw(props.$y - props.$spot.h / 2)}cqw;
  width: ${props => cqw(props.$spot.w)}cqw;
  height: ${props => cqw(props.$spot.h)}cqw;
  border-radius: 50%;
  background: rgba(0, 0, 0, ${props => props.$spot.opacity});
  filter: blur(${props => props.$blur}cqw);
`;

// The torch's flicker: uneven steps, taller and shorter, leaning, brighter and dimmer
const torchFlicker = keyframes`
  0% { transform: scale(1, 1) skewX(0deg); opacity: 1; }
  9% { transform: scale(0.97, 1.08) skewX(1.5deg); opacity: 0.9; }
  17% { transform: scale(1.02, 0.95) skewX(-1deg); opacity: 1; }
  29% { transform: scale(0.96, 1.1) skewX(2deg); opacity: 0.85; }
  38% { transform: scale(1.03, 0.94) skewX(-1.8deg); opacity: 0.97; }
  52% { transform: scale(0.98, 1.06) skewX(0.8deg); opacity: 0.9; }
  63% { transform: scale(1.01, 0.97) skewX(-0.6deg); opacity: 1; }
  77% { transform: scale(0.97, 1.09) skewX(1.2deg); opacity: 0.82; }
  88% { transform: scale(1.02, 0.96) skewX(-1.4deg); opacity: 0.95; }
  100% { transform: scale(1, 1) skewX(0deg); opacity: 1; }
`;
const torchSway = keyframes`
  0%, 100% { transform: skewX(${-DOOR_FLAME.swayDeg}deg); }
  50% { transform: skewX(${DOOR_FLAME.swayDeg}deg); }
`;

/** The flame's box, still: its glow faded toward the edges (so the flicker can't carry it past the doorway). */
const FlameBox = styled.div<{ $sceneBrightness: number }>`
  position: absolute;
  left: ${cqw(DOOR_FLAME.box.x)}cqw;
  top: ${cqw(DOOR_FLAME.box.y)}cqw;
  width: ${cqw(DOOR_FLAME.box.w)}cqw;
  height: ${cqw(DOOR_FLAME.box.h)}cqw;
  z-index: -1;
  pointer-events: none;
  ${() => {
    const at = `${(DOOR_FLAME.base.x - DOOR_FLAME.box.x) / DOOR_FLAME.box.w * 100}% ${((DOOR_FLAME.base.y - DOOR_FLAME.box.y) / DOOR_FLAME.box.h * 100) - 15}%`;
    const fade = `radial-gradient(closest-side at ${at}, #000 ${DOOR_FLAME.fade.from * 100}%, transparent ${DOOR_FLAME.fade.to * 100}%)`;
    return `-webkit-mask-image: ${fade}; mask-image: ${fade};`;
  }}
  transition: filter ${INTRO_WALK_ANIM_TIME}s;
  will-change: filter;
  filter: brightness(${props => DOOR_FLAME.brightness[isLit(props.$sceneBrightness) ? 'play' : 'landing']});
`;
const origin = `${(DOOR_FLAME.base.x - DOOR_FLAME.box.x) / DOOR_FLAME.box.w * 100}% ${(DOOR_FLAME.base.y - DOOR_FLAME.box.y) / DOOR_FLAME.box.h * 100}%`;
const FlameSway = styled.div`
  position: absolute;
  inset: 0;
  transform-origin: ${origin};
  animation: ${torchSway} ${DOOR_FLAME.swaySeconds}s ease-in-out infinite;
`;
const FlameFlicker = styled.div`
  ${crop('background-scene/DoorFlame/Green_Flame.png', DOOR_FLAME.box)}
  left: 0;
  top: 0;
  transform-origin: ${origin};
  animation: ${torchFlicker} ${DOOR_FLAME.flickerSeconds}s ease-in-out infinite;
`;

/** The wall's elements and the torch's flame, brightening with the scene through the intro. */
export default function WallElements({ sceneBrightness }: { sceneBrightness: number }) {
  return (
    <>
      {WALL_ELEMENTS.items.map(item => (
        <Fragment key={item.name}>
          {item.shadow && (
            <FloorShadow $item={item}>
              {[item.shadow.spread, ...item.shadow.contacts].map((spot, k) => <ShadowPatch key={k} $spot={spot} $y={item.shadow!.y} $blur={item.shadow!.blur} />)}
            </FloorShadow>
          )}
          <WallItemImage $item={item} $sceneBrightness={sceneBrightness} />
        </Fragment>
      ))}
      <FlameBox $sceneBrightness={sceneBrightness}>
        <FlameSway><FlameFlicker /></FlameSway>
      </FlameBox>
    </>
  );
}
