import { create } from 'zustand';
import api from '../api';
import { getPOSDB } from './pos/db';

interface Floor {
  id: string;
  name: string;
  name_ku?: string;
  config_id: string;
  sequence: number;
  background_image_url?: string;
  is_active: boolean;
}

interface Table {
  id: string;
  floor_id: string;
  config_id: string;
  name: string;
  seats: number;
  shape: 'square' | 'round' | 'rectangle';
  width: number;
  height: number;
  position_x: number;
  position_y: number;
  color: string;
  state: 'available' | 'occupied' | 'reserved' | 'paying';
  current_order_id?: string;
  current_guests: number;
  occupied_at?: string;
  is_active: boolean;
}

interface POSFloorStore {
  floors: Floor[];
  tables: Table[];
  activeFloorId: string | null;
  tableStates: Record<string, string>;
  loading: boolean;

  loadFloors: (configId: string) => Promise<void>;
  loadTables: (floorId: string) => Promise<void>;
  setActiveFloor: (floorId: string) => void;
  updateTableLocal: (tableId: string, partial: Partial<Table>) => void;
  refresh: () => Promise<void>;
}

/**
 * Best-effort cache helpers — read the last-known floor + tables from
 * IndexedDB so the UI can render instantly while a fresh network fetch
 * runs. Failures are silent; the network result is always the source of
 * truth.
 */
async function cacheFloor(floor: Floor, tables: Table[]): Promise<void> {
  try {
    const db = await getPOSDB();
    await db.put('floors', {
      floorId: floor.id,
      configId: floor.config_id,
      name: floor.name,
      nameKu: floor.name_ku,
      sequence: floor.sequence,
      backgroundImageUrl: floor.background_image_url,
      isActive: floor.is_active,
      tables,
      updatedAt: Date.now(),
    });
  } catch {
    /* noop */
  }
}

async function readCachedTables(floorId: string): Promise<Table[] | null> {
  try {
    const db = await getPOSDB();
    const row = await db.get('floors', floorId);
    return (row?.tables as Table[] | undefined) ?? null;
  } catch {
    return null;
  }
}

export const usePOSFloorStore = create<POSFloorStore>((set, get) => ({
  floors: [],
  tables: [],
  activeFloorId: null,
  tableStates: {},
  loading: false,

  loadFloors: async (configId: string) => {
    try {
      set({ loading: true });
      const res = await api.get('/api/pos/floors', { params: { config_id: configId } });
      set({ floors: res.data.items || [], loading: false });

      // Set first floor as active if none selected
      const floors = res.data.items || [];
      if (floors.length > 0 && !get().activeFloorId) {
        set({ activeFloorId: floors[0].id });
        get().loadTables(floors[0].id);
      }
    } catch (error) {
      console.error('Failed to load floors:', error);
      set({ loading: false });
    }
  },

  loadTables: async (floorId: string) => {
    // 1. Optimistically render cached tables (if any) — keeps UI snappy on
    //    cold reload when the network is slow.
    const cached = await readCachedTables(floorId);
    if (cached && cached.length > 0) {
      set({ tables: cached });
      const states: Record<string, string> = {};
      cached.forEach((t) => {
        states[t.id] = t.state;
      });
      set({ tableStates: states });
    }

    try {
      const res = await api.get(`/api/pos/floors/${floorId}/tables`);
      const tables: Table[] = res.data.items || [];
      set({ tables });

      // Update table states map
      const states: Record<string, string> = {};
      tables.forEach((t) => {
        states[t.id] = t.state;
      });
      set({ tableStates: states });

      // Persist for next cold load.
      const floor = get().floors.find((f) => f.id === floorId);
      if (floor) {
        void cacheFloor(floor, tables);
      }
    } catch (error) {
      console.error('Failed to load tables:', error);
    }
  },

  setActiveFloor: (floorId: string) => {
    set({ activeFloorId: floorId });
    get().loadTables(floorId);
  },

  updateTableLocal: (tableId: string, partial: Partial<Table>) => {
    set((state) => ({
      tables: state.tables.map((t) =>
        t.id === tableId ? { ...t, ...partial } : t
      ),
    }));

    if (partial.state) {
      set((state) => ({
        tableStates: { ...state.tableStates, [tableId]: partial.state as string },
      }));
    }
  },

  refresh: async () => {
    const { activeFloorId } = get();
    if (activeFloorId) {
      await get().loadTables(activeFloorId);
    }
  },
}));
