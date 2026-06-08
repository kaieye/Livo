import { create } from 'zustand';

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  rollout: number;
  created_at: string;
  updated_at: string;
}

interface FeatureFlagsStore {
  flags: FeatureFlag[];
  loading: boolean;
  error: string | null;

  fetchFlags: () => Promise<void>;
  updateFlag: (key: string, data: { enabled?: boolean; rollout?: number }) => Promise<void>;
  checkFlag: (key: string) => Promise<{ enabled: boolean; flag: FeatureFlag }>;
}

export const useFeatureFlagsStore = create<FeatureFlagsStore>((set, get) => ({
  flags: [],
  loading: false,
  error: null,

  fetchFlags: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch('/admin/feature-flags', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch feature flags');
      }

      const flags = await response.json();
      set({ flags, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  updateFlag: async (key: string, data: { enabled?: boolean; rollout?: number }) => {
    set({ error: null });
    try {
      const response = await fetch(`/admin/feature-flags/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update feature flag');
      }

      const updatedFlag = await response.json();

      // Update local state
      set((state) => ({
        flags: state.flags.map((f) =>
          f.key === key ? updatedFlag : f
        ),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  checkFlag: async (key: string) => {
    try {
      const response = await fetch(`/api/feature-flags/${encodeURIComponent(key)}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to check feature flag');
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  },
}));
