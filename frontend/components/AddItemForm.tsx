"use client";

import { FormEvent, useMemo, useState } from "react";
import type { InventoryItem } from "@/types/inventory";

type AddItemFormProps = {
  mode: "create" | "edit";
  item?: InventoryItem | null;
  onBack: () => void;
  onSubmitItem: (payload: {
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
  }) => Promise<void>;
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function AddItemForm({
  mode,
  item,
  onBack,
  onSubmitItem,
}: AddItemFormProps) {
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    itemName: item?.itemName ?? "",
    category: item?.category ?? "Consumables",
    brand: item?.brand === "—" ? "" : item?.brand ?? "",
    catalogueNum: item?.catalogueNum ?? "",
    lotNum: item?.lotNum === "—" ? "" : item?.lotNum ?? "",
    storageId: item?.storageId === "Imported" ? "" : item?.storageId ?? "",
    shelfNum: item?.shelfNum === "—" ? "" : item?.shelfNum ?? "",
    quantity: item ? String(item.quantity) : "0",
    expiryDate:
      item?.expiryDate && item.expiryDate !== "NA" ? item.expiryDate : "",
    reorderThreshold: "5",
    criticalThreshold: "1",
    tags: item?.tags?.join(", ") ?? "",
  });

  const formValid = useMemo(() => {
    return Boolean(
      form.itemName &&
        form.catalogueNum &&
        form.storageId &&
        form.quantity !== "",
    );
  }, [form]);

  function updateField(name: keyof typeof form, value: string) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formValid) return;

    setSubmitting(true);

    try {
      await onSubmitItem({
        catalogue_num: form.catalogueNum.trim(),
        item_name: form.itemName.trim(),
        lot_num: numberOrNull(form.lotNum),
        quantity: Number(form.quantity),
        storage_id: form.storageId.trim(),
        expiry_date: form.expiryDate || null,
        last_restocked: todayInputValue(),
        brand: form.brand.trim() || null,
        reorder_threshold: Number(form.reorderThreshold || 5),
        critical_threshold: Number(form.criticalThreshold || 1),
        category: form.category.trim() || "Uncategorized",
        shelf_num: form.shelfNum.trim() || null,
        tags: form.tags.trim(),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="view active">
      <div className="crumb">
        <span className="root">INVENTORY</span>
        <span>/</span>
        <span className="cur">
          {mode === "edit" ? "Editing Item" : "Adding Item"}
        </span>
      </div>

      <form className="form-card" onSubmit={handleSubmit}>
        <div className="form-top">
          <h2>{mode === "edit" ? "Edit Inventory Item" : "Add Inventory Item"}</h2>
        </div>

        <div className="grid">
          <div className="field">
            <label>
              Item Name <span className="req-star">*</span>
            </label>
            <div className="control">
              <input
                value={form.itemName}
                onChange={(event) => updateField("itemName", event.target.value)}
                placeholder="Gloves Small"
                required
              />
            </div>
          </div>

          <div className="field">
            <label>
              Catalog Number <span className="req-star">*</span>
            </label>
            <div className="control">
              <input
                value={form.catalogueNum}
                onChange={(event) =>
                  updateField("catalogueNum", event.target.value)
                }
                placeholder="Q32856"
                required
                disabled={mode === "edit"}
              />
            </div>
          </div>

          <div className="field">
            <label>Category</label>
            <div className="control">
              <input
                value={form.category}
                onChange={(event) => updateField("category", event.target.value)}
                placeholder="Consumables"
              />
            </div>
          </div>

          <div className="field">
            <label>Brand / Vendor</label>
            <div className="control">
              <input
                value={form.brand}
                onChange={(event) => updateField("brand", event.target.value)}
                placeholder="Fisher Scientific"
              />
            </div>
          </div>

          <div className="field">
            <label>
              Storage <span className="req-star">*</span>
            </label>
            <div className="control">
              <input
                value={form.storageId}
                onChange={(event) => updateField("storageId", event.target.value)}
                placeholder="Freezer 1 / Cabinet 2"
                required
              />
            </div>
          </div>

          <div className="field">
            <label>Shelf #</label>
            <div className="control">
              <input
                value={form.shelfNum}
                onChange={(event) => updateField("shelfNum", event.target.value)}
                placeholder="A1"
              />
            </div>
          </div>

          <div className="field">
            <label>Lot #</label>
            <div className="control">
              <input
                value={form.lotNum}
                onChange={(event) => updateField("lotNum", event.target.value)}
                placeholder="321"
              />
            </div>
          </div>

          <div className="field">
            <label>
              Quantity <span className="req-star">*</span>
            </label>
            <div className="control">
              <input
                type="number"
                min="0"
                value={form.quantity}
                onChange={(event) => updateField("quantity", event.target.value)}
                required
              />
            </div>
          </div>

          <div className="field">
            <label>Expiry Date</label>
            <div className="control">
              <input
                type="date"
                value={form.expiryDate}
                onChange={(event) => updateField("expiryDate", event.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label>Reorder Threshold</label>
            <div className="control">
              <input
                type="number"
                min="0"
                value={form.reorderThreshold}
                onChange={(event) =>
                  updateField("reorderThreshold", event.target.value)
                }
              />
            </div>
          </div>

          <div className="field">
            <label>Critical Threshold</label>
            <div className="control">
              <input
                type="number"
                min="0"
                value={form.criticalThreshold}
                onChange={(event) =>
                  updateField("criticalThreshold", event.target.value)
                }
              />
            </div>
          </div>

          <div className="field">
            <label>Tags</label>
            <div className="control">
              <input
                value={form.tags}
                onChange={(event) => updateField("tags", event.target.value)}
                placeholder="cold, reagent, priority"
              />
            </div>
          </div>
        </div>

        <div className="form-footer">
          <button type="button" className="btn secondary" onClick={onBack}>
            Back
          </button>

          <button type="submit" className="btn primary" disabled={!formValid || submitting}>
            {submitting
              ? "Saving..."
              : mode === "edit"
                ? "Save Changes"
                : "Add Item"}
          </button>
        </div>
      </form>
    </section>
  );
}