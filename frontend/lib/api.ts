import {
  getStatusFromQuantity,
  type AuditLog,
  type InventoryItem,
} from "@/types/inventory";
import type { UserAccount } from "@/types/inventory";
import type { OrderRecord } from "@/types/inventory";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

type TokenResponse = {
  access_token: string;
  token_type?: string;
};

export type CurrentUser = {
  id: number;
  username: string;
  role: string;
};

type BackendItem = {
  id?: number;
  catalogue_num: string;
  item_name: string;
  lot_num: number | null;
  quantity: number;
  storage_id: string;
  expiry_date: string | null;
  last_restocked: string;
  brand?: string | null;
  reorder_threshold?: number | null;
  critical_threshold?: number | null;
  category?: string | null;
  shelf_num?: number | null;
  tags?: string | null;
  last_used_at?: string | null;
};

type BackendAuditLog = {
  id: number;
  username: string;
  action: string;
  item_id: number | null;
  details: string | null;
  timestamp: string;
  old_quantity: number | null;
  change_amount: number | null;
  new_quantity: number | null;
};

async function getErrorMessage(response: Response) {
  const data = await response.json().catch(() => null);

  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (Array.isArray(data?.detail)) {
    return data.detail
      .map((error: { msg?: string }) => error.msg)
      .filter(Boolean)
      .join(", ");
  }

  return `Request failed with status ${response.status}`;
}

