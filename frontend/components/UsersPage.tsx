"use client";

import { FormEvent, useState } from "react";
import type { UserAccount } from "@/types/inventory";

type UsersPageProps = {
  users: UserAccount[];
  loading: boolean;
  currentUserId: number;
  onRefresh: () => void;
  onCreateUser: (payload: {
    username: string;
    password: string;
    role: "user" | "admin";
  }) => Promise<void>;
  onDeleteUser: (userId: number) => Promise<void>;
};

export default function UsersPage({
  users,
  loading,
  currentUserId,
  onRefresh,
  onCreateUser,
  onDeleteUser,
}: UsersPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [creating, setCreating] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setCreating(true);

    try {
      await onCreateUser({
        username,
        password,
        role,
      });

      setUsername("");
      setPassword("");
      setRole("user");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="view active">
      <p className="section-tag">USERS</p>

      <div className="users-layout">
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Users</h2>
              <p className="sub">
                Displaying <b>{users.length} accounts</b>
              </p>
            </div>

            <button
              type="button"
              className="btn secondary"
              onClick={onRefresh}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="strong-text">{user.id}</td>

                    <td>{user.username}</td>

                    <td>
                      <span
                        className={
                          user.role === "admin"
                            ? "role-pill admin"
                            : "role-pill"
                        }
                      >
                        {user.role}
                      </span>
                    </td>

                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="icon-btn del"
                          disabled={user.id === currentUserId}
                          title={
                            user.id === currentUserId
                              ? "You cannot delete your own account"
                              : "Delete user"
                          }
                          onClick={() => void onDeleteUser(user.id)}
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty-row">
                      {loading ? "Loading users..." : "No users found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <form className="form-card user-form-card" onSubmit={handleSubmit}>
          <div className="form-top">
            <h2>Add User</h2>
          </div>

          <div className="field">
            <label>
              Username <span className="req-star">*</span>
            </label>
            <div className="control">
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="newuser"
                required
              />
            </div>
          </div>

          <div className="field">
            <label>
              Password <span className="req-star">*</span>
            </label>
            <div className="control">
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Temporary password"
                required
              />
            </div>
          </div>

          <div className="field">
            <label>
              Role <span className="req-star">*</span>
            </label>
            <div className="control">
              <select
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as "user" | "admin")
                }
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="btn primary full-width"
            disabled={creating}
          >
            {creating ? "Creating..." : "Create User"}
          </button>
        </form>
      </div>
    </section>
  );
}