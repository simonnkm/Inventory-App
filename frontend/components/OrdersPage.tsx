"use client";

import { useMemo, useRef, useState } from "react";
import type { OrderRecord } from "@/types/inventory";

type OrdersPageProps = {
  orders: OrderRecord[];
  loading: boolean;
  onRefresh: () => void;
  onImportExcel: (file: File) => Promise<void>;
  onExportAll: () => Promise<void>;
  onExportSelected: (ids: number[]) => Promise<void>;
};

function money(value: number | null) {
  if (value === null || value === undefined) return "—";
  return `$${value.toFixed(2)}`;
}

function text(value: string | number | null) {
  return value === null || value === undefined || value === "" ? "—" : value;
}

export default function OrdersPage({
  orders,
  loading,
  onRefresh,
  onImportExcel,
  onExportAll,
  onExportSelected,
}: OrdersPageProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const visibleOrders = useMemo(() => {
    const query = search.toLowerCase();

    return orders.filter((order) =>
      [
        order.vendor,
        order.category,
        order.catalogNo,
        order.itemName,
        order.poNumber,
        order.orderNumber,
        order.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [orders, search]);

  const allVisibleSelected =
    visibleOrders.length > 0 &&
    visibleOrders.every((order) => selectedIds.includes(order.id));

  function toggleOrder(id: number) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !visibleOrders.some((order) => order.id === id)),
      );
      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);

      visibleOrders.forEach((order) => {
        next.add(order.id);
      });

      return Array.from(next);
    });
  }

  async function handleFileChange(file: File | undefined) {
    if (!file) return;

    setImporting(true);

    try {
      await onImportExcel(file);
      setSelectedIds([]);
    } finally {
      setImporting(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <section className="view active">
      <p className="section-tag">ORDERS</p>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Orders</h2>
            <p className="sub">
              Displaying <b>{visibleOrders.length} orders</b>
            </p>
          </div>

          <div className="order-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xlsm"
              hidden
              onChange={(event) => void handleFileChange(event.target.files?.[0])}
            />

            <button
              type="button"
              className="btn tertiary"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? "Importing..." : "Import Excel"}
            </button>

            <button
              type="button"
              className="btn secondary"
              onClick={() => void onExportSelected(selectedIds)}
              disabled={selectedIds.length === 0}
            >
              Export Selected
            </button>

            <button
              type="button"
              className="btn primary"
              onClick={() => void onExportAll()}
            >
              Export All
            </button>

            <button
              type="button"
              className="btn secondary"
              onClick={onRefresh}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="toolbar">
          <div className="filters">
            <button type="button" className="chip active">
              Everything
            </button>
          </div>

          <div className="search">
            <span className="search-icon">⌕</span>
            <input
              placeholder="Search orders"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                  />
                </th>
                <th>Date</th>
                <th>Order Placed By</th>
                <th>PO Number</th>
                <th>Vendor</th>
                <th>Category</th>
                <th>Catalog No.</th>
                <th>Item Name</th>
                <th># Units</th>
                <th>Price / Unit</th>
                <th>Total Price</th>
                <th>Final Price</th>
                <th>Availability</th>
                <th>Expected Delivery</th>
                <th>Order #</th>
                <th>Delivery Date</th>
                <th>Status</th>
                <th>Received By</th>
                <th>Date Paid</th>
                <th>Amount Paid</th>
                <th>CC/Invoice?</th>
              </tr>
            </thead>

            <tbody>
              {visibleOrders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(order.id)}
                      onChange={() => toggleOrder(order.id)}
                    />
                  </td>
                  <td>{text(order.orderDate)}</td>
                  <td>{text(order.orderPlacedBy)}</td>
                  <td>{text(order.poNumber)}</td>
                  <td>{text(order.vendor)}</td>
                  <td>{text(order.category)}</td>
                  <td>{text(order.catalogNo)}</td>
                  <td className="strong-text">{order.itemName}</td>
                  <td>{text(order.unitsOrdered)}</td>
                  <td>{money(order.pricePerUnit)}</td>
                  <td>{money(order.totalPrice)}</td>
                  <td>{money(order.finalPrice)}</td>
                  <td>{text(order.availability)}</td>
                  <td>{text(order.expectedDeliveryDate)}</td>
                  <td>{text(order.orderNumber)}</td>
                  <td>{text(order.deliveryDate)}</td>
                  <td>{text(order.status)}</td>
                  <td>{text(order.receivedBy)}</td>
                  <td>{text(order.datePaid)}</td>
                  <td>{money(order.amountPaid)}</td>
                  <td>{text(order.ccInvoice)}</td>
                </tr>
              ))}

              {visibleOrders.length === 0 && (
                <tr>
                  <td colSpan={21} className="empty-row">
                    {loading ? "Loading orders..." : "No orders found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}