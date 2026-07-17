"use client";

import { useMemo, useState } from "react";

import StatusBadge from "@/components/StatusBadge";
import {
  emojiFor,
  type InventoryItem,
  type ItemType,
  type Status,
} from "@/types/inventory";

type StockItemsTableProps = {
  items: InventoryItem[];
  itemTypes: ItemType[];
  isAdmin: boolean;
  commentCountsByItemId: Record<string, number>;
  onAddItem: () => void;
  onEditItem: (item: InventoryItem) => void;
  onDeleteItem: (itemId: string) => void;
  onViewComments: (item: InventoryItem) => void;
};

type FilterValue = Status | "everything";
type StockSort =
  | "name"
  | "quantity-low"
  | "quantity-high"
  | "catalog"
  | "storage";

const FILTERS: Array<{ label: string; value: FilterValue }> = [
  { label: "Everything", value: "everything" },
  { label: "Low", value: "low" },
  { label: "Critical", value: "critical" },
  { label: "Out of Stock", value: "out" },
];

export default function StockItemsTable({
  items,
  itemTypes,
  isAdmin,
  commentCountsByItemId,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onViewComments,
}: StockItemsTableProps) {
  const [filter, setFilter] = useState<FilterValue>("everything");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<StockSort>("name");

  const itemTypeById = useMemo(() => {
    return new Map(itemTypes.map((itemType) => [itemType.id, itemType]));
  }, [itemTypes]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...items]
      .filter((item) => {
        const itemType = item.itemTypeId
          ? itemTypeById.get(item.itemTypeId)
          : null;

        const matchesFilter = filter === "everything" || item.status === filter;

        const searchText = [
          item.itemName,
          itemType?.name,
          item.category,
          item.brand,
          item.catalogueNum,
          item.lotNum,
          item.shelfNum,
          item.storageId,
          item.quantity,
          item.expiryDate,
          item.tags.join(" "),
        ]
          .filter((value) => value !== null && value !== undefined)
          .join(" ")
          .toLowerCase();

        return matchesFilter && searchText.includes(query);
      })
      .sort((a, b) => {
        if (sort === "quantity-low") return a.quantity - b.quantity;
        if (sort === "quantity-high") return b.quantity - a.quantity;
        if (sort === "catalog") return a.catalogueNum.localeCompare(b.catalogueNum);
        if (sort === "storage") return a.storageId.localeCompare(b.storageId);

        return a.itemName.localeCompare(b.itemName);
      });
  }, [filter, itemTypeById, items, search, sort]);

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Stock Items</h2>
          <p className="sub">
            Individual catalog, lot, storage, and quantity records
          </p>
        </div>

        {isAdmin && (
          <button type="button" className="btn primary" onClick={onAddItem}>
            + Add Stock Item
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
            placeholder="Search stock items"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <select
          className="select-control"
          value={sort}
          onChange={(event) => setSort(event.target.value as StockSort)}
        >
          <option value="name">Name</option>
          <option value="catalog">Catalog Number</option>
          <option value="storage">Storage</option>
          <option value="quantity-low">Quantity: Low to High</option>
          <option value="quantity-high">Quantity: High to Low</option>
        </select>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Stock Item</th>
              <th>Item Type</th>
              <th>Catalog #</th>
              <th>Brand</th>
              <th>Lot #</th>
              <th>Storage</th>
              <th>Shelf</th>
              <th>Qty</th>
              <th>Expiry</th>
              <th>Status</th>
              <th>Comments</th>
              {isAdmin && <th />}
            </tr>
          </thead>

          <tbody>
            {visibleItems.map((item, index) => {
              const itemType = item.itemTypeId
                ? itemTypeById.get(item.itemTypeId)
                : null;

              const commentCount = commentCountsByItemId[item.id] ?? 0;

              return (
                <tr key={item.id}>
                  <td className="strong-text">{index + 1}</td>

                  <td>
                    <div className="item-cell">
                      <div className="thumb">{emojiFor(item.itemName)}</div>
                      <div>
                        <div className="nm">{item.itemName}</div>
                        <div className="sub">{item.catalogueNum}</div>
                      </div>
                    </div>
                  </td>

                  <td>{itemType?.name ?? "Unlinked"}</td>
                  <td>{item.catalogueNum}</td>
                  <td>{item.brand}</td>
                  <td>{item.lotNum}</td>
                  <td>{item.storageId}</td>
                  <td>{item.shelfNum}</td>
                  <td className="strong-text">{item.quantity}</td>
                  <td>{item.expiryDate}</td>

                  <td>
                    <StatusBadge status={item.status} />
                  </td>

                  <td>
                    <button
                      type="button"
                      className={commentCount > 0 ? "comment-chip has-comments" : "comment-chip"}
                      onClick={() => onViewComments(item)}
                    >
                      💬 {commentCount}
                    </button>
                  </td>

                  {isAdmin && (
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          title="Edit stock item"
                          onClick={() => onEditItem(item)}
                        >
                          ✎
                        </button>

                        <button
                          type="button"
                          className="icon-btn del"
                          title="Archive stock item"
                          onClick={() => onDeleteItem(item.id)}
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}

            {visibleItems.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 13 : 12} className="empty-row">
                  No stock items found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}