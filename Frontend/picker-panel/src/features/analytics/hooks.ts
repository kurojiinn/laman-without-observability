import { useQuery } from "@tanstack/react-query";
import { fetchTopProducts, type AnalyticsPeriod } from "./api";

export function useTopProducts(period: AnalyticsPeriod) {
  return useQuery({
    queryKey: ["picker", "analytics", "top-products", period],
    queryFn: () => fetchTopProducts(period),
    staleTime: 60_000,
  });
}
