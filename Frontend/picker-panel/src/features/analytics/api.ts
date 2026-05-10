import { z } from "zod";
import { httpRequest } from "../../shared/api/http";

export type AnalyticsPeriod = "day" | "week" | "month";

const topProductSchema = z.object({
  name: z.string(),
  image_url: z.string().nullable().optional(),
  total_qty: z.number(),
  total_revenue: z.number(),
});

const topProductsResponseSchema = z.object({
  period: z.enum(["day", "week", "month"]),
  items: z.array(topProductSchema).nullish().transform((v) => v ?? []),
});

export type TopProduct = {
  name: string;
  imageUrl: string | null;
  totalQty: number;
  totalRevenue: number;
};

export async function fetchTopProducts(period: AnalyticsPeriod): Promise<TopProduct[]> {
  const data = await httpRequest<unknown>(
    `/api/v1/picker/analytics/top-products?period=${period}`,
    { authorized: true },
  );
  const parsed = topProductsResponseSchema.parse(data);
  return parsed.items.map((it) => ({
    name: it.name,
    imageUrl: it.image_url ?? null,
    totalQty: it.total_qty,
    totalRevenue: it.total_revenue,
  }));
}
