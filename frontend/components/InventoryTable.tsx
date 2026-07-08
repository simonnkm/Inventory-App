"use client";

import { useMemo, useState } from "react";
import QuantityStepper from "@/components/QuantityStepper";
import StatusBadge from "@/components/StatusBadge";
import {
  emojiFor,
  type InventoryItem,
  type Status,
} from "@/types/inventory";

type InventoryTableProps = {
  items: InventoryItem[];
  isAdmin: boolean;
  onAddItem: () => void;
  onEditItem: (item: InventoryItem) => void;
  onDeleteItem: (itemId: string) => void;
  onQuantityChange: (item: InventoryItem, nextQuantity: number) => void;
};

const FILTERS: Array<{
  label: string;
  value: Status | "everything";
}> = [
  { label: "Everything", value: "everything" },
  { label: "Low", value: "low" },
  { label: "Critical", value: "critical" },
  { label: "Out of Stock", value: "out" },
  { label: "Expiring", value: "expiring" },
];

export default function InventoryTable({
  items,
  isAdmin,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onQuantityChange,
}: InventoryTableProps) {
  const [filter, setFilter] = useState<Status | "everything">("everything");
  const [search, setSearch] = useState("");
  const [inventorySort, setInventorySort] = useState<
    "default" | "recently-used" | "quantity-low" | "quantity-high"
  >("default");

  
  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      const matchesFilter = filter === "everything" || item.status === filter;

      const searchText = [
        item.itemName,
        item.category,
        item.brand,
        item.catalogueNum,
        item.storageId,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchText.includes(search.toLowerCase());

      return matchesFilter && matchesSearch;
    });
  }, [filter, items, search]);

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Inventory List</h2>
          <p className="sub">
            Displaying <b>{visibleItems.length} items</b> at 1Cell.AI
          </p>
        </div>

        {isAdmin && (
          <button type="button" className="btn primary" onClick={onAddItem}>
            + Add Item
          </button>
        )}
      </div>

      <div className="toolbar">
        <div className="filters">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={filter === option.value ? "chip active" : "chip"}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="search">
          <span className="search-icon">⌕</span>
          <input
            placeholder="Search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>No ↑</th>
              <th>Item Type</th>
              <th>Brand</th>
              <th>Catalog #</th>
              <th>Lot #</th>
              <th>Storage</th>
              <th>Shelf #</th>
              <th>Qty ↑</th>
              <th>Expiry Date</th>
              <th>Status ↓</th>
              {isAdmin && <th />}
            </tr>
          </thead>

          <tbody>
            {visibleItems.map((item) => (
              <tr key={item.id}>
                <td className="strong-text">{item.no}</td>

                <td>
                  <div className="item-cell">
                    <div className="thumb">{emojiFor(item.itemName)}</div>
                    <div>
                      <div className="nm">{item.itemName}</div>
                      <div className="sub">{item.category}</div>
                    </div>
                  </div>
                </td>

                <td>{item.brand}</td>
                <td>{item.catalogueNum}</td>
                <td>{item.lotNum}</td>
                <td>{item.storageId}</td>
                <td>{item.shelfNum}</td>

                <td>
                  <QuantityStepper
                    value={item.quantity}
                    canIncrease={isAdmin}
                    onChange={(nextQuantity) =>
                      onQuantityChange(item, nextQuantity)
                    }
                  />
                </td>

                <td>{item.expiryDate}</td>

                <td>
                  <StatusBadge status={item.status} />
                </td>

                {isAdmin && (
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        title="Edit"
                        onClick={() => onEditItem(item)}
                      >
                        ✎
                      </button>

                      <button
                        type="button"
                        className="icon-btn del"
                        title="Delete"
                        onClick={() => onDeleteItem(item.id)}
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}

            {visibleItems.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 11 : 10} className="empty-row">
                  No inventory items found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}