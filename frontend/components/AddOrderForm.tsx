"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ITEM_TYPES,
  todayInputValue,
  type Order,
} from "@/types/inventory";

type AddOrderFormProps = {
  onBack: () => void;
  onSubmitOrder: (order: Order) => void;
};

export default function AddOrderForm({
  onBack,
  onSubmitOrder,
}: AddOrderFormProps) {
  const [delivered, setDelivered] = useState(false);
  const [fileName, setFileName] = useState("From device");

  const [form, setForm] = useState({
    itemName: "",
    itemType: "",
    supplier: "",
    catalog: "",
    dateOrdered: todayInputValue(),
    expiryDate: "",
    unitsOrdered: "",
    reorderLevel: "",
    pricePerUnit: "",
    totalPrice: "",
    dateDelivered: "",
    datePaid: "",
  });

  const formValid = useMemo(() => {
    const baseValid =
      form.itemName &&
      form.itemType &&
      form.supplier &&
      form.catalog &&
      form.dateOrdered &&
      form.expiryDate &&
      form.unitsOrdered &&
      form.reorderLevel &&
      form.pricePerUnit &&
      form.totalPrice;

    if (!delivered) {
      return Boolean(baseValid);
    }

    return Boolean(baseValid && form.dateDelivered && form.datePaid);
  }, [delivered, form]);

  function updateField(name: keyof typeof form, value: string) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formValid) return;

    onSubmitOrder({
      id: Date.now(),
      dateOrdered: form.dateOrdered,
      itemName: form.itemName || form.itemType,
      supplier: form.supplier,
      totalPrice: form.totalPrice,
      pricePerUnit: form.pricePerUnit,
      catalogueNum: form.catalog,
      unitsOrdered: form.unitsOrdered,
      expiryDate: form.expiryDate,
      delivered,
      dateDelivered: delivered ? form.dateDelivered : undefined,
    });
  }

  return (
    <section className="view active">
      <div className="crumb">
        <span className="root">ORDERS</span>
        <span>/</span>
        <span className="cur">Adding Item</span>
      </div>

      <form className="form-card" onSubmit={handleSubmit}>
        <div className="form-top">
          <h2>Order Information</h2>

          <button
            type="button"
            className={delivered ? "toggle-wrap on" : "toggle-wrap"}
            onClick={() => setDelivered((current) => !current)}
          >
            <span className="toggle" />
            <span className="tlabel">
              {delivered ? "Delivered" : "Not Delivered"}
            </span>
          </button>
        </div>

        <div className="grid">
          <div className="field">
            <label>
              Item Name <span className="req-star">*</span>
            </label>
            <div className="control">
              <input
                placeholder="Fisher Scientific"
                value={form.itemName}
                onChange={(event) => updateField("itemName", event.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label>
              Item Type <span className="req-star">*</span>
            </label>
            <div className="control">
              <select
                value={form.itemType}
                onChange={(event) => updateField("itemType", event.target.value)}
              >
                <option value="">Search Item Types</option>
                {ITEM_TYPES.map((itemType) => (
                  <option key={itemType} value={itemType}>
                    {itemType}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label>
              Supplier <span className="req-star">*</span>
            </label>
            <div className="control">
              <input
                placeholder="Fisher Scientific"
                value={form.supplier}
                onChange={(event) => updateField("supplier", event.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label>
              Catalog Number <span className="req-star">*</span>
            </label>
            <div className="control">
              <input
                placeholder="00-000"
                value={form.catalog}
                onChange={(event) => updateField("catalog", event.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label>
              Date Order Placed <span className="req-star">*</span>
            </label>
            <div className="control">
              <input
                type="date"
                value={form.dateOrdered}
                onChange={(event) =>
                  updateField("dateOrdered", event.target.value)
                }
              />
            </div>
          </div>

          <div className="field">
            <label>
              Expiry Date <span className="req-star">*</span>
            </label>
            <div className="control">
              <input
                type="date"
                value={form.expiryDate}
                onChange={(event) =>
                  updateField("expiryDate", event.target.value)
                }
              />
            </div>
          </div>

          <div className="field">
            <label>
              Units Ordered <span className="req-star">*</span>
            </label>
            <div className="control">
              <input
                type="number"
                min="0"
                placeholder="00"
                value={form.unitsOrdered}
                onChange={(event) =>
                  updateField("unitsOrdered", event.target.value)
                }
              />
            </div>
          </div>

          <div className="field">
            <label>
              Reorder Level <span className="req-star">*</span>
            </label>
            <div className="control">
              <input
                type="number"
                min="0"
                placeholder="00"
                value={form.reorderLevel}
                onChange={(event) =>
                  updateField("reorderLevel", event.target.value)
                }
              />
            </div>
          </div>

          <div className="field">
            <label>
              Price Per Unit <span className="req-star">*</span>
            </label>
            <div className="control">
              <span className="prefix">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={form.pricePerUnit}
                onChange={(event) =>
                  updateField("pricePerUnit", event.target.value)
                }
              />
              <span className="suffix">USD</span>
            </div>
          </div>

          <div className="field">
            <label>
              Total Price <span className="req-star">*</span>
            </label>
            <div className="control">
              <span className="prefix">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Number"
                value={form.totalPrice}
                onChange={(event) =>
                  updateField("totalPrice", event.target.value)
                }
              />
              <span className="suffix">USD</span>
            </div>
          </div>

          <div className={delivered ? "field" : "field disabled"}>
            <label>Date Delivered</label>
            <div className="control">
              <input
                type="date"
                disabled={!delivered}
                value={form.dateDelivered}
                onChange={(event) =>
                  updateField("dateDelivered", event.target.value)
                }
              />
            </div>
          </div>

          <div className={delivered ? "field" : "field disabled"}>
            <label>Date Paid</label>
            <div className="control">
              <input
                type="date"
                disabled={!delivered}
                value={form.datePaid}
                onChange={(event) => updateField("datePaid", event.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label>Product Image</label>
            <div className={fileName === "From device" ? "file-row" : "file-row has"}>
              <label className="choose">
                Choose File
                <input
                  type="file"
                  accept="image/*,video/*"
                  hidden
                  onChange={(event) =>
                    setFileName(event.target.files?.[0]?.name ?? "From device")
                  }
                />
              </label>
              <span className="fname">{fileName}</span>
            </div>
          </div>
        </div>

        <div className="form-footer">
          <button type="button" className="btn secondary" onClick={onBack}>
            Back
          </button>

          <button type="submit" className="btn primary" disabled={!formValid}>
            Submit
          </button>
        </div>
      </form>
    </section>
  );
}