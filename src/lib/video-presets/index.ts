// Curated defaults (hand-picked for the Ads preset)
export {
  ADS_PRESET,
  ADS_MUSIC_LIBRARY,
  filterMusicByMood as filterAdsMusicByMood,
  type AdsPreset,
  type AdsMusicTrack,
  type AdsPresetBrollCategory,
  type AdsPresetSfxCue,
  type AdsPresetTransition,
  type AdsPresetTextAnimation,
} from "./ads";

// Big catalogs (100+ items each)
export {
  FONTS_LIBRARY,
  filterFontsByCategory,
  filterFontsByUseCase,
  getFontById,
  getRandomFont,
  type Font,
  type FontCategory,
} from "./fonts";

export {
  TRANSITIONS_LIBRARY,
  filterTransitionsByCategory,
  getTransitionById,
  getRandomTransition,
  type Transition,
  type TransitionCategory,
} from "./transitions";

export {
  EFFECTS_LIBRARY,
  filterEffectsByCategory,
  getEffectById,
  getRandomEffect,
  type VideoEffect,
  type EffectCategory,
  type EffectParamHint,
} from "./effects";

export {
  SFX_LIBRARY,
  filterSfxByCategory,
  filterSfxByTags,
  getSfxById,
  getRandomSfx,
  type Sfx,
  type SfxCategory,
  type SfxLicense,
  type SfxSource,
} from "./sfx";

export {
  MUSIC_LIBRARY,
  filterMusicByMood,
  filterMusicByGenre,
  filterMusicByEnergy,
  filterMusicByUse,
  filterMusicByBpm,
  getMusicById,
  getRandomMusic,
  type MusicTrack,
  type MusicMood,
  type MusicGenre,
  type MusicKeyUse,
  type MusicLicense,
  type MusicSource,
} from "./music";
