import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * draftsStore — persisted auto-save drafts for form pages.
 *
 * Draft key structure: `drafts[entity][id]`
 * Example: `drafts['invoice']['new']` or `drafts['bill']['abc123']`
 *
 * Persisted to localStorage key: drafts.store.v1
 */
interface DraftsState {
  /**
   * Nested map: entity → id → form payload.
   * e.g. { invoice: { new: { customer: 'ACME', ... }, 'abc123': { ... } } }
   */
  drafts: Record<string, Record<string, unknown>>;

  /**
   * Save (or overwrite) a draft for a given entity + id.
   * @param entity - e.g. 'invoice', 'bill', 'purchaseOrder'
   * @param id     - e.g. 'new' or a document ID
   * @param payload - the form values to persist
   */
  saveDraft: (entity: string, id: string, payload: unknown) => void;

  /**
   * Remove a specific draft.
   * @param entity - e.g. 'invoice'
   * @param id     - e.g. 'new' or a document ID
   */
  clearDraft: (entity: string, id: string) => void;

  /**
   * Remove all drafts for a given entity.
   */
  clearEntityDrafts: (entity: string) => void;

  /**
   * Retrieve a draft (returns undefined if not found).
   */
  getDraft: (entity: string, id: string) => unknown;
}

export const useDraftsStore = create<DraftsState>()(
  persist(
    (set, get) => ({
      drafts: {},

      saveDraft: (entity, id, payload) => {
        set((s) => ({
          drafts: {
            ...s.drafts,
            [entity]: {
              ...(s.drafts[entity] ?? {}),
              [id]: payload,
            },
          },
        }));
      },

      clearDraft: (entity, id) => {
        set((s) => {
          const entityDrafts = { ...(s.drafts[entity] ?? {}) };
          delete entityDrafts[id];
          return {
            drafts: {
              ...s.drafts,
              [entity]: entityDrafts,
            },
          };
        });
      },

      clearEntityDrafts: (entity) => {
        set((s) => {
          const updated = { ...s.drafts };
          delete updated[entity];
          return { drafts: updated };
        });
      },

      getDraft: (entity, id) => {
        return get().drafts[entity]?.[id];
      },
    }),
    {
      name: 'drafts.store.v1',
      partialize: (s) => ({ drafts: s.drafts }),
    }
  )
);
