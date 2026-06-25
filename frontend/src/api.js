const API_BASE_URL = "http://127.0.0.1:8000";

async function getErrorMessage(response) {
  const data = await response.json().catch(() => null);

  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (Array.isArray(data?.detail)) {
    return data.detail
      .map((error) => error.msg)
      .join(", ");
  }

  return `Request failed with status ${response.status}`;
}

async function apiRequest(path, options = {}) {
  const {
    token,
    headers = {},
    ...fetchOptions
  } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers: {
      ...headers,
      ...(token
        ? { Authorization: `Bearer ${token}` }
        : {}),
    },
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();

  return text ? JSON.parse(text) : null;
}

export function login(username, password) {
  const body = new URLSearchParams({
    username,
    password,
  });

  return apiRequest("/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
}

export function getCurrentUser(token) {
  return apiRequest("/me", { token });
}

export function getItems(token, filters = {}) {
  const query = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== "" && value !== null && value !== undefined) {
      query.set(key, value);
    }
  });

  const suffix = query.toString()
    ? `?${query.toString()}`
    : "";

  return apiRequest(`/items/${suffix}`, { token });
}

export function createItem(token, item) {
  return apiRequest("/items/", {
    token,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(item),
  });
}

export function updateItem(token, itemId, item) {
  return apiRequest(`/items/${itemId}`, {
    token,
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(item),
  });
}

export function deleteItem(token, itemId) {
  return apiRequest(`/items/${itemId}`, {
    token,
    method: "DELETE",
  });
}

export function useItem(token, itemId, amount) {
  const query = new URLSearchParams({
    amount: String(amount),
  });

  return apiRequest(
    `/items/${itemId}/use?${query.toString()}`,
    {
      token,
      method: "POST",
    },
  );
}

export function restockItem(token, itemId, amount) {
  const query = new URLSearchParams({
    amount: String(amount),
  });

  return apiRequest(
    `/items/${itemId}/restock?${query.toString()}`,
    {
      token,
      method: "POST",
    },
  );
}

export function getAuditLogs(token) {
  return apiRequest("/audit-logs/", { token });
}
