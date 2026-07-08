"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import AddOrderForm from "@/components/AddOrderForm";
import AuditLogTable from "@/components/AuditLogTable";
import InventoryTable from "@/components/InventoryTable";
import OrdersPage from "@/components/OrdersPage";
import Sidebar from "@/components/Sidebar";
import StatCard from "@/components/StatCard";
import Topbar from "@/components/Topbar";
import UsersPage from "@/components/UsersPage";
import {
  createOrderRecord,
  createTransaction,
  createUser,
  deleteItem,
  deleteUser,
  exportOrdersExcel,
  getAuditLogs,
  getCurrentUser,
  getItems,
  getOrders,
  getUsers,
  importOrdersExcel,
  login,
  type CurrentUser,
} from "@/lib/api";
import {
  type AuditLog,
  type InventoryItem,
  type Order,
  type UserAccount,
  type View,
  type OrderRecord,
} from "@/types/inventory";
function getInitials(username: string) {
  return username
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

export default function Home() {
  const [view, setView] = useState<View>("inventory");

  const [token, setToken] = useState("");
  const [user, setUser] = useState<CurrentUser | null>(null);

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [restoring, setRestoring] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [busyMessage, setBusyMessage] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const isAdmin = user?.role?.toLowerCase() === "admin";

  const stats = useMemo(() => {
    return {
      low: inventory.filter((item) => item.status === "low").length,
      critical: inventory.filter((item) => item.status === "critical").length,
      out: inventory.filter((item) => item.status === "out").length,
      expiring: inventory.filter((item) => item.status === "expiring").length,
    };
  }, [inventory]);

  useEffect(() => {
    const savedToken = localStorage.getItem("access_token");

    if (!savedToken) {
      setRestoring(false);
      return;
    }

    setToken(savedToken);
  }, []);

  useEffect(() => {
    if (!user) return;

    if (!isAdmin && view !== "inventory") {
      setView("inventory");
    }
  }, [isAdmin, user, view]);

  useEffect(() => {
    if (!token) return;

    void restoreSession(token);
  }, [token]);

  function showToast(message: string) {
    setToast(message);

    window.setTimeout(() => {
      setToast("");
    }, 2500);
  }

  async function restoreSession(activeToken: string) {
    setRestoring(true);
    setError("");

    try {
      const [currentUser, items] = await Promise.all([
        getCurrentUser(activeToken),
        getItems(activeToken),
      ]);

      setUser(currentUser);
      setInventory(items);
    } catch (err) {
      localStorage.removeItem("access_token");
      setToken("");
      setUser(null);
      setInventory([]);
      setError(err instanceof Error ? err.message : "Failed to restore session");
    } finally {
      setRestoring(false);
    }
  }

  async function refreshUsers(activeToken = token) {
    if (!activeToken || !isAdmin) return;

    setLoadingUsers(true);
    setError("");

    try {
      const userList = await getUsers(activeToken);
      setUsers(userList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  }

  async function handleDeleteUser(userId: number) {
    if (!isAdmin) return;

    const confirmed = window.confirm(
      "Delete this user? This cannot be undone.",
    );

    if (!confirmed) return;

    setError("");

    try {
      await deleteUser(token, userId);
      await refreshUsers();
      showToast("User deleted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    }
  }
  async function refreshInventory(activeToken = token) {
    if (!activeToken) return;

    setLoadingInventory(true);
    setError("");

    try {
      const items = await getItems(activeToken);
      setInventory(items);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory");
    } finally {
      setLoadingInventory(false);
    }
  }

  async function refreshAuditLogs(activeToken = token) {
    if (!activeToken || !isAdmin) return;

    setError("");

    try {
      const logs = await getAuditLogs(activeToken);
      setAuditLogs(logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs");
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoggingIn(true);
    setError("");

    try {
      const tokenData = await login(loginUsername, loginPassword);

      localStorage.setItem("access_token", tokenData.access_token);

      setToken(tokenData.access_token);
      setLoginPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoggingIn(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("access_token");

    setToken("");
    setUser(null);
    setInventory([]);
    setAuditLogs([]);
    setView("inventory");
    setError("");
  }

  function handleViewChange(nextView: View) {
    if (!isAdmin && nextView !== "inventory") {
      setView("inventory");
      return;
    }

    setView(nextView);

    if (nextView === "audit") {
      void refreshAuditLogs();
    }

    if (nextView === "users") {
      void refreshUsers();
    }

    if (nextView === "orders") {
      void refreshOrders();
}
  }
  
  function goToAddForm() {
    if(!isAdmin) return;

    setView("add");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleQuantityChange(
    item: InventoryItem,
    nextQuantity: number,
  ) {
    if (!Number.isInteger(nextQuantity) || nextQuantity < 0) {
      setError("Quantity must be a whole number that is 0 or higher.");
      return;
    }

    const changeAmount = nextQuantity - item.quantity;

    if (changeAmount === 0) return;

    if (changeAmount > 0 && !isAdmin) {
      setError("Only admins can increase item quantity.");
      return;
    }

    setBusyMessage(`Updating ${item.itemName}...`);
    setError("");

    try {
      await createTransaction(token, item.id, changeAmount);
      await refreshInventory();

      if (view === "audit") {
        await refreshAuditLogs();
      }

      showToast("Quantity updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update quantity");
    } finally {
      setBusyMessage("");
    }
  }

  async function handleCreateUser(payload: {
    username: string;
    password: string;
    role: "user" | "admin";
  }) {
    if (!isAdmin) return;

    setError("");

    try {
      await createUser(token, payload);
      await refreshUsers();
      showToast(`Created ${payload.role} account`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    }
  }
  async function handleDeleteItem(itemId: string) {
    if (!isAdmin) return;

    const confirmed = window.confirm("Delete this item? This cannot be undone.");

    if (!confirmed) return;

    setBusyMessage("Deleting item...");
    setError("");

    try {
      await deleteItem(token, itemId);
      await refreshInventory();

      if (view === "audit") {
        await refreshAuditLogs();
      }

      showToast("Item deleted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete item");
    } finally {
      setBusyMessage("");
    }
  }
  async function refreshOrders(activeToken = token) {
    if (!activeToken || !isAdmin) return;

    setLoadingOrders(true);
    setError("");

    try {
      const orderList = await getOrders(activeToken);
      setOrders(orderList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setLoadingOrders(false);
    }
  }

  async function handleImportOrders(file: File) {
    setError("");

    try {
      await importOrdersExcel(token, file);
      await refreshOrders();
      await refreshInventory();
      showToast("Orders imported and inventory updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import orders");
    }
  }

  async function handleExportAllOrders() {
    setError("");

    try {
      await exportOrdersExcel(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export orders");
    }
  }

  async function handleExportSelectedOrders(ids: number[]) {
    setError("");

    try {
      await exportOrdersExcel(token, ids);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export selected orders");
    }
  }

  function handleEditItem(item: InventoryItem) {
    showToast(`Edit item modal next: ${item.itemName}`);
  }
  function toApiDate(value?: string | null) {
    if (!value) return null;

    const text = value.trim();

    if (!text) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return text;
    }

    const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

    if (!match) return null;

    const month = match[1].padStart(2, "0");
    const day = match[2].padStart(2, "0");
    const year = match[3];

    return `${year}-${month}-${day}`;
  }

  function toNumberOrNull(value?: string | number | null) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }

    const cleaned = value.replace("$", "").replace(",", "").trim();
    const number = Number(cleaned);

    return Number.isFinite(number) ? number : null;
  }
  async function handleSubmitOrder(order: Order) {
    setError("");

    try {
      await createOrderRecord(token, {
        order_date: toApiDate(order.dateOrdered),
        order_placed_by: user?.username ?? null,
        po_number: null,
        vendor: order.supplier,
        category: "Uncategorized",
        catalog_no: order.catalogueNum,
        item_name: order.itemName,
        units_ordered: toNumberOrNull(order.unitsOrdered),
        price_per_unit: toNumberOrNull(order.pricePerUnit),
        total_price: toNumberOrNull(order.totalPrice),
        final_price: toNumberOrNull(order.totalPrice),
        availability: null,
        expected_delivery_date: toApiDate(order.expiryDate),
        order_number: null,
        delivery_date: order.delivered ? toApiDate(order.dateDelivered) : null,
        status: order.delivered ? "Delivered" : "Ordered",
        received_by: order.delivered ? user?.username ?? null : null,
        date_paid: null,
        amount_paid: null,
        cc_invoice: null,
      });

      await refreshOrders();
      await refreshInventory();

      showToast("Order added and inventory updated");
      setView("orders");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add order");
    }
  }

  if (restoring) {
    return (
      <main className="login-page">
        <p>Restoring session...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="login-page">
        <form className="login-card" onSubmit={handleLogin}>
          <div className="brand">
            <div className="mark" />
            <div>
              <div className="name">
                1Cell<span className="ai">.Ai</span>
              </div>
              <div className="tag">AI-Powered Precision Oncology</div>
            </div>
          </div>

          <h1>Inventory Tracking</h1>
          <p>Sign in to manage lab inventory.</p>

          <label>
            Username
            <input
              value={loginUsername}
              onChange={(event) => setLoginUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p className="error-message">{error}</p>}

          <button type="submit" className="btn primary" disabled={loggingIn}>
            {loggingIn ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <div className="app">
      <Sidebar
        view={view}
        isAdmin={isAdmin}
        onViewChange={handleViewChange}
      />

      <main className="main">
        <Topbar
          name={user.username}
          email={`${user.role} account`}
          initials={getInitials(user.username)}
          onLogout={handleLogout}
        />

        {error && <p className="error-banner">{error}</p>}
        {busyMessage && <p className="loading-banner">{busyMessage}</p>}
        {loadingInventory && <p className="loading-banner">Loading inventory...</p>}

        {view === "inventory" && (
          <section className="view active">
            <div className="stats">
              <StatCard
                label="Low Stock Items"
                value={stats.low}
                icon="📦"
                tone="warning"
              />

              <StatCard
                label="Critically Low Stock Items"
                value={stats.critical}
                icon="⚠"
                tone="critical"
              />

              <StatCard
                label="Out of Stock Items"
                value={stats.out}
                icon="⊘"
                tone="muted"
              />

              <StatCard
                label="Expiring Items"
                value={stats.expiring}
                icon="⏱"
                tone="danger"
              />
            </div>

            <p className="section-tag">
              INVENTORY
            </p>

            <InventoryTable
              items={inventory}
              isAdmin={isAdmin}
              onAddItem={goToAddForm}
              onEditItem={handleEditItem}
              onDeleteItem={handleDeleteItem}
              onQuantityChange={handleQuantityChange}
            />
          </section>
        )}

        {isAdmin && view === "users" && (
          <UsersPage
            users={users}
            loading={loadingUsers}
            onRefresh={() => void refreshUsers()}
            onCreateUser={handleCreateUser}
            onDeleteUser={handleDeleteUser}
            currentUserId={user.id}
          />
        )}

        {isAdmin && view === "orders" && (
          <OrdersPage
            orders={orders}
            loading={loadingOrders}
            onRefresh={() => void refreshOrders()}
            onImportExcel={handleImportOrders}
            onExportAll={handleExportAllOrders}
            onExportSelected={handleExportSelectedOrders}
          />
        )}

        {isAdmin && view === "add" && (
          <AddOrderForm
            onBack={() => setView("orders")}
            onSubmitOrder={handleSubmitOrder}
          />
        )}

        {isAdmin && view === "audit" && <AuditLogTable logs={auditLogs} />}

      </main>

      <div className={toast ? "toast show" : "toast"}>
        <span>✓</span>
        <span>{toast}</span>
      </div>
    </div>
  );
}