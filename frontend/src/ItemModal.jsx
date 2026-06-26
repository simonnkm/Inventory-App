import { useEffect, useState } from "react";

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function makeForm(item) {
  return {
    catalogue_num: item?.catalogue_num ?? "",
    item_name: item?.item_name ?? "",
    lot_num: item?.lot_num ?? "",
    quantity: item?.quantity ?? 0,
    storage_id: item?.storage_id ?? "",
    expiry_date: item?.expiry_date ?? "",
    last_restocked:
      item?.last_restocked ?? todayString(),
    category: item?.category ?? "Uncategorized",
    shelf_num: item?.shelf_num ?? 0,
    brand: item?.brand ?? "",
    reorder_threshold:
      item?.reorder_threshold ?? 5,
    critical_threshold:
      item?.critical_threshold ?? 1,
  };
}

function ItemModal({
  open,
  item,
  loading,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(makeForm(item));
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(makeForm(item));
      setError("");
    }
  }, [open, item]);

  if (!open) {
    return null;
  }

  function updateField(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const payload = {
      catalogue_num: Number(form.catalogue_num),
      item_name: form.item_name.trim(),
      lot_num:
        form.lot_num === ""
          ? null
          : Number(form.lot_num),
      quantity: Number(form.quantity),
      storage_id: form.storage_id.trim(),
      expiry_date: form.expiry_date || null,
      last_restocked: form.last_restocked,
      category: form.category.trim() || "Uncategorized",
      shelf_num:
        form.shelf_num === ""
          ? null
          : Number(form.shelf_num),
      brand: form.brand.trim(),
      reorder_threshold:
        Number(form.reorder_threshold),
      critical_threshold:
        Number(form.critical_threshold),
    };

    if (
      !payload.item_name ||
      !payload.storage_id ||
      !payload.brand
    ) {
      setError(
        "Item name, storage location, and brand are required.",
      );
      return;
    }

    if (
      !Number.isInteger(payload.catalogue_num) ||
      !Number.isInteger(payload.quantity) ||
      !Number.isInteger(payload.reorder_threshold) ||
      !Number.isInteger(payload.critical_threshold)
    ) {
      setError("Numeric fields must contain whole numbers.");
      return;
    }

    if (
      payload.quantity < 0 ||
      payload.reorder_threshold < 0 ||
      payload.critical_threshold < 0
    ) {
      setError("Quantities and thresholds cannot be negative.");
      return;
    }

    if (
      payload.critical_threshold >
      payload.reorder_threshold
    ) {
      setError(
        "Critical threshold cannot exceed the reorder threshold.",
      );
      return;
    }

    onSubmit(payload);
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <form
        className="modal-card"
        onSubmit={handleSubmit}
      >
        <div className="modal-heading">
          <div>
            <h2>{item ? "Edit item" : "Add item"}</h2>
            <p>
              {item
                ? "Update this inventory record."
                : "Create a new inventory record."}
            </p>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="form-grid">
          <label>
            Item name
            <input
              name="item_name"
              value={form.item_name}
              onChange={updateField}
              required
            />
          </label>

          <label>
            Brand
            <input
              name="brand"
              value={form.brand}
              onChange={updateField}
              required
            />
          </label>

          <label>
            Catalogue number
            <input
              name="catalogue_num"
              type="number"
              min="1"
              value={form.catalogue_num}
              onChange={updateField}
              required
            />
          </label>

          <label>
            Lot number
            <input
              name="lot_num"
              type="number"
              min="0"
              value={form.lot_num}
              onChange={updateField}
            />
          </label>

          <label>
            Quantity
            <input
              name="quantity"
              type="number"
              min="0"
              value={form.quantity}
              onChange={updateField}
              required
            />
          </label>

          <label>
            Storage location
            <input
              name="storage_id"
              value={form.storage_id}
              onChange={updateField}
              required
            />
          </label>

          <label>
          Shelf number
          <input
            name="shelf_num"
            type="number"
            min="0"
            value={form.shelf_num}
            onChange={updateField}
          />
          </label>

          <label>
            Expiry date
            <input
              name="expiry_date"
              type="date"
              value={form.expiry_date}
              onChange={updateField}
            />
          </label>

          <label>
            Last restocked
            <input
              name="last_restocked"
              type="date"
              value={form.last_restocked}
              onChange={updateField}
              required
            />
          </label>

          <label>
            Reorder threshold
            <input
              name="reorder_threshold"
              type="number"
              min="0"
              value={form.reorder_threshold}
              onChange={updateField}
              required
            />
          </label>
          <label>
          Category
          <input
            name="category"
            value={form.category}
            onChange={updateField}
            required
          />
          </label>
          <label>
            Critical threshold
            <input
              name="critical_threshold"
              type="number"
              min="0"
              value={form.critical_threshold}
              onChange={updateField}
              required
            />
          </label>
        </div>

        {error && (
          <p className="error-message">{error}</p>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>

          <button
            className="primary-button"
            disabled={loading}
          >
            {loading
              ? "Saving..."
              : item
                ? "Save changes"
                : "Add item"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ItemModal;
