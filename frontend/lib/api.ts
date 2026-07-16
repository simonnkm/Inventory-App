import {
  getStatusFromQuantity,
  type AuditLog,
  type InventoryItem,
  type CommentNotificationSummary,
  type ItemComment,
  type ItemType,
} from "@/types/inventory";
import type {
  OrderDocument,
  OrderDocumentType,
  OrderEvent,
  OrderRecord,
  UserAccount,
} from "@/types/inventory";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000"
).replace(/\/$/, "");

type TokenResponse = {
  access_token: string;
  token_type?: string;
};

export type CurrentUser = {
  id: number;
  username: string;
  role: string;
};

type ApiOptions = {
  token?: string;
  method?: string;
  json?: unknown;
  body?: BodyInit;
};

type BackendItemType = {
  id: number;
  name: string;
  category: string | null;
  brand: string | null;
  brands?: string[] | null;
  reorder_threshold: number;
  critical_threshold: number;
  notes: string | null;
  total_quantity: number;
};

type BackendItem = {
  id?: number;
  item_type_id?: number | null;
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
  shelf_num?: string | null;
  tags?: string | null;
  last_used_at?: string | null;
  is_archived?: boolean | null;
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

type BackendUser = {
  id: number;
  username: string;
  role: string;
};

type BackendOrder = {
  id: number;
  item_type_id?: number | null;
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

type BackendItemComment = {
  id: number;
  item_id: string;
  username: string;
  comment: string;
  created_at: string;
};

type BackendCommentNotification = {
  item_id: string;
  item_type_id: number | null;
  item_name: string;
  catalogue_num: string;
  brand: string | null;
  unread_count: number;
  latest_comment: string | null;
  latest_comment_at: string | null;
  latest_comment_by: string | null;
};

type BackendItemTypeCommentNotification = {
  item_type_id: number;
  item_type_name: string;
  unread_count: number;
  latest_comment: string | null;
  latest_comment_at: string | null;
  latest_comment_by: string | null;
};

type BackendCommentNotificationSummary = {
  total_unread: number;
  items: BackendCommentNotification[];
  item_types: BackendItemTypeCommentNotification[];
};

type MarkCommentsReadResponse = {
  message: string;
  marked_read: number;
};

type BackendOrderDocument = {
  id: number;
  order_id: number | null;
  document_type: string;
  source: string;
  sender: string | null;
  subject: string | null;
  original_filename: string | null;
  content_type: string | null;
  confidence: number | null;
  reviewed: boolean;
  received_at: string;
};

type BackendOrderEvent = {
  id: number;
  order_id: number;
  event_type: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

type ItemPayload = {
  item_type_id?: number | null;
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
  shelf_num?: string | null;
  tags?: string;
};

type ItemUpdatePayload = Partial<ItemPayload> & {
  last_used_at?: string | null;
};

type OrderPayload = {
  item_type_id?: number | null;
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
};

type ItemTypePayload = {
  name: string;
  category?: string | null;
  brand?: string | null;
  reorder_threshold?: number;
  critical_threshold?: number;
  notes?: string | null;
};

type ItemTypeUpdatePayload = Partial<ItemTypePayload>;

function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function getErrorMessage(response: Response) {
  const data = await response.json().catch(() => null);

  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (Array.isArray(data?.detail)) {
    const message = data.detail
      .map((error: { msg?: string }) => error.msg)
      .filter(Boolean)
      .join(", ");

    if (message) return message;
  }

  return `Request failed with status ${response.status}`;
}

async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...authHeaders(options.token),
  };

  if (options.json !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body:
      options.json !== undefined
        ? JSON.stringify(options.json)
        : options.body,
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return undefined as T;
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

function mapItemType(itemType: BackendItemType): ItemType {
  const brands =
    itemType.brands?.filter(Boolean) ??
    itemType.brand
      ?.split(",")
      .map((brand) => brand.trim())
      .filter(Boolean) ??
    [];

  return {
    id: itemType.id,
    name: itemType.name,
    category: itemType.category,
    brand: brands.length > 0 ? brands.join(", ") : itemType.brand,
    brands,
    reorderThreshold: itemType.reorder_threshold,
    criticalThreshold: itemType.critical_threshold,
    notes: itemType.notes,
    totalQuantity: itemType.total_quantity,
    status: getStatusFromQuantity(itemType.total_quantity),
  };
}

function mapItem(item: BackendItem): InventoryItem {
  const quantity = item.quantity;

  return {
    id: item.catalogue_num,
    no: item.id ?? 0,
    itemTypeId: item.item_type_id ?? null,
    itemName: item.item_name,
    category: item.category ?? "Uncategorized",
    brand: item.brand ?? "—",
    catalogueNum: item.catalogue_num,
    lotNum: item.lot_num == null ? "—" : String(item.lot_num),
    shelfNum: item.shelf_num ?? "—",
    storageId: item.storage_id,
    quantity,
    expiryDate: formatDisplayDate(item.expiry_date),
    status: getStatusFromQuantity(quantity),
    tags: parseTags(item.tags),
    lastUsedAt: item.last_used_at ?? null,
    isArchived: item.is_archived ?? false,
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

function mapOrder(order: BackendOrder): OrderRecord {
  return {
    id: order.id,
    itemTypeId: order.item_type_id ?? null,
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

function mapItemComment(comment: BackendItemComment): ItemComment {
  return {
    id: comment.id,
    itemId: comment.item_id,
    username: comment.username,
    comment: comment.comment,
    createdAt: comment.created_at,
  };
}

function mapCommentNotifications(
  summary: BackendCommentNotificationSummary,
): CommentNotificationSummary {
  return {
    totalUnread: summary.total_unread,
    items: summary.items.map((item) => ({
      itemId: item.item_id,
      itemTypeId: item.item_type_id,
      itemName: item.item_name,
      catalogueNum: item.catalogue_num,
      brand: item.brand,
      unreadCount: item.unread_count,
      latestComment: item.latest_comment,
      latestCommentAt: item.latest_comment_at,
      latestCommentBy: item.latest_comment_by,
    })),
    itemTypes: summary.item_types.map((itemType) => ({
      itemTypeId: itemType.item_type_id,
      itemTypeName: itemType.item_type_name,
      unreadCount: itemType.unread_count,
      latestComment: itemType.latest_comment,
      latestCommentAt: itemType.latest_comment_at,
      latestCommentBy: itemType.latest_comment_by,
    })),
  };
}

function mapOrderDocument(document: BackendOrderDocument): OrderDocument {
  return {
    id: document.id,
    orderId: document.order_id,
    documentType: document.document_type,
    source: document.source,
    sender: document.sender,
    subject: document.subject,
    originalFilename: document.original_filename,
    contentType: document.content_type,
    confidence: document.confidence,
    reviewed: document.reviewed,
    receivedAt: document.received_at,
  };
}

function mapOrderEvent(event: BackendOrderEvent): OrderEvent {
  return {
    id: event.id,
    orderId: event.order_id,
    eventType: event.event_type,
    notes: event.notes,
    createdBy: event.created_by,
    createdAt: event.created_at,
  };
}

export async function login(username: string, password: string) {
  const body = new URLSearchParams();

  body.append("username", username);
  body.append("password", password);

  const response = await fetch(`${API_BASE_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return response.json() as Promise<TokenResponse>;
}

export function getCurrentUser(token: string) {
  return apiRequest<CurrentUser>("/me", { token });
}

export async function getItemTypes(token: string) {
  const itemTypes = await apiRequest<BackendItemType[]>("/item-types/", {
    token,
  });

  return itemTypes.map(mapItemType);
}

export async function createItemType(token: string, payload: ItemTypePayload) {
  const itemType = await apiRequest<BackendItemType>("/item-types/", {
    token,
    method: "POST",
    json: payload,
  });

  return mapItemType(itemType);
}
export async function updateItemType(
  token: string,
  itemTypeId: number,
  payload: ItemTypeUpdatePayload,
) {
  const itemType = await apiRequest<BackendItemType>(
    `/item-types/${itemTypeId}`,
    {
      token,
      method: "PUT",
      json: payload,
    },
  );

  return mapItemType(itemType);
}

export async function deleteItemType(token: string, itemTypeId: number) {
  const itemType = await apiRequest<BackendItemType>(
    `/item-types/${itemTypeId}`,
    {
      token,
      method: "DELETE",
    },
  );

  return mapItemType(itemType);
}

export async function getItems(token: string) {
  const items = await apiRequest<BackendItem[]>("/items/", { token });
  return items.map(mapItem);
}

export async function createItem(token: string, payload: ItemPayload) {
  const item = await apiRequest<BackendItem>("/items/", {
    token,
    method: "POST",
    json: payload,
  });

  return mapItem(item);
}

export async function updateItem(
  token: string,
  itemId: string,
  payload: ItemUpdatePayload,
) {
  const item = await apiRequest<BackendItem>(
    `/items/${encodeURIComponent(itemId)}`,
    {
      token,
      method: "PUT",
      json: payload,
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

export async function getAuditLogs(token: string) {
  const logs = await apiRequest<BackendAuditLog[]>("/audit-logs/", { token });
  return logs.map(mapAuditLog);
}

export function getUsers(token: string) {
  return apiRequest<BackendUser[]>("/users/", { token });
}

export function createUser(
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

export async function getOrders(token: string) {
  const orders = await apiRequest<BackendOrder[]>("/orders/", { token });
  return orders.map(mapOrder);
}

export async function createOrderRecord(token: string, payload: OrderPayload) {
  const order = await apiRequest<BackendOrder>("/orders/", {
    token,
    method: "POST",
    json: payload,
  });

  return mapOrder(order);
}

export async function importOrdersExcel(token: string, file: File) {
  const formData = new FormData();

  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/orders/import`, {
    method: "POST",
    headers: authHeaders(token),
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
    headers: authHeaders(token),
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

export async function getItemComments(token: string, itemId: string) {
  const comments = await apiRequest<BackendItemComment[]>(
    `/items/${encodeURIComponent(itemId)}/comments`,
    { token },
  );

  return comments.map(mapItemComment);
}

export async function createItemComment(
  token: string,
  itemId: string,
  comment: string,
) {
  const created = await apiRequest<BackendItemComment>(
    `/items/${encodeURIComponent(itemId)}/comments`,
    {
      token,
      method: "POST",
      json: { comment },
    },
  );

  return mapItemComment(created);
}

export function deleteItemComment(token: string, commentId: number) {
  return apiRequest<{ message: string }>(`/item-comments/${commentId}`, {
    token,
    method: "DELETE",
  });
}

export async function getCommentNotifications(token: string) {
  const summary = await apiRequest<BackendCommentNotificationSummary>(
    "/comments/notifications",
    { token },
  );

  return mapCommentNotifications(summary);
}

export function markItemCommentsRead(token: string, itemId: string) {
  return apiRequest<MarkCommentsReadResponse>(
    `/items/${encodeURIComponent(itemId)}/comments/read`,
    {
      token,
      method: "POST",
    },
  );
}

export function markItemTypeCommentsRead(token: string, itemTypeId: number) {
  return apiRequest<MarkCommentsReadResponse>(
    `/item-types/${itemTypeId}/comments/read`,
    {
      token,
      method: "POST",
    },
  );
}

export async function uploadOrderDocument(
  token: string,
  orderId: number,
  documentType: OrderDocumentType,
  file: File,
) {
  const formData = new FormData();

  formData.append("file", file);

  const response = await fetch(
    `${API_BASE_URL}/orders/${orderId}/documents?document_type=${documentType}`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: formData,
    },
  );

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  const document = (await response.json()) as BackendOrderDocument;
  return mapOrderDocument(document);
}

export async function getOrderDocuments(token: string, orderId: number) {
  const documents = await apiRequest<BackendOrderDocument[]>(
    `/orders/${orderId}/documents`,
    { token },
  );

  return documents.map(mapOrderDocument);
}

export async function downloadOrderDocument(
  token: string,
  documentId: number,
  filename: string,
) {
  const response = await fetch(
    `${API_BASE_URL}/order-documents/${documentId}/download`,
    {
      headers: authHeaders(token),
    },
  );

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename || `order-document-${documentId}`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(url);
}

export function deleteOrderDocument(token: string, documentId: number) {
  return apiRequest<{ message: string }>(`/order-documents/${documentId}`, {
    token,
    method: "DELETE",
  });
}

export async function getOrderEvents(token: string, orderId: number) {
  const events = await apiRequest<BackendOrderEvent[]>(
    `/orders/${orderId}/events`,
    { token },
  );

  return events.map(mapOrderEvent);
}

export async function markOrderDelivered(
  token: string,
  orderId: number,
  payload: {
    delivery_date?: string | null;
    received_by?: string | null;
    notes?: string | null;
  } = {},
) {
  const order = await apiRequest<BackendOrder>(
    `/orders/${orderId}/mark-delivered`,
    {
      token,
      method: "POST",
      json: payload,
    },
  );

  return mapOrder(order);
}

export async function markOrderPaid(
  token: string,
  orderId: number,
  payload: {
    date_paid?: string | null;
    amount_paid?: number | null;
    cc_invoice?: string | null;
    notes?: string | null;
  } = {},
) {
  const order = await apiRequest<BackendOrder>(
    `/orders/${orderId}/mark-paid`,
    {
      token,
      method: "POST",
      json: payload,
    },
  );

  return mapOrder(order);
}