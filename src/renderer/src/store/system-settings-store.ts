import { create } from 'zustand';

interface SystemSetting {
  id: string;
  key: string;
  value: string;
  category: string;
  created_at: string;
  updated_at: string;
}

interface SystemSettingsStore {
  settings: SystemSetting[];
  loading: boolean;
  error: string | null;

  fetchSettings: (category?: string) => Promise<void>;
  updateSetting: (key: string, value: string) => Promise<void>;
  batchUpdateSettings: (updates: Array<{ key: string; value: string }>) => Promise<void>;
}

export const useSystemSettingsStore = create<SystemSettingsStore>((set, get) => ({
  settings: [],
  loading: false,
  error: null,

  fetchSettings: async (category?: string) => {
    set({ loading: true, error: null });
    try {
      const url = category
        ? `/admin/settings?category=${encodeURIComponent(category)}`
        : '/admin/settings';

      const response = await fetch(url, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }

      const settings = await response.json();
      set({ settings, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  updateSetting: async (key: string, value: string) => {
    set({ error: null });
    try {
      const response = await fetch(`/admin/settings/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ value }),
      });

      if (!response.ok) {
        throw new Error('Failed to update setting');
      }

      const updatedSetting = await response.json();

      // Update local state
      set((state) => ({
        settings: state.settings.map((s) =>
          s.key === key ? updatedSetting : s
        ),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  batchUpdateSettings: async (updates: Array<{ key: string; value: string }>) => {
    set({ error: null });
    try {
      const response = await fetch('/admin/settings/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        throw new Error('Failed to batch update settings');
      }

      // Refresh all settings after batch update
      await get().fetchSettings();
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },
}));
