import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export const DASHBOARD_QUERY_KEY = ['dashboard'];

/**
 * The dashboard: `{ summary, lowStock, recentMovements }`. `summary` has activeProducts,
 * totalUnits, inventoryValue, lowStockCount and outOfStockCount (archived products excluded).
 * `lowStock` is at most 10 products that are out of stock or low, lowest quantity-to-reorder
 * ratio first. `recentMovements` is the last 10 movements, in the Movements page row shape.
 */
export function useDashboard() {
  return useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: () => api('/dashboard'),
  });
}
