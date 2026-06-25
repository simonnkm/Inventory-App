import { useEffect, useMemo, useState } from "react";
import {
  createItem,
  deleteItem,
  getAuditLogs,
  getCurrentUser,
  getItems,
  login,
  restockItem,
  updateItem,
  useItem,
} from "./api";
import ItemModal from "./ItemModal";
import "./App.css";

const EMPTY_FILTERS = {
  name: "",
  storage_id: "",
  expiring_before: "",
  low_stock: "",
};

function itemStatus(item) {
  if (item.quantity <= 0) {
    return {
      text: "Out of stock",
      className: "status out",
    };
  }

  if (
    item.quantity <=
    (item.critical_threshold ?? 1)
  ) {
    return {
      text: "Critical",
      className: "status critical",
    };
  }

  if (
    item.quantity <=
    (item.reorder_threshold ?? 5)
  ) {
    return {
      text: "Low stock",
      className: "status low",
    };
  }

  return {
    text: "In stock",
    className: "status available",
  };
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  return new Date(`${value}T00:00:00`)
    .toLocaleDateString();
}

function formatTimestamp(value) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}

function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem("access_token") || "",
  );
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [filters, setFilters] =
    useState(EMPTY_FILTERS);
  const [amounts, setAmounts] = useState({});

  const [activeView, setActiveView] =
    useState("inventory");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] =
    useState(null);

  const [restoring, setRestoring] =
    useState(Boolean(token));
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] =
    useState(false);
  const [loadingAudit, setLoadingAudit] =
    useState(false);
  const [savingItem, setSavingItem] =
    useState(false);
  const [busyItemId, setBusyItemId] =
    useState(null);
  const [error, setError] = useState("");

  const isAdmin = user?.role?.toLowerCase() === "admin";

  const summary = useMemo(() => {
    return items.reduce(
      (result, item) => {
        result.total += 1;

        const status = itemStatus(item).text;

        if (status === "Low stock") {
          result.low += 1;
        } else if (status === "Critical") {
          result.critical += 1;
        } else if (status === "Out of stock") {
          result.out += 1;
        }

        return result;
      },
      {
        total: 0,
        low: 0,
        critical: 0,
        out: 0,
      },
    );
  }, [items]);

  useEffect(() => {
    if (!token) {
      setRestoring(false);
      return;
    }

    let cancelled = false;

    async function restoreSession() {
      setRestoring(true);
      setError("");

      try {
        const [currentUser, inventory] =
          await Promise.all([
            getCurrentUser(token),
            getItems(token),
          ]);

        if (cancelled) {
          return;
        }

        setUser(currentUser);
        setItems(inventory);
      } catch (err) {
        if (!cancelled) {
          localStorage.removeItem("access_token");
          setToken("");
          setUser(null);
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setRestoring(false);
        }
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (
      activeView !== "audit" ||
      !isAdmin ||
      !token
    ) {
      return;
    }

    loadAuditLogs();
  }, [activeView, isAdmin, token]);

  async function refreshItems(
    selectedFilters = filters,
  ) {
    setLoadingItems(true);
    setError("");

    try {
      const inventory = await getItems(
        token,
        selectedFilters,
      );
      setItems(inventory);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingItems(false);
    }
  }

  async function loadAuditLogs() {
    setLoadingAudit(true);
    setError("");

    try {
      const logs = await getAuditLogs(token);
      setAuditLogs(logs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAudit(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const tokenData = await login(
        username,
        password,
      );

      localStorage.setItem(
        "access_token",
        tokenData.access_token,
      );

      setToken(tokenData.access_token);
      setPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("access_token");

    setToken("");
    setUser(null);
    setItems([]);
    setAuditLogs([]);
    setUsername("");
    setPassword("");
    setFilters(EMPTY_FILTERS);
    setActiveView("inventory");
    setError("");
  }

  function updateFilter(event) {
    const { name, value } = event.target;

    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleFilterSubmit(event) {
    event.preventDefault();
    await refreshItems();
  }

  async function clearFilters() {
    setFilters(EMPTY_FILTERS);
    await refreshItems(EMPTY_FILTERS);
  }

  async function handleUse(item) {
    const amount = Number(amounts[item.id] || 1);

    if (!Number.isInteger(amount) || amount < 1) {
      setError("Use amount must be a positive whole number.");
      return;
    }

    setBusyItemId(item.id);
    setError("");

    try {
      await useItem(token, item.id, amount);

      setAmounts((current) => ({
        ...current,
        [item.id]: 1,
      }));

      await refreshItems();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyItemId(null);
    }
  }

  async function handleRestock(item) {
    const input = window.prompt(
      `How many units of ${item.item_name} should be added?`,
      "1",
    );

    if (input === null) {
      return;
    }

    const amount = Number(input);

    if (!Number.isInteger(amount) || amount < 1) {
      setError(
        "Restock amount must be a positive whole number.",
      );
      return;
    }

    setBusyItemId(item.id);
    setError("");

    try {
      await restockItem(token, item.id, amount);
      await refreshItems();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyItemId(null);
    }
  }

  async function handleDelete(item) {
    const confirmed = window.confirm(
      `Delete ${item.item_name}? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setBusyItemId(item.id);
    setError("");

    try {
      await deleteItem(token, item.id);
      await refreshItems();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyItemId(null);
    }
  }

  async function handleSaveItem(payload) {
    setSavingItem(true);
    setError("");

    try {
      if (editingItem) {
        await updateItem(
          token,
          editingItem.id,
          payload,
        );
      } else {
        await createItem(token, payload);
      }

      setModalOpen(false);
      setEditingItem(null);
      await refreshItems();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingItem(false);
    }
  }

  function openNewItemModal() {
    setEditingItem(null);
    setModalOpen(true);
  }

  function openEditModal(item) {
    setEditingItem(item);
    setModalOpen(true);
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
          onSubmit={handleLogin}
        >
          <div className="brand-mark">1C</div>

          <h1>Lab Inventory</h1>
          <p className="muted">
            Sign in to manage laboratory supplies.
          </p>

          <label>
            Username
            <input
              value={username}
              onChange={(event) =>
                setUsername(event.target.value)
              }
              autoComplete="username"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              autoComplete="current-password"
              required
            />
          </label>

          {error && (
            <p className="error-message">{error}</p>
          )}

          <button
            className="primary-button"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Lab Inventory</h1>
          <p>
            Signed in as{" "}
            <strong>{user.username}</strong>
            <span className="role">{user.role}</span>
          </p>
        </div>

        <div className="header-actions">
          <nav className="nav-tabs">
            <button
              className={
                activeView === "inventory"
                  ? "nav-tab active"
                  : "nav-tab"
              }
              onClick={() =>
                setActiveView("inventory")
              }
            >
              Inventory
            </button>

            {isAdmin && (
              <button
                className={
                  activeView === "audit"
                    ? "nav-tab active"
                    : "nav-tab"
                }
                onClick={() =>
                  setActiveView("audit")
                }
              >
                Audit log
              </button>
            )}
          </nav>

          <button
            className="secondary-button"
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      </header>

      <main className="content">
        {error && (
          <p className="error-message page-error">
            {error}
          </p>
        )}

        {activeView === "inventory" ? (
          <>
            <section className="summary-grid">
              <article className="summary-card">
                <span>Total shown</span>
                <strong>{summary.total}</strong>
              </article>

              <article className="summary-card">
                <span>Low stock</span>
                <strong>{summary.low}</strong>
              </article>

              <article className="summary-card">
                <span>Critical</span>
                <strong>{summary.critical}</strong>
              </article>

              <article className="summary-card">
                <span>Out of stock</span>
                <strong>{summary.out}</strong>
              </article>
            </section>

            <section className="toolbar inventory-toolbar">
              <form
                className="filter-form"
                onSubmit={handleFilterSubmit}
              >
                <input
                  name="name"
                  type="search"
                  placeholder="Item name"
                  value={filters.name}
                  onChange={updateFilter}
                />

                <input
                  name="storage_id"
                  placeholder="Storage location"
                  value={filters.storage_id}
                  onChange={updateFilter}
                />

                <input
                  name="expiring_before"
                  type="date"
                  value={filters.expiring_before}
                  onChange={updateFilter}
                  title="Expiring before"
                />

                <input
                  name="low_stock"
                  type="number"
                  min="0"
                  placeholder="Quantity at most"
                  value={filters.low_stock}
                  onChange={updateFilter}
                />

                <button
                  className="primary-button"
                  disabled={loadingItems}
                >
                  Filter
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={clearFilters}
                >
                  Clear
                </button>
              </form>

              {isAdmin && (
                <button
                  className="primary-button"
                  onClick={openNewItemModal}
                >
                  Add item
                </button>
              )}
            </section>

            <section className="table-card">
              {loadingItems ? (
                <p className="empty-message">
                  Loading inventory...
                </p>
              ) : items.length === 0 ? (
                <p className="empty-message">
                  No inventory items found.
                </p>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Catalogue #</th>
                        <th>Lot #</th>
                        <th>Location</th>
                        <th>Quantity</th>
                        <th>Expiry</th>
                        <th>Status</th>
                        <th>Use</th>
                        {isAdmin && <th>Admin</th>}
                      </tr>
                    </thead>

                    <tbody>
                      {items.map((item) => {
                        const status =
                          itemStatus(item);
                        const busy =
                          busyItemId === item.id;

                        return (
                          <tr key={item.id}>
                            <td>
                              <strong>
                                {item.item_name}
                              </strong>
                              <span className="cell-detail">
                                {item.brand}
                              </span>
                            </td>

                            <td>
                              {item.catalogue_num}
                            </td>

                            <td>
                              {item.lot_num ?? "—"}
                            </td>

                            <td>{item.storage_id}</td>
                            <td>{item.quantity}</td>

                            <td>
                              {formatDate(
                                item.expiry_date,
                              )}
                            </td>

                            <td>
                              <span
                                className={
                                  status.className
                                }
                              >
                                {status.text}
                              </span>
                            </td>

                            <td>
                              <div className="use-controls">
                                <input
                                  type="number"
                                  min="1"
                                  max={item.quantity}
                                  value={
                                    amounts[item.id] ||
                                    1
                                  }
                                  disabled={
                                    busy ||
                                    item.quantity <= 0
                                  }
                                  onChange={(event) =>
                                    setAmounts(
                                      (current) => ({
                                        ...current,
                                        [item.id]:
                                          event.target
                                            .value,
                                      }),
                                    )
                                  }
                                />

                                <button
                                  className="use-button"
                                  disabled={
                                    busy ||
                                    item.quantity <= 0
                                  }
                                  onClick={() =>
                                    handleUse(item)
                                  }
                                >
                                  Use
                                </button>
                              </div>
                            </td>

                            {isAdmin && (
                              <td>
                                <div className="admin-actions">
                                  <button
                                    className="small-button"
                                    disabled={busy}
                                    onClick={() =>
                                      handleRestock(item)
                                    }
                                  >
                                    Restock
                                  </button>

                                  <button
                                    className="small-button"
                                    disabled={busy}
                                    onClick={() =>
                                      openEditModal(item)
                                    }
                                  >
                                    Edit
                                  </button>

                                  <button
                                    className="small-button danger-button"
                                    disabled={busy}
                                    onClick={() =>
                                      handleDelete(item)
                                    }
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="table-card">
            <div className="section-heading">
              <div>
                <h2>Audit log</h2>
                <p>
                  Inventory actions recorded by the
                  backend.
                </p>
              </div>

              <button
                className="secondary-button"
                onClick={loadAuditLogs}
                disabled={loadingAudit}
              >
                Refresh
              </button>
            </div>

            {loadingAudit ? (
              <p className="empty-message">
                Loading audit log...
              </p>
            ) : auditLogs.length === 0 ? (
              <p className="empty-message">
                No audit entries found.
              </p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>User</th>
                      <th>Action</th>
                      <th>Item ID</th>
                      <th>Details</th>
                    </tr>
                  </thead>

                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td>
                          {formatTimestamp(
                            log.timestamp,
                          )}
                        </td>
                        <td>{log.username}</td>
                        <td>
                          <code>{log.action}</code>
                        </td>
                        <td>{log.item_id ?? "—"}</td>
                        <td>{log.details ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>

      <ItemModal
        open={modalOpen}
        item={editingItem}
        loading={savingItem}
        onClose={() => {
          if (!savingItem) {
            setModalOpen(false);
            setEditingItem(null);
          }
        }}
        onSubmit={handleSaveItem}
      />
    </div>
  );
}

export default App;
