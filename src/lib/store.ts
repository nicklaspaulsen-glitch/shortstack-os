import { create } from "zustand";

interface ImpersonatedClient {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  package_tier: string;
  profile_id?: string;
}

interface AppStore {
  // Admin impersonation — view the app as a specific client
  impersonatedClient: ImpersonatedClient | null;
  setImpersonatedClient: (client: ImpersonatedClient | null) => void;
  isImpersonating: boolean;
}

export const useAppStore = create<AppStore>((set) => ({
  impersonatedClient: null,
  isImpersonating: false,
  setImpersonatedClient: (client) => set({
    impersonatedClient: client,
    isImpersonating: client !== null,
  }),
}));
