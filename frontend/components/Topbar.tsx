type TopbarProps = {
  name: string;
  email: string;
  initials: string;
  onLogout: () => void;
  commentCount?: number;
  onCommentsClick?: () => void;
};

export default function Topbar({
  name,
  email,
  initials,
  onLogout,
  commentCount = 0,
  onCommentsClick,
}: TopbarProps) {
  return (
    <div className="topbar">
      <div>
        <h1>Welcome back, {name}</h1>
        <p>Manage all key aspects of your inventory system here.</p>
      </div>

      <div className="topbar-user">
        <button
          type="button"
          className="bell-btn"
          title="Comments"
          onClick={onCommentsClick}
        >
          {commentCount > 0 && (
            <span className="notification-badge">{commentCount}</span>
          )}
        </button>

        <div className="avatar">{initials}</div>

        <div>
          <div className="user-name">{name}</div>
          <div className="user-email">{email}</div>
        </div>

        <button
          type="button"
          className="logout-btn"
          title="Log out"
          onClick={onLogout}
        >
          ↪
        </button>
      </div>
    </div>
  );
}