async function apiRequest<T>(
  path: string,
  options: RequestInit & { token?: string; json?: unknown } = {},
): Promise<T> {
  const { token, json, headers, ...fetchOptions } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers: {
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: json ? JSON.stringify(json) : fetchOptions.body,
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

function formatDisplayDate(value: string | null) {
  if (!value) return "NA";

  const parts = value.split("-");

  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[1]}-${parts[2]}-${parts[0]}`;
  }

  return value;
}

function parseTags(value: string | null | undefined) {
  if (!value) return [];

  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function mapItem(item: BackendItem): InventoryItem {
  const quantity = item.quantity;

  return {
    id: item.catalogue_num,
    no: item.id ?? 0,
    itemName: item.item_name,
    category: item.category ?? "Uncategorized",
    brand: item.brand ?? "—",
    catalogueNum: item.catalogue_num,
    lotNum: item.lot_num == null ? "—" : String(item.lot_num),
    shelfNum: item.shelf_num == null ? "—" : String(item.shelf_num),
    storageId: item.storage_id,
    quantity,
    expiryDate: formatDisplayDate(item.expiry_date),
    status: getStatusFromQuantity(quantity),
    tags: parseTags(item.tags),
    lastUsedAt: item.last_used_at ?? null,
  };
}

function mapAuditLog(log: BackendAuditLog): AuditLog {
  return {
    id: log.id,
    username: log.username,
    action: log.action,
    itemId: log.item_id,
    details: log.details,
    timestamp: log.timestamp,
    oldQuantity: log.old_quantity,
    changeAmount: log.change_amount,
    newQuantity: log.new_quantity,
  };
}

export async function login(username: string, password: string) {
  const formData = new URLSearchParams();
  formData.set("username", username);
  formData.set("password", password);

  const response = await fetch(`${API_BASE_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return response.json() as Promise<TokenResponse>;
}

export function getCurrentUser(token: string) {
  return apiRequest<CurrentUser>("/me", {
    token,
    method: "GET",
  });
}

export async function getItems(token: string) {
  const items = await apiRequest<BackendItem[]>("/items/", {
    token,
    method: "GET",
  });

  return items.map(mapItem);
}

export async function getAuditLogs(token: string) {
  const logs = await apiRequest<BackendAuditLog[]>("/audit-logs/", {
    token,
    method: "GET",
  });

  return logs.map(mapAuditLog);
}

export async function createOrderRecord(
  token: string,
  payload: {
    order_date?: string | null;
    order_placed_by?: string | null;
    po_number?: string | null;
    vendor?: string | null;
    category?: string | null;
    catalog_no?: string | null;
    item_name: string;
    units_ordered?: number | null;
    price_per_unit?: number | null;
    total_price?: number | null;
    final_price?: number | null;
    availability?: string | null;
    expected_delivery_date?: string | null;
    order_number?: string | null;
    delivery_date?: string | null;
    status?: string;
    received_by?: string | null;
    date_paid?: string | null;
    amount_paid?: number | null;
    cc_invoice?: string | null;
  },
) {
  const order = await apiRequest<BackendOrder>("/orders/", {
    token,
    method: "POST",
    json: payload,
  });

  return mapOrder(order);
}

export async function createItem(
  token: string,
  payload: {
    catalogue_num: string;
    item_name: string;
    lot_num?: number | null;
    quantity: number;
    storage_id: string;
    expiry_date?: string | null;
    last_restocked: string;
    brand?: string | null;
    reorder_threshold?: number;
    critical_threshold?: number;
    category?: string;
    shelf_num?: number | null;
    tags?: string;
  },
) {
  const item = await apiRequest<BackendItem>("/items/", {
    token,
    method: "POST",
    json: payload,
  });

  return mapItem(item);
}

export async function createTransaction(
  token: string,
  itemId: string,
  changeAmount: number,
) {
  const query = new URLSearchParams({
    change_amount: String(changeAmount),
  });

  const item = await apiRequest<BackendItem>(
    `/items/${encodeURIComponent(itemId)}/transaction?${query.toString()}`,
    {
      token,
      method: "POST",
    },
  );

  return mapItem(item);
}

export function deleteItem(token: string, itemId: string) {
  return apiRequest<void>(`/items/${encodeURIComponent(itemId)}`, {
    token,
    method: "DELETE",
  });
}
type BackendUser = {
  id: number;
  username: string;
  role: string;
};

export async function getUsers(token: string) {
  return apiRequest<BackendUser[]>("/users/", {
    token,
    method: "GET",
  });
}

export async function createUser(
  token: string,
  payload: {
    username: string;
    password: string;
    role: "user" | "admin";
  },
) {
  return apiRequest<UserAccount>("/users/", {
    token,
    method: "POST",
    json: payload,
  });
}

export function deleteUser(token: string, userId: number) {
  return apiRequest<void>(`/users/${userId}`, {
    token,
    method: "DELETE",
  });
}

type BackendOrder = {
  id: number;
  order_date: string | null;
  order_placed_by: string | null;
  po_number: string | null;
  vendor: string | null;
  category: string | null;
  catalog_no: string | null;
  item_name: string;
  units_ordered: number | null;
  price_per_unit: number | null;
  total_price: number | null;
  final_price: number | null;
  availability: string | null;
  expected_delivery_date: string | null;
  order_number: string | null;
  delivery_date: string | null;
  status: string;
  received_by: string | null;
  date_paid: string | null;
  amount_paid: number | null;
  cc_invoice: string | null;
};

function mapOrder(order: BackendOrder): OrderRecord {
  return {
    id: order.id,
    orderDate: order.order_date,
    orderPlacedBy: order.order_placed_by,
    poNumber: order.po_number,
    vendor: order.vendor,
    category: order.category,
    catalogNo: order.catalog_no,
    itemName: order.item_name,
    unitsOrdered: order.units_ordered,
    pricePerUnit: order.price_per_unit,
    totalPrice: order.total_price,
    finalPrice: order.final_price,
    availability: order.availability,
    expectedDeliveryDate: order.expected_delivery_date,
    orderNumber: order.order_number,
    deliveryDate: order.delivery_date,
    status: order.status,
    receivedBy: order.received_by,
    datePaid: order.date_paid,
    amountPaid: order.amount_paid,
    ccInvoice: order.cc_invoice,
  };
}

export async function getOrders(token: string) {
  const orders = await apiRequest<BackendOrder[]>("/orders/", {
    token,
    method: "GET",
  });

  return orders.map(mapOrder);
}

export async function importOrdersExcel(token: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/orders/import`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  const orders = (await response.json()) as BackendOrder[];
  return orders.map(mapOrder);
}

export async function exportOrdersExcel(token: string, ids?: number[]) {
  const query = ids?.length ? `?ids=${ids.join(",")}` : "";

  const response = await fetch(`${API_BASE_URL}/orders/export${query}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = ids?.length ? "selected-orders.xlsx" : "orders.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(url);
}