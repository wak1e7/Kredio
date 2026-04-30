"use client";

import { ListFilters } from "@/components/ui/list-filters";
import { PageHeading } from "@/components/ui/page-heading";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Panel } from "@/components/ui/panel";
import { Plus } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type CustomerOption = { id: string; fullName: string };
type CampaignOption = { id: string; name: string };
type PurchaseItemRow = {
  id: string;
  code: string;
  name: string;
  category?: (typeof CATEGORY_OPTIONS)[number] | null;
  size?: string | null;
  color?: string | null;
  quantity: number;
  costPrice: number;
  salePrice: number;
};

type PurchaseRow = {
  id: string;
  purchaseDate: string;
  source: "DIRECT" | "WAREHOUSE_TRANSFER";
  customerId: string;
  customerName: string;
  campaignId: string;
  campaignName: string;
  itemsCount: number;
  totalAmount: number;
  items: PurchaseItemRow[];
};

const currencyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  maximumFractionDigits: 2,
});

const CATEGORY_OPTIONS = ["Sokso", "Footloose", "Leonisa"] as const;
const PURCHASES_PER_PAGE = 10;

function toDateInputValue(value: string) {
  return value.slice(0, 10);
}

function toPurchaseDateIso(value: string) {
  return new Date(`${value}T12:00:00`).toISOString();
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function getPurchaseBrand(items: PurchaseItemRow[]) {
  const brands = [...new Set(items.map((item) => item.category?.trim()).filter(Boolean))];
  return brands.length > 0 ? brands.join(" / ") : "-";
}

export default function ComprasPage() {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [campaignFilterOptions, setCampaignFilterOptions] = useState<CampaignOption[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingPurchaseId, setDeletingPurchaseId] = useState<string | null>(null);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [editingPurchaseSource, setEditingPurchaseSource] = useState<"DIRECT" | "WAREHOUSE_TRANSFER" | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("all");

  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]>("Sokso");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [costPrice, setCostPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");

  const syncCustomerSelection = useCallback(
    (value: string) => {
      setCustomerSearch(value);
      const normalizedValue = normalizeText(value);
      const matchedCustomer = customers.find((customer) => normalizeText(customer.fullName) === normalizedValue);
      setCustomerId(matchedCustomer?.id ?? "");
    },
    [customers],
  );

  function resetProductForm() {
    setEditingPurchaseId(null);
    setEditingPurchaseSource(null);
    setCustomerId("");
    setCustomerSearch("");
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setCode("");
    setName("");
    setCategory("Sokso");
    setSize("");
    setColor("");
    setQuantity("1");
    setCostPrice("");
    setSalePrice("");
  }

  const loadData = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    const [customersRes, campaignsRes, campaignFilterRes, purchasesRes] = await Promise.all([
      fetch("/api/customers?status=ACTIVE", { cache: "no-store" }),
      fetch("/api/campaigns?status=OPEN", { cache: "no-store" }),
      fetch("/api/campaigns", { cache: "no-store" }),
      fetch("/api/purchases", { cache: "no-store" }),
    ]);

    const customersJson = (await customersRes.json()) as { data?: Array<{ id: string; fullName: string }>; error?: string };
    const campaignsJson = (await campaignsRes.json()) as { data?: Array<{ id: string; name: string }>; error?: string };
    const campaignFilterJson = (await campaignFilterRes.json()) as { data?: Array<{ id: string; name: string }>; error?: string };
    const purchasesJson = (await purchasesRes.json()) as { data?: PurchaseRow[]; error?: string };

    if (!customersRes.ok || !campaignsRes.ok || !campaignFilterRes.ok || !purchasesRes.ok) {
      setError(customersJson.error ?? campaignsJson.error ?? campaignFilterJson.error ?? purchasesJson.error ?? "No se pudieron cargar las compras.");
      setIsLoading(false);
      return;
    }

    const customerData = [...(customersJson.data ?? [])].sort((a, b) =>
      a.fullName.localeCompare(b.fullName, "es", { sensitivity: "base" }),
    );
    setCustomers(customerData);
    setCampaigns(campaignsJson.data ?? []);
    setCampaignFilterOptions(campaignFilterJson.data ?? []);
    setPurchases(purchasesJson.data ?? []);
    setCurrentPage(1);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadData();
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [loadData]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const parsedQuantity = Number(quantity);
    const parsedCostPrice = Number(costPrice);
    const parsedSalePrice = Number(salePrice);

    if (!customerId || !campaignId || !purchaseDate) {
      setError("Selecciona un cliente, una campaña y la fecha de compra.");
      return;
    }

    if (
      !code ||
      !name ||
      !category ||
      !Number.isFinite(parsedQuantity) ||
      !Number.isFinite(parsedCostPrice) ||
      !Number.isFinite(parsedSalePrice)
    ) {
      setError("Completa los campos del producto.");
      return;
    }

    setIsSaving(true);
    const isEditing = Boolean(editingPurchaseId);
    const response = await fetch(isEditing ? `/api/purchases/${editingPurchaseId}` : "/api/purchases", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId,
        campaignId,
        purchaseDate: toPurchaseDateIso(purchaseDate),
        items: [
          {
            code,
            name,
            category,
            size: size || undefined,
            color: color || undefined,
            quantity: parsedQuantity,
            costPrice: parsedCostPrice,
            salePrice: parsedSalePrice,
          },
        ],
      }),
    });

    const json = (await response.json()) as { error?: string };
    setIsSaving(false);

    if (!response.ok) {
      setError(json.error ?? `No se pudo ${isEditing ? "actualizar" : "registrar"} la compra.`);
      return;
    }

    resetProductForm();
    setSuccessMessage(isEditing ? "Compra actualizada correctamente." : "Compra registrada correctamente.");
    setShowCreateForm(false);
    await loadData();
  }

  const filteredPurchases = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return purchases.filter((purchase) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        purchase.customerName.toLowerCase().includes(normalizedQuery) ||
        purchase.campaignName.toLowerCase().includes(normalizedQuery);

      const matchesCampaign = campaignFilter === "all" || purchase.campaignId === campaignFilter;

      return matchesQuery && matchesCampaign;
    });
  }, [campaignFilter, purchases, query]);

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = customerSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return customers;
    }

    return customers.filter((customer) => customer.fullName.toLowerCase().includes(normalizedSearch));
  }, [customerSearch, customers]);

  const filteredTotalPages = Math.max(1, Math.ceil(filteredPurchases.length / PURCHASES_PER_PAGE));
  const paginatedPurchases = filteredPurchases.slice(
    (currentPage - 1) * PURCHASES_PER_PAGE,
    currentPage * PURCHASES_PER_PAGE,
  );

  function onEditPurchase(purchase: PurchaseRow) {
    if (purchase.items.length !== 1) {
      setError("Por ahora solo se pueden editar compras con un solo producto registrado.");
      return;
    }

    const item = purchase.items[0];

    if (!item) {
      setError("La compra no tiene productos editables.");
      return;
    }

    setEditingPurchaseId(purchase.id);
    setEditingPurchaseSource(purchase.source);
    setCustomerId(purchase.customerId);
    setCustomerSearch(purchase.customerName);
    setCampaignId(purchase.campaignId);
    setPurchaseDate(toDateInputValue(purchase.purchaseDate));
    setCode(item.code);
    setName(item.name);
    setCategory((item.category as (typeof CATEGORY_OPTIONS)[number] | null) ?? "Sokso");
    setSize(item.size ?? "");
    setColor(item.color ?? "");
    setQuantity(String(item.quantity));
    setCostPrice(String(item.costPrice));
    setSalePrice(String(item.salePrice));
    setError(null);
    setSuccessMessage(null);
    setShowCreateForm(true);
  }

  async function onDeletePurchase(purchase: PurchaseRow) {
    const confirmed = window.confirm(`¿Seguro que quieres eliminar la compra de ${purchase.customerName}?`);
    if (!confirmed) {
      return;
    }

    setDeletingPurchaseId(purchase.id);
    setError(null);
    setSuccessMessage(null);

    const response = await fetch(`/api/purchases/${purchase.id}`, {
      method: "DELETE",
    });

    const json = (await response.json()) as { error?: string };
    setDeletingPurchaseId(null);

    if (!response.ok) {
      setError(json.error ?? "No se pudo eliminar la compra.");
      return;
    }

    if (editingPurchaseId === purchase.id) {
      resetProductForm();
      setShowCreateForm(false);
    }

    setSuccessMessage("Compra eliminada correctamente.");
    await loadData();
  }

  return (
    <div className="space-y-4">
      <PageHeading
        overline="Registro de compras"
        title="Compras por cliente y campaña"
        description="Registra productos vendidos a crédito y asígnalos a la campaña correspondiente."
        actions={
          <button
            type="button"
            onClick={() => {
              if (showCreateForm) {
                setShowCreateForm(false);
                resetProductForm();
                return;
              }

              resetProductForm();
              setShowCreateForm(true);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            {showCreateForm ? "Cerrar formulario" : "Nueva compra"}
          </button>
        }
      />

      {showCreateForm ? (
        <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <Panel delay={190}>
            <h2 className="text-lg font-semibold">{editingPurchaseId ? "Editar compra" : "Nueva compra"}</h2>
            <form className="mt-4 space-y-3" onSubmit={onSubmit}>
              <div className="rounded-2xl border bg-[var(--surface)] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Paso 1</p>
                <p className="mt-1 font-semibold">Seleccionar cliente</p>
                <input
                  list="purchase-customers"
                  className="mt-2 h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-sm"
                  placeholder="Buscar y seleccionar cliente..."
                  value={customerSearch}
                  onChange={(event) => syncCustomerSelection(event.target.value)}
                  required
                />
                <datalist id="purchase-customers">
                  {filteredCustomers.map((customer) => (
                    <option key={customer.id} value={customer.fullName} />
                  ))}
                </datalist>
              </div>

              <div className="rounded-2xl border bg-[var(--surface)] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Paso 2</p>
                <p className="mt-1 font-semibold">Seleccionar campaña</p>
                <select
                  className="mt-2 h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-sm"
                  value={campaignId}
                  onChange={(event) => setCampaignId(event.target.value)}
                  disabled={editingPurchaseSource === "WAREHOUSE_TRANSFER"}
                >
                  <option value="">Seleccionar campaña</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border bg-[var(--surface)] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Paso 3</p>
                <p className="mt-1 font-semibold">Seleccionar fecha de compra</p>
                <input
                  type="date"
                  className="mt-2 h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-sm"
                  value={purchaseDate}
                  onChange={(event) => setPurchaseDate(event.target.value)}
                  required
                />
              </div>

              <div className="rounded-2xl border bg-[var(--surface)] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Paso 4</p>
                <p className="mt-1 font-semibold">Agregar productos</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  <select
                    className="h-10 rounded-xl border bg-[var(--surface)] px-3 text-sm"
                    value={category}
                    onChange={(event) => setCategory(event.target.value as (typeof CATEGORY_OPTIONS)[number])}
                    disabled={editingPurchaseSource === "WAREHOUSE_TRANSFER"}
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <input className="h-10 rounded-xl border px-3 text-sm" placeholder="Código" value={code} onChange={(event) => setCode(event.target.value)} required disabled={editingPurchaseSource === "WAREHOUSE_TRANSFER"} />
                  <input className="h-10 rounded-xl border px-3 text-sm" placeholder="Nombre" value={name} onChange={(event) => setName(event.target.value)} required disabled={editingPurchaseSource === "WAREHOUSE_TRANSFER"} />
                  <input className="h-10 rounded-xl border px-3 text-sm" placeholder="Talla" value={size} onChange={(event) => setSize(event.target.value)} disabled={editingPurchaseSource === "WAREHOUSE_TRANSFER"} />
                  <input className="h-10 rounded-xl border px-3 text-sm" placeholder="Color" value={color} onChange={(event) => setColor(event.target.value)} disabled={editingPurchaseSource === "WAREHOUSE_TRANSFER"} />
                  <input className="h-10 rounded-xl border px-3 text-sm" placeholder="Cantidad" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
                  <input className="h-10 rounded-xl border px-3 text-sm" placeholder="Precio de costo" value={costPrice} onChange={(event) => setCostPrice(event.target.value)} required disabled={editingPurchaseSource === "WAREHOUSE_TRANSFER"} />
                  <input className="h-10 rounded-xl border px-3 text-sm" placeholder="Precio de venta" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} required disabled={editingPurchaseSource === "WAREHOUSE_TRANSFER"} />
                </div>
              </div>

              <button type="submit" disabled={isSaving} className="h-10 w-full rounded-xl bg-[var(--accent)] text-sm font-semibold text-white disabled:opacity-60">
                {isSaving ? "Guardando..." : editingPurchaseId ? "Actualizar compra" : "Confirmar compra"}
              </button>
              {editingPurchaseId ? (
                <button
                  type="button"
                  onClick={() => {
                    resetProductForm();
                    setSuccessMessage(null);
                    setShowCreateForm(false);
                  }}
                  className="h-10 w-full rounded-xl border text-sm font-semibold"
                >
                  Cancelar edición
                </button>
              ) : null}
            </form>
          </Panel>

          <Panel delay={250}>
            <h2 className="text-lg font-semibold">Resultado esperado</h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--foreground-muted)]">
              <li className="rounded-xl border bg-[var(--surface)] p-3">Se registra la compra con su detalle de productos.</li>
              <li className="rounded-xl border bg-[var(--surface)] p-3">Se incrementa la deuda de la campaña seleccionada.</li>
              <li className="rounded-xl border bg-[var(--surface)] p-3">Se actualiza la deuda total del cliente.</li>
              {editingPurchaseSource === "WAREHOUSE_TRANSFER" ? (
                <li className="rounded-xl border bg-[var(--surface)] p-3">
                  La compra viene desde almacén: aquí puedes ajustar cliente, fecha y cantidad sin perder consistencia de stock.
                </li>
              ) : null}
            </ul>
            {successMessage ? <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{successMessage}</p> : null}
          </Panel>
        </section>
      ) : null}

      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p> : null}

      <Panel delay={280}>
        <ListFilters
          search={{
            label: "Buscar compra",
            placeholder: "Buscar por cliente o campaña...",
            value: query,
            onChange: (value) => {
              setQuery(value);
              setCurrentPage(1);
            },
          }}
        >
          <select
            className="h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-sm text-[var(--foreground-muted)]"
            value={campaignFilter}
            onChange={(event) => {
              setCampaignFilter(event.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">Todas las campañas</option>
            {campaignFilterOptions.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </ListFilters>
      </Panel>

      <Panel delay={310}>
        <h2 className="text-lg font-semibold">Últimas compras registradas</h2>
        {isLoading ? (
          <p className="mt-3 text-sm text-[var(--foreground-muted)]">Cargando compras...</p>
        ) : filteredPurchases.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--foreground-muted)]">No hay compras para mostrar con el filtro actual.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
                <tr>
                  <th className="pb-2 font-semibold">Fecha</th>
                  <th className="pb-2 font-semibold">Cliente</th>
                  <th className="pb-2 font-semibold">Campaña</th>
                  <th className="pb-2 font-semibold">Marca</th>
                  <th className="pb-2 font-semibold">Items</th>
                  <th className="pb-2 font-semibold">Total</th>
                  <th className="pb-2 font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPurchases.map((purchase) => (
                  <tr key={purchase.id} className="border-t border-[var(--border)]/80">
                    <td className="py-3 text-[var(--foreground-muted)]">{new Date(purchase.purchaseDate).toLocaleDateString("es-PE")}</td>
                    <td className="py-3 font-medium">{purchase.customerName}</td>
                    <td className="py-3">{purchase.campaignName}</td>
                    <td className="py-3">{getPurchaseBrand(purchase.items)}</td>
                    <td className="py-3">{purchase.itemsCount}</td>
                    <td className="py-3">{currencyFormatter.format(purchase.totalAmount)}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onEditPurchase(purchase)}
                          disabled={purchase.items.length !== 1}
                          title={
                            purchase.items.length !== 1
                              ? "La edición con varios productos aún no está disponible."
                              : undefined
                          }
                          className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeletePurchase(purchase)}
                          disabled={deletingPurchaseId === purchase.id}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingPurchaseId === purchase.id ? "Eliminando..." : "Eliminar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls
              currentPage={currentPage}
              totalPages={filteredTotalPages}
              onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))}
              onNext={() => setCurrentPage((page) => Math.min(filteredTotalPages, page + 1))}
            />
          </div>
        )}
      </Panel>
    </div>
  );
}
