"use client";

import { useMemo, useState } from "react";

import StatusBadge from "@/components/StatusBadge";
import { emojiFor, type ItemType, type Status } from "@/types/inventory";

type InventoryTableProps = {
  items: ItemType[];
  isAdmin: boolean;
  onAddItem: () => void;
  onEditItem: (item: ItemType) => void;
  onDeleteItem: (itemId: number) => void;
};

type FilterValue = Status | "everything";
type InventorySort = "name" | "quantity-low" | "quantity-high";

const FILTERS: Array<{ label: string; value: FilterValue }> = [
  { label: "Everything", value: "everything" },
  { label: "Low", value: "low" },
  { label: "Critical", value: "critical" },
  { label: "Out of Stock", value: "out" },
];

export default function InventoryTable({
  items,
  isAdmin,
  onAddItem,
  onEditItem,
  onDeleteItem,
}: InventoryTableProps) {
  const [filter, setFilter] = useState<FilterValue>("everything");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<InventorySort>("name");

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...items]
      .filter((item) => {
        const matchesFilter = filter === "everything" || item.status === filter;

        const searchText = [
          item.name,
          item.category,
          item.brand,
          item.notes,
          item.totalQuantity,
        ]
          .filter((value) => value !== null && value !== undefined)
          .join(" ")
          .toLowerCase();

        return matchesFilter && searchText.includes(query);
      })
      .sort((a, b) => {
        if (sort === "quantity-low") {
          return a.totalQuantity - b.totalQuantity;
        }

        if (sort === "quantity-high") {
          return b.totalQuantity - a.totalQuantity;
        }

        return a.name.localeCompare(b.name);
      });
  }, [filter, items, search, sort]);

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Inventory List</h2>
          <p className="sub">
            Displaying <b>{visibleItems.length} item types</b> at 1Cell.AI
          </p>
        </div>

        {isAdmin && (
          <button type="button" className="btn primary" onClick={onAddItem}>
            + Add Item Type
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
            placeholder="Search item types"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <select
          className="select-control"
          value={sort}
          onChange={(event) => setSort(event.target.value as InventorySort)}
        >
          <option value="name">Name</option>
          <option value="quantity-low">Quantity: Low to High</option>
          <option value="quantity-high">Quantity: High to Low</option>
        </select>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Item Type</th>
              <th>Category</th>
              <th>Brand</th>
              <th>Total Qty</th>
              <th>Status</th>
              <th>Notes</th>
              {isAdmin && <th />}
            </tr>
          </thead>

          <tbody>
            {visibleItems.map((item, index) => (
              <tr key={item.id}>
                <td className="strong-text">{index + 1}</td>

                <td>
                  <div className="item-cell">
                    <div className="thumb">{emojiFor(item.name)}</div>
                    <div>
                      <div className="nm">{item.name}</div>
                      <div className="sub">Item Type #{item.id}</div>
                    </div>
                  </div>
                </td>

                <td>{item.category ?? "Uncategorized"}</td>
                <td>{item.brand ?? "—"}</td>
                <td className="strong-text">{item.totalQuantity}</td>

                <td>
                  <StatusBadge status={item.status} />
                </td>

                <td>{item.notes ?? "—"}</td>

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
                <td colSpan={isAdmin ? 8 : 7} className="empty-row">
                  No inventory item types found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}