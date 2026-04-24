import { create } from 'zustand';
import api from '../api';

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
    try {
      const res = await api.get(`/api/pos/floors/${floorId}/tables`);
      const tables = res.data.items || [];
      set({ tables });
      
      // Update table states map
      const states: Record<string, string> = {};
      tables.forEach((t: Table) => {
        states[t.id] = t.state;
      });
      set({ tableStates: states });
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
