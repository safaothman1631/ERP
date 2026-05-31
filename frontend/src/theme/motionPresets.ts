export const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.2 } },
};

export const reducedPageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.1 } },
  exit: { opacity: 0, transition: { duration: 0.08 } },
};

export const dialogVariants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.15 } },
};

export const reducedDialogVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.08 } },
  exit: { opacity: 0, transition: { duration: 0.08 } },
};

// ───────────────────────── Staggered list / grid ─────────────────────────
/** Container that staggers its children's entrance. Cap children to keep long
 *  lists interactive — apply only to the first screenful where possible. */
export const listContainer = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.045, delayChildren: 0.02 },
  },
};

export const listItem = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } },
};

export const reducedListContainer = {
  initial: {},
  animate: { transition: { staggerChildren: 0 } },
};

export const reducedListItem = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.1 } },
};

// ───────────────────────── Fade-up (cards, sections) ─────────────────────────
export const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};

export const reducedFadeUp = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.1 } },
};

// ───────────────────────── Hero reveal (role home) ─────────────────────────
export const heroReveal = {
  initial: { opacity: 0, y: 16, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
};

export const reducedHeroReveal = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.12 } },
};
