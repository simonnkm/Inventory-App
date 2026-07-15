export type View =
  | "inventory"
  | "orders"
  | "add-item"
  | "edit-item"
  | "add-order"
  | "audit"
  | "users";

export type Status =
  | "high"
  | "low"
  | "critical"
  | "out"
  | "transit"
  | "expiring";

export type ItemType = {
  id: number;
  name: string;
  category: string | null;
  brand: string | null;
  reorderThreshold: number;
  criticalThreshold: number;
  notes: string | null;
  totalQuantity: number;
  status: Status;
};

export type InventoryItem = {
  id: string;
  no: number;
  itemName: string;
  category: string;
  brand: string;
  catalogueNum: string;
  lotNum: string;
  shelfNum: string;
  storageId: string;
  quantity: number;
  expiryDate: string;
  status: Status;
  tags: string[];
  lastUsedAt: string | null;
};

export type ItemComment = {
  id: number;
  itemId: string;
  username: string;
  comment: string;
  createdAt: string;
};

export type Order = {
  id: number;

  dateOrdered: string;
  orderPlacedBy?: string;
  poNumber?: string;
  supplier: string;
  category?: string;
  catalogueNum: string;
  itemName: string;

  unitsOrdered: string;
  pricePerUnit: string;
  totalPrice: string;
  finalPrice?: string;

  availability?: string;
  expectedDeliveryDate?: string;
  orderNumber?: string;
  dateDelivered?: string;
  status?: string;
  receivedBy?: string;
  datePaid?: string;
  amountPaid?: string;
  ccInvoice?: string;

  expiryDate: string;
  delivered: boolean;
};

export type OrderRecord = {
  id: number;
  orderDate: string | null;
  orderPlacedBy: string | null;
  poNumber: string | null;
  vendor: string | null;
  category: string | null;
  catalogNo: string | null;
  itemName: string;
  unitsOrdered: number | null;
  pricePerUnit: number | null;
  totalPrice: number | null;
  finalPrice: number | null;
  availability: string | null;
  expectedDeliveryDate: string | null;
  orderNumber: string | null;
  deliveryDate: string | null;
  status: string;
  receivedBy: string | null;
  datePaid: string | null;
  amountPaid: number | null;
  ccInvoice: string | null;
};

export type AuditLog = {
  id: number;
  username: string;
  action: string;
  itemId: number | null;
  details: string | null;
  timestamp: string;
  oldQuantity: number | null;
  changeAmount: number | null;
  newQuantity: number | null;
};

export type UserAccount = {
  id: number;
  username: string;
  role: string;
};

export const STATUS_LABEL: Record<Status, string> = {
  high: "High",
  low: "Low",
  critical: "Critical",
  out: "Out of Stock",
  transit: "In Transit",
  expiring: "Expiring",
};

export const ITEM_TYPES = [
  "Gloves (Small)",
  "Gloves (Medium)",
  "Gloves (Large)",
  "High Sensitivity Screen Tape",
  "HS2 DNA Reagent Kit",
  "Pipettes (200 ml)",
  "Pipettes (20 ml)",
  "Face Masks (N95)",
  "Sanitizer Gel (500ml)",
];

export function emojiFor(name: string) {
  const value = name.toLowerCase();

  if (value.includes("glove")) return "🧤";
  if (value.includes("pipette")) return "💉";
  if (value.includes("tape")) return "🎞️";
  if (value.includes("reagent") || value.includes("dna")) return "🧪";
  if (value.includes("mask")) return "😷";
  if (value.includes("sanitizer")) return "🧴";

  return "📦";
}

export function getStatusFromQuantity(quantity: number): Status {
  if (quantity <= 0) return "out";
  if (quantity <= 1) return "critical";
  if (quantity <= 10) return "low";

  return "high";
}

export function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function toDisplayDate(value: string) {
  if (!value) return "";

  const parts = value.split("-");

  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[1]}-${parts[2]}-${parts[0]}`;
  }

  return value;
}

export type OrderDocument = {
  id: number;
  orderId: number | null;
  documentType: string;
  source: string;
  sender: string | null;
  subject: string | null;
  originalFilename: string | null;
  contentType: string | null;
  confidence: number | null;
  reviewed: boolean;
  receivedAt: string;
};

export type OrderEvent = {
  id: number;
  orderId: number;
  eventType: string;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type OrderDocumentType =
  | "confirmation"
  | "invoice"
  | "delivery"
  | "packing_slip"
  | "shipping"
  | "other";