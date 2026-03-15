"use client";

import { PageHeading } from "@/components/ui/page-heading";
import { Panel } from "@/components/ui/panel";
import { Plus } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";

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

export default function ComprasPage() {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]>("Sokso");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [costPrice, setCostPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");

  function resetProductForm() {
    setEditingPurchaseId(null);
    setCode("");
    setName("");
    setCategory("Sokso");
    setSize("");
    setColor("");
    setQuantity("1");
    setCostPrice("");
    setSalePrice("");
  }

  const loadData = useCallback(async (retrySeed = true) => {
    setError(null);
    setIsLoading(true);

    let hasRetriedSeed = false;

    while (true) {
      const [customersRes, campaignsRes, purchasesRes] = await Promise.all([
        fetch("/api/customers?status=ACTIVE", { cache: "no-store" }),
        fetch("/api/campaigns?status=OPEN", { cache: "no-store" }),
        fetch("/api/purchases", { cache: "no-store" }),
      ]);

      if ((customersRes.status === 404 || campaignsRes.status === 404 || purchasesRes.status === 404) && retrySeed && !hasRetriedSeed) {
        hasRetriedSeed = true;
        await fetch("/api/setup/dev-seed", { method: "POST", body: JSON.stringify({}) });
        continue;
      }

      const customersJson = (await customersRes.json()) as { data?: Array<{ id: string; fullName: string }>; error?: string };
      const campaignsJson = (await campaignsRes.json()) as { data?: Array<{ id: string; name: string }>; error?: string };
      const purchasesJson = (await purchasesRes.json()) as { data?: PurchaseRow[]; error?: string };

      if (!customersRes.ok || !campaignsRes.ok || !purchasesRes.ok) {
        setError(customersJson.error ?? campaignsJson.error ?? purchasesJson.error ?? "No se pudo cargar compras.");
        setIsLoading(false);
        return;
      }

      const customerData = customersJson.data ?? [];
      const campaignData = campaignsJson.data ?? [];
      const purchaseData = purchasesJson.data ?? [];

      setCustomers(customerData);
      setCampaigns(campaignData);
      setPurchases(purchaseData);
      setCurrentPage(1);

      if (!customerId && customerData[0]) {
        setCustomerId(customerData[0].id);
      }

      if (!campaignId && campaignData[0]) {
        setCampaignId(campaignData[0].id);
      }

      setIsLoading(false);
      return;
    }
  }, [campaignId, customerId]);

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

    if (!customerId || !campaignId) {
      setError("Selecciona cliente y campana.");
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
    await loadData(false);
  }

  const totalPages = Math.max(1, Math.ceil(purchases.length / PURCHASES_PER_PAGE));
  const paginatedPurchases = purchases.slice(
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
    setCustomerId(purchase.customerId);
    setCampaignId(purchase.campaignId);
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

  return (
    <div className="space-y-4">
      <PageHeading
        overline="Registro de compras"
        title="Compras por cliente y campana"
        description="Flujo guiado para registrar productos vendidos a credito."
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
            {showCreateForm ? "Cerrar" : "Nueva compra"}
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
                <select
                  className="mt-2 h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-sm"
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                >
                  <option value="">Seleccionar cliente</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border bg-[var(--surface)] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Paso 2</p>
                <p className="mt-1 font-semibold">Seleccionar campana</p>
                <select
                  className="mt-2 h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-sm"
                  value={campaignId}
                  onChange={(event) => setCampaignId(event.target.value)}
                >
                  <option value="">Seleccionar campana</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border bg-[var(--surface)] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Paso 3</p>
                <p className="mt-1 font-semibold">Agregar productos</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  <input className="h-10 rounded-xl border px-3 text-sm" placeholder="Codigo" value={code} onChange={(event) => setCode(event.target.value)} required />
                  <input className="h-10 rounded-xl border px-3 text-sm" placeholder="Nombre" value={name} onChange={(event) => setName(event.target.value)} required />
                  <select className="h-10 rounded-xl border bg-[var(--surface)] px-3 text-sm" value={category} onChange={(event) => setCategory(event.target.value as (typeof CATEGORY_OPTIONS)[number])}>
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <input className="h-10 rounded-xl border px-3 text-sm" placeholder="Talla" value={size} onChange={(event) => setSize(event.target.value)} />
                  <input className="h-10 rounded-xl border px-3 text-sm" placeholder="Color" value={color} onChange={(event) => setColor(event.target.value)} />
                  <input className="h-10 rounded-xl border px-3 text-sm" placeholder="Cantidad" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
                  <input className="h-10 rounded-xl border px-3 text-sm" placeholder="Precio de costo" value={costPrice} onChange={(event) => setCostPrice(event.target.value)} required />
                  <input className="h-10 rounded-xl border px-3 text-sm" placeholder="Precio de venta" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} required />
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
                  Cancelar edicion
                </button>
              ) : null}
            </form>
          </Panel>

          <Panel delay={250}>
            <h2 className="text-lg font-semibold">Resultado esperado</h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--foreground-muted)]">
              <li className="rounded-xl border bg-[var(--surface)] p-3">Se registra la compra con su detalle de productos.</li>
              <li className="rounded-xl border bg-[var(--surface)] p-3">Se incrementa la deuda de la campana seleccionada.</li>
              <li className="rounded-xl border bg-[var(--surface)] p-3">Se actualiza la deuda total del cliente.</li>
            </ul>
            {successMessage ? <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{successMessage}</p> : null}
          </Panel>
        </section>
      ) : null}

      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p> : null}

      <Panel delay={310}>
        <h2 className="text-lg font-semibold">Ultimas compras registradas</h2>
        {isLoading ? (
          <p className="mt-3 text-sm text-[var(--foreground-muted)]">Cargando compras...</p>
        ) : purchases.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--foreground-muted)]">No hay compras registradas.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
                <tr>
                  <th className="pb-2 font-semibold">Fecha</th>
                  <th className="pb-2 font-semibold">Cliente</th>
                  <th className="pb-2 font-semibold">Campana</th>
                  <th className="pb-2 font-semibold">Items</th>
                  <th className="pb-2 font-semibold">Total</th>
                  <th className="pb-2 font-semibold">Accion</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPurchases.map((purchase) => (
                  <tr key={purchase.id} className="border-t border-[var(--border)]/80">
                    <td className="py-3 text-[var(--foreground-muted)]">{new Date(purchase.purchaseDate).toLocaleDateString("es-PE")}</td>
                    <td className="py-3 font-medium">{purchase.customerName}</td>
                    <td className="py-3">{purchase.campaignName}</td>
                    <td className="py-3">{purchase.itemsCount}</td>
                    <td className="py-3">{currencyFormatter.format(purchase.totalAmount)}</td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => onEditPurchase(purchase)}
                        disabled={purchase.items.length !== 1}
                        title={
                          purchase.items.length !== 1
                            ? "La edicion multiproducto aun no esta disponible."
                            : undefined
                        }
                        className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 ? (
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-sm text-[var(--foreground-muted)]">
                  Pagina {currentPage} de {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Panel>
    </div>
  );
}
