import { create } from "zustand";

interface ImpersonatedClient {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  package_tier: string;
  profile_id?: string;
}

export interface ManagedClient {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  package_tier: string;
}

interface AppStore {
  // Admin impersonation — view the app as a specific client
  impersonatedClient: ImpersonatedClient | null;
  setImpersonatedClient: (client: ImpersonatedClient | null) => void;
  isImpersonating: boolean;

  // Admin client management — stay on admin pages but scope data to a client
  managedClient: ManagedClient | null;
  isManaging: boolean;
  setManagedClient: (client: ManagedClient | null) => void;
}

// Restore managed client from localStorage (survives tab close) with sessionStorage fallback
function getPersistedManagedClient(): ManagedClient | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("ss_selected_client") || sessionStorage.getItem("managed_client");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const useAppStore = create<AppStore>((set) => ({
  impersonatedClient: null,
  isImpersonating: false,
  setImpersonatedClient: (client) => set({
    impersonatedClient: client,
    isImpersonating: client !== null,
  }),

  managedClient: getPersistedManagedClient(),
  isManaging: getPersistedManagedClient() !== null,
  setManagedClient: (client) => {
    if (typeof window !== "undefined") {
      if (client) {
        localStorage.setItem("ss_selected_client", JSON.stringify(client));
        sessionStorage.setItem("managed_client", JSON.stringify(client));
      } else {
        localStorage.removeItem("ss_selected_client");
        sessionStorage.removeItem("managed_client");
      }
    }
    set({ managedClient: client, isManaging: client !== null });
  },
}));
