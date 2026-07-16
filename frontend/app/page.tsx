"use client";

import { useEffect, useMemo, useState } from "react";

import AddItemForm from "@/components/AddItemForm";
import AddOrderForm from "@/components/AddOrderForm";
import AuditLogTable from "@/components/AuditLogTable";
import InventoryTable from "@/components/InventoryTable";
import OrdersPage from "@/components/OrdersPage";
import Sidebar from "@/components/Sidebar";
import StatCard from "@/components/StatCard";
import StockItemsTable from "@/components/StockItemsTable";
import Topbar from "@/components/Topbar";
import UsersPage from "@/components/UsersPage";

import {
  createItem,
  createItemComment,
  createOrderRecord,
  createUser,
  deleteItem,
  deleteItemComment,
  deleteItemType,
  deleteOrderDocument,
  deleteUser,
  downloadOrderDocument,
  exportOrdersExcel,
  getAuditLogs,
  getCommentNotifications,
  getCurrentUser,
  getItemComments,
  getItems,
  getItemTypes,
  getOrderDocuments,
  getOrders,
  getUsers,
  importOrdersExcel,
  login,
  markItemCommentsRead,
  markItemTypeCommentsRead,
  markOrderDelivered,
  markOrderPaid,
  uploadOrderDocument,
  updateItem,
  updateItemType,
  type CurrentUser,
} from "@/lib/api";

import type {
  AuditLog,
  CommentNotificationSummary,
  InventoryItem,
  ItemComment,
  ItemType,
  Order,
  OrderDocumentType,
  OrderRecord,
  UserAccount,
  View,
} from "@/types/inventory";

type CommentTarget =
  | {
      kind: "item";
      title: string;
      itemIds: string[];
    }
  | {
      kind: "item-type";
      title: string;
      itemIds: string[];
    };

type CommentRow = ItemComment & {
  itemName: string;
  catalogueNum: string;
};

