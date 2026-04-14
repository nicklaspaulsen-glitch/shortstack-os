import { useAppStore, ManagedClient } from "@/lib/store";

/**
 * Returns the currently managed client (if admin is managing one).
 * Pages can use `clientId` to scope their data queries.
 * Returns null values when not managing any client.
 */
export function useManagedClient(): {
  managedClient: ManagedClient | null;
  clientId: string | null;
  isManaging: boolean;
} {
  const { managedClient, isManaging } = useAppStore();
  return {
    managedClient,
    clientId: managedClient?.id ?? null,
    isManaging,
  };
}
