"use client";

import { ListFilters } from "@/components/ui/list-filters";
import { PageHeading } from "@/components/ui/page-heading";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Panel } from "@/components/ui/panel";
import { Plus } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type CampaignOption = {
  id: string;
  name: string;
  month: number;
  year: number;
  status: "OPEN" | "CLOSED";
};

type CustomerOption = {
  id: string;
  fullName: string;
};

type WarehouseItemRow = {
  id: string;
  campaignId: string;
  campaignName: string;
  campaignStatus: "OPEN" | "CLOSED";
  entryDate: string;
  code: string;
  name: string;
  category: "Sokso" | "Footloose" | "Leonisa";
  size?: string | null;
  color?: string | null;
  quantity: number;
  availableQuantity: number;
  assignedQuantity: number;
  costPrice: number;
  salePrice: number;
  notes?: string | null;
};

type WarehouseResponse = {
  data?: WarehouseItemRow[];
  campaignOptions?: CampaignOption[];
  error?: string;
};

type PurchaseItemSummary = {
  id: string;
  warehouseItemId?: string | null;
  code: string;
  name: string;
  category: "Sokso" | "Footloose" | "Leonisa";
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
  items: PurchaseItemSummary[];
};

type PurchaseResponse = {
  data?: PurchaseRow[];
  error?: string;
};

type WarehouseAssignmentRow = {
  purchaseId: string;
  warehouseItemId: string;
  purchaseDate: string;
  customerId: string;
  customerName: string;
  campaignId: string;
  campaignName: string;
  code: string;
  name: string;
  category: "Sokso" | "Footloose" | "Leonisa";
  size?: string | null;
  color?: string | null;
  quantity: number;
  totalAmount: number;
};

const CATEGORY_OPTIONS = ["Sokso", "Footloose", "Leonisa"] as const;
const WAREHOUSE_ITEMS_PER_PAGE = 10;
const ASSIGNMENTS_PER_PAGE = 10;
const currencyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  maximumFractionDigits: 2,
});