function getInitials(username: string) {
  return (
    username
      .split(/[.\s_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
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

function withTimeout<T>(promise: Promise<T>, ms = 5000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      window.setTimeout(
        () => reject(new Error("Backend took too long to respond")),
        ms,
      ),
    ),
  ]);
}

const EMPTY_NOTIFICATIONS: CommentNotificationSummary = {
  totalUnread: 0,
  items: [],
  itemTypes: [],
};

export default function Home() {
  const [view, setView] = useState<View>("inventory");
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [orderSeedItem, setOrderSeedItem] = useState<InventoryItem | null>(null);

  const [token, setToken] = useState("");
  const [user, setUser] = useState<CurrentUser | null>(null);

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);

  const [commentsByItemId, setCommentsByItemId] = useState<
    Record<string, ItemComment[]>
  >({});
  const [commentTarget, setCommentTarget] = useState<CommentTarget | null>(null);
  const [commentInput, setCommentInput] = useState("");
  const [showCommentOverview, setShowCommentOverview] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentNotifications, setCommentNotifications] =
    useState<CommentNotificationSummary>(EMPTY_NOTIFICATIONS);

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [restoring, setRestoring] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const isAdmin = user?.role?.toLowerCase() === "admin";

  const stats = useMemo(() => {
    return {
      low: itemTypes.filter((item) => item.status === "low").length,
      critical: itemTypes.filter((item) => item.status === "critical").length,
      out: itemTypes.filter((item) => item.status === "out").length,
      expiring: itemTypes.filter((item) => item.status === "expiring").length,
    };
  }, [itemTypes]);

  const commentCountsByItemId = useMemo(() => {
    return Object.fromEntries(
      commentNotifications.items.map((item) => [
        item.itemId,
        item.unreadCount,
      ]),
    );
  }, [commentNotifications]);

  const commentCountsByItemTypeId = useMemo(() => {
    return Object.fromEntries(
      commentNotifications.itemTypes.map((itemType) => [
        itemType.itemTypeId,
        itemType.unreadCount,
      ]),
    );
  }, [commentNotifications]);

  const totalCommentCount = commentNotifications.totalUnread;

  const activeCommentRows = useMemo<CommentRow[]>(() => {
    if (!commentTarget) return [];

    const rows = commentTarget.itemIds.flatMap((itemId) => {
      const item = inventory.find((candidate) => candidate.id === itemId);

      return (commentsByItemId[itemId] ?? []).map((comment) => ({
        ...comment,
        itemName: item?.itemName ?? "Unknown item",
        catalogueNum: item?.catalogueNum ?? itemId,
      }));
    });

    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [commentTarget, commentsByItemId, inventory]);

  const topCommentItems = useMemo(() => {
    return inventory
      .map((item) => ({
        item,
        count: commentCountsByItemId[item.id] ?? 0,
      }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [commentCountsByItemId, inventory]);

  const topCommentItemTypes = useMemo(() => {
    return itemTypes
      .map((itemType) => ({
        itemType,
        count: commentCountsByItemTypeId[itemType.id] ?? 0,
      }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [commentCountsByItemTypeId, itemTypes]);

  useEffect(() => {
    async function loadSavedSession() {
      const savedToken = localStorage.getItem("access_token");

      if (!savedToken) {
        setRestoring(false);
        return;
      }

      setRestoring(true);
      setError("");

      try {
        const [currentUser, items, types] = await withTimeout(
          Promise.all([
            getCurrentUser(savedToken),
            getItems(savedToken),
            getItemTypes(savedToken),
          ]),
          5000,
        );

        setToken(savedToken);
        setUser(currentUser);
        setInventory(items);
        setItemTypes(types);

        void refreshComments(savedToken, items);
        void refreshCommentNotifications(savedToken);
      } catch {
        localStorage.removeItem("access_token");
        setToken("");
        setUser(null);
        setInventory([]);
        setItemTypes([]);
        setCommentsByItemId({});
        setCommentNotifications(EMPTY_NOTIFICATIONS);
        setError("Session expired or backend is unreachable. Please sign in again.");
      } finally {
        setRestoring(false);
      }
    }

    void loadSavedSession();
  }, []);

  useEffect(() => {
    if (!user) return;

    if (!isAdmin && view !== "inventory" && view !== "stock-items") {
      setView("inventory");
    }
  }, [isAdmin, user, view]);

  function showToast(message: string) {
    setToast(message);

    window.setTimeout(() => {
      setToast("");
    }, 2500);
  }

  async function refreshCommentNotifications(activeToken = token) {
    if (!activeToken) return;

    try {
      const summary = await getCommentNotifications(activeToken);
      setCommentNotifications(summary);
    } catch {
      setCommentNotifications(EMPTY_NOTIFICATIONS);
    }
  }

  async function refreshComments(activeToken = token, activeInventory = inventory) {
    if (!activeToken) return;

    if (activeInventory.length === 0) {
      setCommentsByItemId({});
      await refreshCommentNotifications(activeToken);
      return;
    }

    setLoadingComments(true);

    try {
      const pairs = await Promise.all(
        activeInventory.map(async (item) => {
          const comments = await getItemComments(activeToken, item.id).catch(
            () => [],
          );

          return [item.id, comments] as const;
        }),
      );

      setCommentsByItemId(Object.fromEntries(pairs));
      await refreshCommentNotifications(activeToken);
    } finally {
      setLoadingComments(false);
    }
  }

  async function goToAddItem() {
    if (!isAdmin) return;

    setEditingItem(null);
    await refreshOrders();
    setView("add-item");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goToAddOrder(item?: InventoryItem) {
    if (!isAdmin) return;

    setOrderSeedItem(item ?? null);
    setView("add-order");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleEditItemType(item: ItemType) {
    if (!isAdmin) return;

    const name = window.prompt("Item type name", item.name);

    if (name === null) return;

    const category = window.prompt("Category", item.category ?? "");

    if (category === null) return;

    const reorderThreshold = window.prompt(
      "Reorder threshold",
      String(item.reorderThreshold),
    );

    if (reorderThreshold === null) return;

    const criticalThreshold = window.prompt(
      "Critical threshold",
      String(item.criticalThreshold),
    );

    if (criticalThreshold === null) return;

    const notes = window.prompt("Notes", item.notes ?? "");

    if (notes === null) return;

    setError("");

    try {
      await updateItemType(token, item.id, {
        name: name.trim() || item.name,
        category: category.trim() || null,
        reorder_threshold: Number(reorderThreshold || item.reorderThreshold),
        critical_threshold: Number(criticalThreshold || item.criticalThreshold),
        notes: notes.trim() || null,
      });

      await refreshInventory();

      showToast("Item type updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update item type");
    }
  }

  async function handleDeleteItemType(itemId: number) {
    if (!isAdmin) return;

    const item = itemTypes.find((candidate) => candidate.id === itemId);

    const confirmed = window.confirm(
      item
        ? `Delete item type "${item.name}"? This only works if no inventory items or orders are linked to it.`
        : "Delete this item type?",
    );

    if (!confirmed) return;

    setError("");

    try {
      await deleteItemType(token, itemId);
      await refreshInventory();

      showToast("Item type deleted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete item type");
    }
  }

  function handleEditStockItem(item: InventoryItem) {
    if (!isAdmin) return;

    setEditingItem(item);
    setView("edit-item");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDeleteStockItem(itemId: string) {
    if (!isAdmin) return;

    const item = inventory.find((candidate) => candidate.id === itemId);

    const confirmed = window.confirm(
      item
        ? `Archive stock item "${item.itemName}" (${item.catalogueNum})? This will not change order history.`
        : "Archive this stock item? This will not change order history.",
    );

    if (!confirmed) return;

    setError("");

    try {
      await deleteItem(token, itemId);
      await refreshInventory();

      showToast("Stock item archived");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive stock item");
    }
  }

  async function handleViewStockItemComments(item: InventoryItem) {
    setShowCommentOverview(false);
    setCommentInput("");
    setCommentTarget({
      kind: "item",
      title: `${item.itemName} (${item.catalogueNum})`,
      itemIds: [item.id],
    });

    try {
      await markItemCommentsRead(token, item.id);
    } catch {
    } finally {
      await refreshCommentNotifications();
    }
  }

  async function handleViewItemTypeComments(itemType: ItemType) {
    const linkedItemIds = inventory
      .filter((item) => item.itemTypeId === itemType.id)
      .map((item) => item.id);

    setShowCommentOverview(false);
    setCommentInput("");
    setCommentTarget({
      kind: "item-type",
      title: `${itemType.name} aggregated comments`,
      itemIds: linkedItemIds,
    });

    try {
      await markItemTypeCommentsRead(token, itemType.id);
    } catch {
    } finally {
      await refreshCommentNotifications();
    }
  }

  async function handleCreateComment() {
    if (!commentTarget) return;

    const text = commentInput.trim();

    if (!text) return;

    const targetItemId = commentTarget.itemIds[0];

    if (!targetItemId) {
      setError("This item type has no linked stock items to attach a comment to.");
      return;
    }

    setError("");

    try {
      await createItemComment(token, targetItemId, text);
      await refreshComments();

      setCommentInput("");
      showToast("Comment added");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add comment");
    }
  }

  async function handleDeleteComment(commentId: number) {
    if (!isAdmin) return;

    const confirmed = window.confirm("Delete this comment?");

    if (!confirmed) return;

    setError("");

    try {
      await deleteItemComment(token, commentId);
      await refreshComments();

      showToast("Comment deleted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete comment");
    }
  }

  async function refreshInventory(activeToken = token) {
    if (!activeToken) return;

    setLoadingInventory(true);
    setError("");

    try {
      const [items, types] = await Promise.all([
        getItems(activeToken),
        getItemTypes(activeToken),
      ]);

      setInventory(items);
      setItemTypes(types);

      void refreshComments(activeToken, items);
      void refreshCommentNotifications(activeToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory");
    } finally {
      setLoadingInventory(false);
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

  async function handleLogin() {
    setLoggingIn(true);
    setError("");

    try {
      const tokenData = await withTimeout(
        login(loginUsername, loginPassword),
        5000,
      );

      const accessToken = tokenData.access_token;

      const [currentUser, items, types] = await withTimeout(
        Promise.all([
          getCurrentUser(accessToken),
          getItems(accessToken),
          getItemTypes(accessToken),
        ]),
        5000,
      );

      localStorage.setItem("access_token", accessToken);

      setToken(accessToken);
      setUser(currentUser);
      setInventory(items);
      setItemTypes(types);
      setLoginPassword("");

      void refreshComments(accessToken, items);
      void refreshCommentNotifications(accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoggingIn(false);
      setRestoring(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("access_token");

    setToken("");
    setUser(null);
    setInventory([]);
    setItemTypes([]);
    setOrders([]);
    setAuditLogs([]);
    setUsers([]);
    setCommentsByItemId({});
    setCommentNotifications(EMPTY_NOTIFICATIONS);
    setCommentTarget(null);
    setShowCommentOverview(false);
    setEditingItem(null);
    setOrderSeedItem(null);
    setView("inventory");
    setError("");
  }

  function handleViewChange(nextView: View) {
    if (!isAdmin && nextView !== "inventory" && nextView !== "stock-items") {
      setView("inventory");
      return;
    }

    setView(nextView);
    setShowCommentOverview(false);
    setCommentTarget(null);

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

  async function handleCreateItem(payload: Parameters<typeof createItem>[1]) {
    setError("");

    try {
      await createItem(token, payload);
      await refreshInventory();

      showToast("Stock item added");
      setView("stock-items");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    }
  }

  async function handleUpdateItem(payload: Parameters<typeof updateItem>[2]) {
    if (!editingItem) return;

    setError("");

    try {
      await updateItem(token, editingItem.id, payload);
      await refreshInventory();

      showToast("Stock item updated");
      setEditingItem(null);
      setView("stock-items");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update item");
    }
  }

  async function handleSubmitOrder(order: Order) {
    setError("");

    try {
      await createOrderRecord(token, {
        item_type_id: order.itemTypeId ?? null,
        order_date: toApiDate(order.dateOrdered),
        order_placed_by: order.orderPlacedBy || user?.username || null,
        po_number: order.poNumber || null,
        vendor: order.supplier,
        category: order.category || null,
        catalog_no: order.catalogueNum,
        item_name: order.itemName,
        units_ordered: toNumberOrNull(order.unitsOrdered),
        price_per_unit: toNumberOrNull(order.pricePerUnit),
        total_price: toNumberOrNull(order.totalPrice),
        final_price: toNumberOrNull(order.finalPrice || order.totalPrice),
        availability: order.availability || null,
        expected_delivery_date: toApiDate(
          order.expectedDeliveryDate || order.expiryDate,
        ),
        order_number: order.orderNumber || null,
        delivery_date: toApiDate(order.dateDelivered),
        status: order.status || (order.delivered ? "Delivered" : "Ordered"),
        received_by: order.receivedBy || null,
        date_paid: toApiDate(order.datePaid),
        amount_paid: toNumberOrNull(order.amountPaid),
        cc_invoice: order.ccInvoice || null,
      });

      await refreshOrders();
      await refreshInventory();

      showToast("Order added");
      setOrderSeedItem(null);
      setView("orders");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add order");
    }
  }

  async function handleImportOrders(file: File) {
    setError("");

    try {
      await importOrdersExcel(token, file);
      await refreshOrders();
      await refreshInventory();

      showToast("Orders imported");
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
      setError(
        err instanceof Error ? err.message : "Failed to export selected orders",
      );
    }
  }

  async function handleUploadOrderDocument(
    orderId: number,
    documentType: OrderDocumentType,
    file: File,
  ) {
    setError("");

    try {
      await uploadOrderDocument(token, orderId, documentType, file);
      await refreshOrders();
      await refreshInventory();

      showToast(`${documentType} uploaded`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to upload order document",
      );
    }
  }

  async function handleGetOrderDocuments(orderId: number) {
    return getOrderDocuments(token, orderId);
  }

  async function handleDownloadOrderDocument(
    documentId: number,
    filename: string,
  ) {
    await downloadOrderDocument(token, documentId, filename);
  }

  async function handleDeleteOrderDocument(documentId: number) {
    await deleteOrderDocument(token, documentId);
    showToast("Document deleted");
  }

  async function handleMarkOrderDelivered(orderId: number) {
    setError("");

    try {
      await markOrderDelivered(token, orderId, {
        delivery_date: new Date().toISOString().slice(0, 10),
        received_by: user?.username ?? null,
        notes: "Marked delivered from Orders page",
      });

      await refreshOrders();
      await refreshInventory();

      showToast("Order marked delivered and inventory updated");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to mark order delivered",
      );
    }
  }

  async function handleMarkOrderPaid(orderId: number) {
    setError("");

    try {
      await markOrderPaid(token, orderId, {
        date_paid: new Date().toISOString().slice(0, 10),
        amount_paid: null,
        cc_invoice: null,
        notes: "Marked paid from Orders page",
      });

      await refreshOrders();

      showToast("Order marked paid");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark order paid");
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

  async function handleDeleteUser(userId: number) {
    if (!isAdmin) return;

    const confirmed = window.confirm("Delete this user? This cannot be undone.");

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
        <form
          className="login-card"
          onSubmit={(event) => {
            event.preventDefault();
            void handleLogin();
          }}
        >
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
      <Sidebar view={view} isAdmin={isAdmin} onViewChange={handleViewChange} />

      <main className="main">
        <Topbar
          name={user.username}
          email={`${user.role} account`}
          initials={getInitials(user.username)}
          commentCount={totalCommentCount}
          onCommentsClick={() => {
            setCommentTarget(null);
            setShowCommentOverview((current) => !current);
          }}
          onLogout={handleLogout}
        />

        {error && <p className="error-banner">{error}</p>}
        {loadingInventory && (
          <p className="loading-banner">Loading inventory...</p>
        )}
        {loadingComments && (
          <p className="loading-banner">Loading comments...</p>
        )}

        {showCommentOverview && (
          <section className="view active">
            <div className="card">
              <div className="card-head">
                <div>
                  <h2>Unread Comment Center</h2>
                  <p className="sub">
                    {totalCommentCount} unread comments across inventory
                  </p>
                </div>

                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowCommentOverview(false)}
                >
                  Close
                </button>
              </div>

              <div className="toolbar">
                <div>
                  <h3>Item Types</h3>
                  {topCommentItemTypes.length === 0 && (
                    <p className="sub">No unread item type comments.</p>
                  )}

                  {topCommentItemTypes.map(({ itemType, count }) => (
                    <button
                      key={itemType.id}
                      type="button"
                      className="chip"
                      onClick={() => void handleViewItemTypeComments(itemType)}
                    >
                      {itemType.name} 💬 {count}
                    </button>
                  ))}
                </div>

                <div>
                  <h3>Stock Items</h3>
                  {topCommentItems.length === 0 && (
                    <p className="sub">No unread stock item comments.</p>
                  )}

                  {topCommentItems.map(({ item, count }) => (
                    <button
                      key={item.id}
                      type="button"
                      className="chip"
                      onClick={() => void handleViewStockItemComments(item)}
                    >
                      {item.itemName} / {item.catalogueNum} 💬 {count}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {commentTarget && (
          <section className="view active">
            <div className="card">
              <div className="card-head">
                <div>
                  <h2>{commentTarget.title}</h2>
                  <p className="sub">
                    {commentTarget.kind === "item-type"
                      ? "Aggregated comments from linked stock items"
                      : "Comments for this stock item"}
                  </p>
                </div>

                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setCommentTarget(null);
                    setCommentInput("");
                  }}
                >
                  Close
                </button>
              </div>

              <div className="toolbar">
                <div className="search" style={{ flex: 1 }}>
                  <input
                    placeholder={
                      commentTarget.kind === "item-type"
                        ? "Add item type note, attached to first linked stock item"
                        : "Add comment"
                    }
                    value={commentInput}
                    onChange={(event) => setCommentInput(event.target.value)}
                  />
                </div>

                <button
                  type="button"
                  className="btn primary"
                  onClick={() => void handleCreateComment()}
                >
                  Add Comment
                </button>
              </div>

              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Comment</th>
                      <th>By</th>
                      <th>Date</th>
                      {isAdmin && <th />}
                    </tr>
                  </thead>

                  <tbody>
                    {activeCommentRows.map((comment) => (
                      <tr key={comment.id}>
                        <td>
                          <div className="nm">{comment.itemName}</div>
                          <div className="sub">{comment.catalogueNum}</div>
                        </td>
                        <td>{comment.comment}</td>
                        <td>{comment.username}</td>
                        <td>{new Date(comment.createdAt).toLocaleString()}</td>

                        {isAdmin && (
                          <td>
                            <button
                              type="button"
                              className="icon-btn del"
                              onClick={() => void handleDeleteComment(comment.id)}
                            >
                              🗑
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}

                    {activeCommentRows.length === 0 && (
                      <tr>
                        <td colSpan={isAdmin ? 5 : 4} className="empty-row">
                          No comments yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {view === "inventory" && (
          <section className="view active">
            <div className="stats">
              <StatCard
                label="Low Stock Item Types"
                value={stats.low}
                icon="📦"
                tone="warning"
              />

              <StatCard
                label="Critically Low Item Types"
                value={stats.critical}
                icon="⚠"
                tone="critical"
              />

              <StatCard
                label="Out of Stock Item Types"
                value={stats.out}
                icon="⊘"
                tone="muted"
              />

              <StatCard
                label="Expiring Item Types"
                value={stats.expiring}
                icon="⏱"
                tone="danger"
              />
            </div>

            <p className="section-tag">INVENTORY</p>

            <InventoryTable
              items={itemTypes}
              isAdmin={isAdmin}
              commentCountsByItemTypeId={commentCountsByItemTypeId}
              onAddItem={goToAddItem}
              onEditItem={handleEditItemType}
              onDeleteItem={handleDeleteItemType}
              onViewComments={(item) => void handleViewItemTypeComments(item)}
            />
          </section>
        )}

        {view === "stock-items" && (
          <section className="view active">
            <p className="section-tag">STOCK ITEMS</p>

            <StockItemsTable
              items={inventory}
              itemTypes={itemTypes}
              isAdmin={isAdmin}
              commentCountsByItemId={commentCountsByItemId}
              onAddItem={goToAddItem}
              onEditItem={handleEditStockItem}
              onDeleteItem={handleDeleteStockItem}
              onViewComments={(item) => void handleViewStockItemComments(item)}
            />
          </section>
        )}

        {isAdmin && view === "orders" && (
          <OrdersPage
            orders={orders}
            inventoryItems={inventory}
            loading={loadingOrders}
            onRefresh={() => void refreshOrders()}
            onAddOrder={() => goToAddOrder()}
            onAddOrderFromInventory={(item) => goToAddOrder(item)}
            onImportExcel={handleImportOrders}
            onExportAll={handleExportAllOrders}
            onExportSelected={handleExportSelectedOrders}
            onUploadDocument={handleUploadOrderDocument}
            onMarkDelivered={handleMarkOrderDelivered}
            onMarkPaid={handleMarkOrderPaid}
            onGetDocuments={handleGetOrderDocuments}
            onDownloadDocument={handleDownloadOrderDocument}
            onDeleteDocument={handleDeleteOrderDocument}
          />
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

        {isAdmin && view === "audit" && <AuditLogTable logs={auditLogs} />}

        {isAdmin && view === "add-item" && (
          <AddItemForm
            mode="create"
            itemTypes={itemTypes}
            orders={orders}
            onBack={() => setView("stock-items")}
            onSubmitItem={handleCreateItem}
          />
        )}

        {isAdmin && view === "edit-item" && editingItem && (
          <AddItemForm
            mode="edit"
            item={editingItem}
            itemTypes={itemTypes}
            orders={orders}
            onBack={() => {
              setEditingItem(null);
              setView("stock-items");
            }}
            onSubmitItem={handleUpdateItem}
          />
        )}

        {isAdmin && view === "add-order" && (
          <AddOrderForm
            initialItem={orderSeedItem}
            inventoryItems={inventory}
            itemTypes={itemTypes}
            onBack={() => {
              setOrderSeedItem(null);
              setView("orders");
            }}
            onSubmitOrder={handleSubmitOrder}
          />
        )}
      </main>

      <div className={toast ? "toast show" : "toast"}>
        <span>✓</span>
        <span>{toast}</span>
      </div>
    </div>
  );
}