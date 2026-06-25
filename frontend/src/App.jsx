import { useState } from "react";
import { getCurrentUser, login } from "./api";
import "./App.css";

function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const tokenData = await login(username, password);
      const token = tokenData.access_token;

      localStorage.setItem("access_token", token);

      const currentUser = await getCurrentUser(token);
      setUser(currentUser);
    } catch (err) {
      setError(err.message);
      localStorage.removeItem("access_token");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("access_token");
    setUser(null);
    setUsername("");
    setPassword("");
  }

  if (user) {
    return (
      <main className="page">
        <section className="card">
          <h1>Lab Inventory</h1>
          <p>
            Logged in as <strong>{user.username}</strong>
          </p>

          {user.role && <p>Role: {user.role}</p>}

          <button onClick={handleLogout}>Log out</button>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <form className="card" onSubmit={handleSubmit}>
        <h1>Lab Inventory</h1>
        <p>Sign in to continue</p>

        <label>
          Username
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}

export default App;
