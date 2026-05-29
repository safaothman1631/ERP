import { useReducedMotion } from 'framer-motion';
import { dialogVariants, pageVariants, reducedDialogVariants, reducedPageVariants } from '../theme/motionPresets';

export function useGlassMotion() {
  const reduced = useReducedMotion();
  return {
    page: reduced ? reducedPageVariants : pageVariants,
    dialog: reduced ? reducedDialogVariants : dialogVariants,
    reduced: !!reduced,
  };
}
