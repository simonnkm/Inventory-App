import type { View } from "@/types/inventory";

type SidebarProps = {
  view: View;
  isAdmin: boolean;
  onViewChange: (view: View) => void;
};

export default function Sidebar({
  view,
  isAdmin,
  onViewChange,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="mark" />

        <div>
          <div className="name">
            1Cell<span className="ai">.Ai</span>
          </div>
          <div className="tag">AI-Powered Precision Oncology</div>
        </div>
      </div>

      <div className="nav-label">MENU</div>

      <nav className="nav">
        <button
          type="button"
          className={view === "inventory" ? "active" : ""}
          onClick={() => onViewChange("inventory")}
        >
          <span className="nav-icon">⬡</span>
          Inventory
        </button>

        <button
          type="button"
          className={
            view === "stock-items" ||
            view === "add-item" ||
            view === "edit-item"
              ? "active"
              : ""
          }
          onClick={() => onViewChange("stock-items")}
        >
          <span className="nav-icon">📦</span>
          Stock Items
        </button>

        {isAdmin && (
          <>
            <button
              type="button"
              className={
                view === "orders" || view === "add-order" ? "active" : ""
              }
              onClick={() => onViewChange("orders")}
            >
              <span className="nav-icon">☑</span>
              Orders
            </button>

            <button
              type="button"
              className={view === "users" ? "active" : ""}
              onClick={() => onViewChange("users")}
            >
              <span className="nav-icon">👥</span>
              Users
            </button>

            <button
              type="button"
              className={view === "audit" ? "active" : ""}
              onClick={() => onViewChange("audit")}
            >
              <span className="nav-icon">≣</span>
              Audit Log
            </button>
          </>
        )}
      </nav>
    </aside>
  );
}