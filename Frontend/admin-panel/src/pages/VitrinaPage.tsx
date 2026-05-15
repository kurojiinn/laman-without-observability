import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addFeatured, deleteFeatured, fetchFeatured, fetchFeaturedProducts, searchProductsByName } from "../api/admin";
import { PageHeader, Card, Btn, Input, ProductSearchInput } from "../components/Layout";
import type { FeaturedBlockType, Product } from "../types";
import { FEATURED_BLOCK_LABELS } from "../types";

interface Props { user: string; password: string; }

const BLOCKS = Object.keys(FEATURED_BLOCK_LABELS) as FeaturedBlockType[];

const apiBase = window.location.origin;

function resolveImg(url: string | null | undefined) {
  if (!url) return null;
  try {
    const { pathname } = new URL(url);
    return `${window.location.origin}${pathname}`;
  } catch {
    return `${window.location.origin}${url}`;
  }
}

export function VitrinaPage({ user, password }: Props) {
  const qc = useQueryClient();
  const [block, setBlock] = useState<FeaturedBlockType>("new_items");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [position, setPosition] = useState("0");

  const featuredItemsQ = useQuery({
    queryKey: ["featured-items", block, user],
    queryFn: () => fetchFeatured(user, password, block),
  });

  const featuredProductsQ = useQuery({
    queryKey: ["featured-products", block],
    queryFn: () => fetchFeaturedProducts(block),
  });

  const searchQ = useQuery({
    queryKey: ["product-search", search],
    queryFn: () => searchProductsByName(search),
    enabled: search.trim().length >= 2,
    staleTime: 10_000,
  });

  const addMut = useMutation({
    mutationFn: () => addFeatured(user, password, {
      product_id: selectedId,
      block_type: block,
      position: Math.max(0, parseInt(position) || 0),
    }),
    onSuccess: () => {
      setSelectedId(""); setSelectedName(""); setSearch(""); setPosition("0");
      qc.invalidateQueries({ queryKey: ["featured-items", block] });
      qc.invalidateQueries({ queryKey: ["featured-products", block] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFeatured(user, password, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["featured-items", block] });
      qc.invalidateQueries({ queryKey: ["featured-products", block] });
    },
  });

  // Build a map: productId -> FeaturedItem.id (for deletion)
  const itemIdByProductId = new Map(
    (featuredItemsQ.data ?? []).map((fi) => [fi.product_id, fi.id])
  );

  const products: Product[] = featuredProductsQ.data ?? [];

  return (
    <div className="p-6">
      <PageHeader
        title="Витрина"
        subtitle="Управление блоками на главном экране клиентского приложения"
      />

      {/* Block selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {BLOCKS.map((b) => (
          <button
            key={b}
            onClick={() => setBlock(b)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              block === b
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
            }`}
          >
            {FEATURED_BLOCK_LABELS[b]}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr,360px]">
        {/* Current products */}
        <Card>
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">
              {FEATURED_BLOCK_LABELS[block]}
            </h2>
            <span className="text-xs text-gray-400">{products.length} товаров</span>
          </div>
          {featuredProductsQ.isLoading ? (
            <div className="px-5 py-10 text-center text-gray-400 text-sm">Загрузка...</div>
          ) : products.length === 0 ? (
            <div className="px-5 py-10 text-center text-gray-400">
              <p className="text-3xl mb-2">🛍️</p>
              <p className="text-sm">Блок пуст — добавьте товары</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {products.map((p, idx) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <span className="text-xs font-bold text-gray-300 w-5 text-center">{idx + 1}</span>
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                    {p.image_url
                      ? <img src={resolveImg(p.image_url)!} alt={p.name} className="w-full h-full object-cover" />
                      : <span className="text-gray-300">🛍️</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.price.toLocaleString("ru-RU")} ₽</p>
                  </div>
                  <button
                    onClick={() => {
                      const fid = itemIdByProductId.get(p.id);
                      if (fid) deleteMut.mutate(fid);
                    }}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                    title="Убрать из витрины"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Add product panel */}
        <Card className="p-5 h-fit">
          <h3 className="font-bold text-gray-900 mb-4">Добавить в витрину</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Товар</label>
              <ProductSearchInput
                value={selectedId}
                name={selectedName}
                onSelect={(id, name) => { setSelectedId(id); setSelectedName(name); if (!id) setSearch(name); }}
                onClear={() => { setSelectedId(""); setSelectedName(""); setSearch(""); }}
                searchResults={searchQ.data ?? []}
                isSearching={searchQ.isLoading}
              />
            </div>
            <Input
              label="Позиция (порядок отображения)"
              type="number"
              value={position}
              onChange={setPosition}
              placeholder="0"
            />
            <Btn
              onClick={() => addMut.mutate()}
              disabled={!selectedId || addMut.isPending}
              className="w-full justify-center"
            >
              {addMut.isPending ? "Добавление..." : "Добавить в «" + FEATURED_BLOCK_LABELS[block].replace(/^[^\s]+\s/, "") + "»"}
            </Btn>
            {addMut.isError && (
              <p className="text-xs text-red-500">
                {(addMut.error as any)?.response?.data?.error ?? "Ошибка добавления"}
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
