import { useReducedMotion } from 'framer-motion';
import {
  dialogVariants,
  pageVariants,
  reducedDialogVariants,
  reducedPageVariants,
  listContainer,
  listItem,
  reducedListContainer,
  reducedListItem,
  fadeUp,
  reducedFadeUp,
  heroReveal,
  reducedHeroReveal,
} from '../theme/motionPresets';

/**
 * Single hook for all shared, reduced-motion-aware variants used across the
 * premium glass experience. Every variant has a reduced counterpart so
 * prefers-reduced-motion users get opacity-only, sub-100ms transitions.
 */
export function useGlassMotion() {
  const reduced = useReducedMotion();
  return {
    page: reduced ? reducedPageVariants : pageVariants,
    dialog: reduced ? reducedDialogVariants : dialogVariants,
    listContainer: reduced ? reducedListContainer : listContainer,
    listItem: reduced ? reducedListItem : listItem,
    fadeUp: reduced ? reducedFadeUp : fadeUp,
    hero: reduced ? reducedHeroReveal : heroReveal,
    reduced: !!reduced,
  };
}