function toDateInputValue(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

function toIsoDate(value: string) {
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

export default function AlmacenPage() {
  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [warehouseItems, setWarehouseItems] = useState<WarehouseItemRow[]>([]);
  const [assignments, setAssignments] = useState<WarehouseAssignmentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [assigningItemId, setAssigningItemId] = useState<string | null>(null);
  const [editingAssignmentPurchaseId, setEditingAssignmentPurchaseId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [query, setQuery] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [campaignId, setCampaignId] = useState("");
  const [entryDate, setEntryDate] = useState(() => toDateInputValue(new Date()));
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]>("Sokso");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [costPrice, setCostPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [notes, setNotes] = useState("");

  const [assignmentDate, setAssignmentDate] = useState(() => toDateInputValue(new Date()));
  const [assignmentQuantity, setAssignmentQuantity] = useState("1");
  const [assignmentCustomerId, setAssignmentCustomerId] = useState("");
  const [assignmentCustomerSearch, setAssignmentCustomerSearch] = useState("");

  const assigningItem = warehouseItems.find((item) => item.id === assigningItemId) ?? null;
  const editingAssignment = assignments.find((assignment) => assignment.purchaseId === editingAssignmentPurchaseId) ?? null;

  const syncCustomerSelection = useCallback(
    (value: string) => {
      setAssignmentCustomerSearch(value);
      const normalizedValue = normalizeText(value);
      const matchedCustomer = customers.find((customer) => normalizeText(customer.fullName) === normalizedValue);
      setAssignmentCustomerId(matchedCustomer?.id ?? "");
    },
    [customers],
  );

  function resetCreateForm() {
    setCampaignId("");
    setEntryDate(toDateInputValue(new Date()));
    setCategory("Sokso");
    setCode("");
    setName("");
    setSize("");
    setColor("");
    setQuantity("1");
    setCostPrice("");
    setSalePrice("");
    setNotes("");
  }

  function resetAssignForm() {
    setAssigningItemId(null);
    setEditingAssignmentPurchaseId(null);
    setAssignmentDate(toDateInputValue(new Date()));
    setAssignmentQuantity("1");
    setAssignmentCustomerId("");
    setAssignmentCustomerSearch("");
  }

  const loadData = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    const [warehouseRes, customersRes, purchasesRes] = await Promise.all([
      fetch("/api/warehouse", { cache: "no-store" }),
      fetch("/api/customers?status=ACTIVE", { cache: "no-store" }),
      fetch("/api/purchases", { cache: "no-store" }),
    ]);

    const warehouseJson = (await warehouseRes.json()) as WarehouseResponse;
    const customersJson = (await customersRes.json()) as {
      data?: CustomerOption[];
      error?: string;
    };
    const purchasesJson = (await purchasesRes.json()) as PurchaseResponse;

    if (!warehouseRes.ok || !customersRes.ok || !purchasesRes.ok) {
      setError(warehouseJson.error ?? customersJson.error ?? purchasesJson.error ?? "No se pudo cargar el almacén.");
      setIsLoading(false);
      return;
    }

    const warehouseTransfers = (purchasesJson.data ?? [])
      .filter((purchase) => purchase.source === "WAREHOUSE_TRANSFER")
      .flatMap((purchase) =>
        purchase.items
          .filter((item) => item.warehouseItemId)
          .map((item) => ({
            purchaseId: purchase.id,
            warehouseItemId: item.warehouseItemId!,
            purchaseDate: purchase.purchaseDate,
            customerId: purchase.customerId,
            customerName: purchase.customerName,
            campaignId: purchase.campaignId,
            campaignName: purchase.campaignName,
            code: item.code,
            name: item.name,
            category: item.category,
            size: item.size,
            color: item.color,
            quantity: item.quantity,
            totalAmount: purchase.totalAmount,
          })),
      );

    setWarehouseItems(warehouseJson.data ?? []);
    setAssignments(warehouseTransfers);
    setCampaignOptions(warehouseJson.campaignOptions ?? []);
    setCustomers(
      [...(customersJson.data ?? [])].sort((a, b) => a.fullName.localeCompare(b.fullName, "es", { sensitivity: "base" })),
    );
    setCurrentPage(1);
    setAssignmentPage(1);
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

  async function onCreateWarehouseItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const parsedQuantity = Number(quantity);
    const parsedCostPrice = Number(costPrice);
    const parsedSalePrice = Number(salePrice);

    if (!campaignId || !entryDate) {
      setError("Selecciona campaña y fecha de ingreso.");
      return;
    }

    if (!code || !name || !category || !Number.isFinite(parsedQuantity) || !Number.isFinite(parsedCostPrice) || !Number.isFinite(parsedSalePrice)) {
      setError("Completa los datos del producto correctamente.");
      return;
    }

    setIsSaving(true);
    const response = await fetch("/api/warehouse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        entryDate: toIsoDate(entryDate),
        code,
        name,
        category,
        size: size || undefined,
        color: color || undefined,
        quantity: parsedQuantity,
        costPrice: parsedCostPrice,
        salePrice: parsedSalePrice,
        notes: notes || undefined,
      }),
    });

    const json = (await response.json()) as { error?: string };
    setIsSaving(false);

    if (!response.ok) {
      setError(json.error ?? "No se pudo registrar el producto en almacén.");
      return;
    }

    resetCreateForm();
    setShowCreateForm(false);
    setSuccessMessage("Producto registrado en almacén correctamente.");
    await loadData();
  }

  async function onAssignWarehouseItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!assigningItem) {
      setError("Selecciona un producto de almacén para asignar.");
      return;
    }

    const parsedQuantity = Number(assignmentQuantity);
    if (!assignmentCustomerId || !assignmentDate || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError("Selecciona cliente, fecha y cantidad válida.");
      return;
    }

    setIsAssigning(true);
    setError(null);
    setSuccessMessage(null);

    if (editingAssignment) {
      const response = await fetch(`/api/purchases/${editingAssignment.purchaseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: assignmentCustomerId,
          campaignId: editingAssignment.campaignId,
          purchaseDate: toIsoDate(assignmentDate),
          items: [
            {
              code: editingAssignment.code,
              name: editingAssignment.name,
              category: editingAssignment.category,
              size: editingAssignment.size || undefined,
              color: editingAssignment.color || undefined,
              quantity: parsedQuantity,
              costPrice: assigningItem.costPrice,
              salePrice: assigningItem.salePrice,
            },
          ],
        }),
      });

      const json = (await response.json()) as { error?: string };
      setIsAssigning(false);

      if (!response.ok) {
        setError(json.error ?? "No se pudo actualizar la asignación.");
        return;
      }

      const selectedCustomer = customers.find((customer) => customer.id === assignmentCustomerId);
      setSuccessMessage(`Asignación actualizada para ${selectedCustomer?.fullName ?? "cliente"} correctamente.`);
    } else {
      const response = await fetch(`/api/warehouse/${assigningItem.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: assignmentCustomerId,
          quantity: parsedQuantity,
          assignmentDate: toIsoDate(assignmentDate),
        }),
      });

      const json = (await response.json()) as { error?: string; data?: { customerName: string } };
      setIsAssigning(false);

      if (!response.ok) {
        setError(json.error ?? "No se pudo asignar el producto.");
        return;
      }

      setSuccessMessage(`Producto asignado a ${json.data?.customerName ?? "cliente"} correctamente.`);
    }

    resetAssignForm();
    await loadData();
  }

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = assignmentCustomerSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return customers;
    }

    return customers.filter((customer) => customer.fullName.toLowerCase().includes(normalizedSearch));
  }, [assignmentCustomerSearch, customers]);

  const filteredWarehouseItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return warehouseItems.filter((item) => {
      if (item.availableQuantity <= 0) {
        return false;
      }

      const matchesQuery =
        normalizedQuery.length === 0 ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.code.toLowerCase().includes(normalizedQuery) ||
        item.campaignName.toLowerCase().includes(normalizedQuery);

      const matchesCampaign = campaignFilter === "all" || item.campaignId === campaignFilter;

      return matchesQuery && matchesCampaign;
    });
  }, [campaignFilter, query, warehouseItems]);

  const filteredAssignments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return assignments.filter((assignment) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        assignment.name.toLowerCase().includes(normalizedQuery) ||
        assignment.code.toLowerCase().includes(normalizedQuery) ||
        assignment.customerName.toLowerCase().includes(normalizedQuery) ||
        assignment.campaignName.toLowerCase().includes(normalizedQuery);

      const matchesCampaign = campaignFilter === "all" || assignment.campaignId === campaignFilter;

      return matchesQuery && matchesCampaign;
    });
  }, [assignments, campaignFilter, query]);

  const totalPages = Math.max(1, Math.ceil(filteredWarehouseItems.length / WAREHOUSE_ITEMS_PER_PAGE));
  const paginatedItems = filteredWarehouseItems.slice(
    (currentPage - 1) * WAREHOUSE_ITEMS_PER_PAGE,
    currentPage * WAREHOUSE_ITEMS_PER_PAGE,
  );
  const assignmentTotalPages = Math.max(1, Math.ceil(filteredAssignments.length / ASSIGNMENTS_PER_PAGE));
  const paginatedAssignments = filteredAssignments.slice(
    (assignmentPage - 1) * ASSIGNMENTS_PER_PAGE,
    assignmentPage * ASSIGNMENTS_PER_PAGE,
  );

  return (
    <div className="space-y-4">
      <PageHeading
        overline="Control de inventario"
        title="Almacén"
        description="Registra productos en stock y asígnalos luego a clientes ya registrados."
        actions={
          <button
            type="button"
            onClick={() => {
              if (showCreateForm) {
                setShowCreateForm(false);
                resetCreateForm();
                return;
              }

              resetCreateForm();
              setShowCreateForm(true);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            {showCreateForm ? "Cerrar formulario" : "Nuevo ingreso"}
          </button>
        }
      />

      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p> : null}
      {successMessage ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</p> : null}

      {showCreateForm || assigningItem ? (
        <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <Panel delay={180}>
            {showCreateForm ? (
              <>
                <h2 className="text-lg font-semibold">Nuevo ingreso a almacén</h2>
                <form className="mt-4 space-y-3" onSubmit={onCreateWarehouseItem}>
                  <div className="rounded-2xl border bg-[var(--surface)] p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Paso 1</p>
                    <p className="mt-1 font-semibold">Seleccionar campaña</p>
                    <select className="mt-2 h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-sm" value={campaignId} onChange={(event) => setCampaignId(event.target.value)}>
                      <option value="">Seleccionar campaña</option>
                      {campaignOptions.map((campaign) => (
                        <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-2xl border bg-[var(--surface)] p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Paso 2</p>
                    <p className="mt-1 font-semibold">Seleccionar fecha de ingreso</p>
                    <input type="date" className="mt-2 h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-sm" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} required />
                  </div>

                  <div className="rounded-2xl border bg-[var(--surface)] p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Paso 3</p>
                    <p className="mt-1 font-semibold">Agregar producto</p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                      <select className="h-10 rounded-xl border bg-[var(--surface)] px-3 text-sm" value={category} onChange={(event) => setCategory(event.target.value as (typeof CATEGORY_OPTIONS)[number])}>
                        {CATEGORY_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                      <input className="h-10 rounded-xl border px-3 text-sm" placeholder="Código" value={code} onChange={(event) => setCode(event.target.value)} required />
                      <input className="h-10 rounded-xl border px-3 text-sm" placeholder="Nombre" value={name} onChange={(event) => setName(event.target.value)} required />
                      <input className="h-10 rounded-xl border px-3 text-sm" placeholder="Talla" value={size} onChange={(event) => setSize(event.target.value)} />
                      <input className="h-10 rounded-xl border px-3 text-sm" placeholder="Color" value={color} onChange={(event) => setColor(event.target.value)} />
                      <input className="h-10 rounded-xl border px-3 text-sm" placeholder="Cantidad" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
                      <input className="h-10 rounded-xl border px-3 text-sm" placeholder="Precio de costo" value={costPrice} onChange={(event) => setCostPrice(event.target.value)} required />
                      <input className="h-10 rounded-xl border px-3 text-sm" placeholder="Precio de venta" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} required />
                    </div>
                    <textarea className="mt-2 min-h-24 w-full rounded-xl border bg-[var(--surface)] px-3 py-2 text-sm" placeholder="Observación (opcional)" value={notes} onChange={(event) => setNotes(event.target.value)} />
                  </div>

                  <button type="submit" disabled={isSaving} className="h-10 w-full rounded-xl bg-[var(--accent)] text-sm font-semibold text-white disabled:opacity-60">
                    {isSaving ? "Guardando..." : "Registrar en almacén"}
                  </button>
                </form>
              </>
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed p-6 text-sm text-[var(--foreground-muted)]">
                Selecciona “Nuevo ingreso” para registrar stock en almacén.
              </div>
            )}
          </Panel>

          <Panel delay={220}>
            {assigningItem ? (
              <>
                <h2 className="text-lg font-semibold">{editingAssignment ? "Editar asignación" : "Asignar a cliente"}</h2>
                <div className="mt-3 rounded-2xl border bg-[var(--surface)] p-3 text-sm">
                  <p className="font-semibold">{assigningItem.name}</p>
                  <p className="mt-1 text-[var(--foreground-muted)]">{assigningItem.code} · {assigningItem.campaignName}</p>
                  <p className="mt-1 text-[var(--foreground-muted)]">Disponible: {assigningItem.availableQuantity} de {assigningItem.quantity}</p>
                </div>
                <form className="mt-3 space-y-3" onSubmit={onAssignWarehouseItem}>
                  <div className="rounded-2xl border bg-[var(--surface)] p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Paso 1</p>
                    <p className="mt-1 font-semibold">Seleccionar cliente</p>
                    <input
                      list="warehouse-customers"
                      className="mt-2 h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-sm"
                      placeholder="Buscar y seleccionar cliente..."
                      value={assignmentCustomerSearch}
                      onChange={(event) => syncCustomerSelection(event.target.value)}
                      required
                    />
                    <datalist id="warehouse-customers">
                      {filteredCustomers.map((customer) => (
                        <option key={customer.id} value={customer.fullName} />
                      ))}
                    </datalist>
                  </div>

                  <div className="rounded-2xl border bg-[var(--surface)] p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Paso 2</p>
                    <p className="mt-1 font-semibold">Seleccionar fecha y cantidad</p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <input type="date" className="h-10 rounded-xl border bg-[var(--surface)] px-3 text-sm" value={assignmentDate} onChange={(event) => setAssignmentDate(event.target.value)} required />
                      <input className="h-10 rounded-xl border bg-[var(--surface)] px-3 text-sm" placeholder="Cantidad a asignar" value={assignmentQuantity} onChange={(event) => setAssignmentQuantity(event.target.value)} required />
                    </div>
                  </div>

                  <button type="submit" disabled={isAssigning} className="h-10 w-full rounded-xl bg-[var(--accent)] text-sm font-semibold text-white disabled:opacity-60">
                    {isAssigning ? (editingAssignment ? "Guardando..." : "Asignando...") : editingAssignment ? "Guardar cambios" : "Asignar a cliente"}
                  </button>
                  <button type="button" onClick={resetAssignForm} className="h-10 w-full rounded-xl border text-sm font-semibold">
                    {editingAssignment ? "Cancelar edición" : "Cancelar asignación"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold">Cómo funciona</h2>
                <ul className="mt-3 space-y-2 text-sm text-[var(--foreground-muted)]">
                  <li className="rounded-xl border bg-[var(--surface)] p-3">El producto entra a almacén y queda disponible para asignación.</li>
                  <li className="rounded-xl border bg-[var(--surface)] p-3">Ese ingreso ya cuenta en reportes como venta, costo y ganancia de la campaña elegida.</li>
                  <li className="rounded-xl border bg-[var(--surface)] p-3">Cuando lo asignas a un cliente, empieza su deuda sin volver a duplicar la venta en reportes.</li>
                </ul>
              </>
            )}
          </Panel>
        </section>
      ) : null}

      <Panel delay={260}>
        <ListFilters
          search={{
            label: "Buscar producto",
            placeholder: "Buscar por código, producto o campaña...",
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
              setAssignmentPage(1);
            }}
          >
            <option value="all">Todas las campañas</option>
            {campaignOptions.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
            ))}
          </select>
        </ListFilters>
      </Panel>

      <Panel delay={300}>
        <h2 className="text-lg font-semibold">Productos en almacén</h2>
        {isLoading ? (
          <p className="mt-3 text-sm text-[var(--foreground-muted)]">Cargando almacén...</p>
        ) : filteredWarehouseItems.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--foreground-muted)]">No hay productos en almacén para este filtro.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
                <tr>
                  <th className="pb-2 font-semibold">Fecha</th>
                  <th className="pb-2 font-semibold">Campaña</th>
                  <th className="pb-2 font-semibold">Producto</th>
                  <th className="pb-2 font-semibold">Cantidad</th>
                  <th className="pb-2 font-semibold">Disponible</th>
                  <th className="pb-2 font-semibold">Costo</th>
                  <th className="pb-2 font-semibold">Venta</th>
                  <th className="pb-2 font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item) => (
                  <tr key={item.id} className="border-t border-[var(--border)]/80">
                    <td className="py-3 text-[var(--foreground-muted)]">{new Date(item.entryDate).toLocaleDateString("es-PE")}</td>
                    <td className="py-3">{item.campaignName}</td>
                    <td className="py-3">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-[var(--foreground-muted)]">{item.category} · {item.code}{item.size ? ` · Talla ${item.size}` : ""}{item.color ? ` · ${item.color}` : ""}</p>
                    </td>
                    <td className="py-3">{item.quantity}</td>
                    <td className="py-3">{item.availableQuantity}</td>
                    <td className="py-3">{currencyFormatter.format(item.costPrice)}</td>
                    <td className="py-3">{currencyFormatter.format(item.salePrice)}</td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setAssigningItemId(item.id);
                          setAssignmentQuantity(String(Math.max(1, Math.min(item.availableQuantity, 1))));
                          setAssignmentDate(toDateInputValue(new Date()));
                          setAssignmentCustomerId("");
                          setAssignmentCustomerSearch("");
                          setError(null);
                          setSuccessMessage(null);
                        }}
                        disabled={item.availableQuantity <= 0}
                        className="rounded-lg border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {item.availableQuantity > 0 ? "Asignar" : "Sin stock"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))}
              onNext={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            />
          </div>
        )}
      </Panel>

      <Panel delay={340}>
        <h2 className="text-lg font-semibold">Asignaciones realizadas</h2>
        {isLoading ? (
          <p className="mt-3 text-sm text-[var(--foreground-muted)]">Cargando asignaciones...</p>
        ) : filteredAssignments.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--foreground-muted)]">No hay asignaciones registradas para este filtro.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
                <tr>
                  <th className="pb-2 font-semibold">Fecha</th>
                  <th className="pb-2 font-semibold">Cliente</th>
                  <th className="pb-2 font-semibold">Campaña</th>
                  <th className="pb-2 font-semibold">Producto</th>
                  <th className="pb-2 font-semibold">Cantidad</th>
                  <th className="pb-2 font-semibold">Total</th>
                  <th className="pb-2 font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAssignments.map((assignment) => (
                  <tr key={assignment.purchaseId} className="border-t border-[var(--border)]/80">
                    <td className="py-3 text-[var(--foreground-muted)]">{new Date(assignment.purchaseDate).toLocaleDateString("es-PE")}</td>
                    <td className="py-3">{assignment.customerName}</td>
                    <td className="py-3">{assignment.campaignName}</td>
                    <td className="py-3">
                      <p className="font-medium">{assignment.name}</p>
                      <p className="text-xs text-[var(--foreground-muted)]">{assignment.category} · {assignment.code}{assignment.size ? ` · Talla ${assignment.size}` : ""}{assignment.color ? ` · ${assignment.color}` : ""}</p>
                    </td>
                    <td className="py-3">{assignment.quantity}</td>
                    <td className="py-3">{currencyFormatter.format(assignment.totalAmount)}</td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setAssigningItemId(assignment.warehouseItemId);
                          setEditingAssignmentPurchaseId(assignment.purchaseId);
                          setAssignmentQuantity(String(assignment.quantity));
                          setAssignmentDate(toDateInputValue(assignment.purchaseDate));
                          setAssignmentCustomerId(assignment.customerId);
                          setAssignmentCustomerSearch(assignment.customerName);
                          setShowCreateForm(false);
                          setError(null);
                          setSuccessMessage(null);
                        }}
                        className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls
              currentPage={assignmentPage}
              totalPages={assignmentTotalPages}
              onPrevious={() => setAssignmentPage((page) => Math.max(1, page - 1))}
              onNext={() => setAssignmentPage((page) => Math.min(assignmentTotalPages, page + 1))}
            />
          </div>
        )}
      </Panel>
    </div>
  );
}
