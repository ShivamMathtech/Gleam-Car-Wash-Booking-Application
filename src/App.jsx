import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Car,
  Check,
  ChevronDown,
  Compass,
  Heart,
  House,
  LayoutDashboard,
  LogOut,
  MapPin,
  Navigation,
  Settings2,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { AppContext, api, setCsrf, useApp } from "./lib.jsx";
import {
  Logo,
  Button,
  Modal,
  Field,
  Loading,
  ErrorState,
  Empty,
} from "./components/UI.jsx";
import Auth from "./components/Auth.jsx";
import Home from "./pages/Home.jsx";
import Centre from "./pages/Centre.jsx";
import Booking from "./pages/Booking.jsx";
import { Bookings, Garage, Profile } from "./pages/Account.jsx";
import Admin from "./pages/Admin.jsx";

const defaultLocation = {
  label: "Rajpur Road, Dehradun",
  lat: 30.3398,
  lng: 78.0563,
};
class Boundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="crash">
        <h1>A small detour.</h1>
        <p>Please reload to get back to your next fresh start.</p>
        <Button onClick={() => window.location.reload()}>Reload Gleam</Button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <Boundary>
      <Application />
    </Boundary>
  );
}
function Application() {
  const [route, setRoute] = useState(window.location.hash.slice(1) || "/"),
    [session, setSession] = useState(null),
    [initError, setInitError] = useState(""),
    [auth, setAuth] = useState(false),
    [locationOpen, setLocationOpen] = useState(false),
    [notificationsOpen, setNotificationsOpen] = useState(false),
    [notifications, setNotifications] = useState([]),
    [toasts, setToasts] = useState([]),
    [version, setVersion] = useState(0);
  const [location, setLocation] = useState(() => {
    try {
      const p = JSON.parse(localStorage.getItem("gleam-location"));
      return p &&
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lng) &&
        Math.abs(p.lat) <= 90 &&
        Math.abs(p.lng) <= 180 &&
        typeof p.label === "string"
        ? p
        : defaultLocation;
    } catch {
      return defaultLocation;
    }
  });
  const pending = useRef("");
  const user = session?.user;
  const refresh = () => setVersion((x) => x + 1);
  const go = (path) => {
    window.location.hash = path;
  };
  function toast(message, type = "success") {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, message, type }]);
    window.setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      4500,
    );
  }
  function acceptSession(value) {
    setCsrf(value.csrfToken);
    setSession((old) => ({ ...old, ...value }));
    if (value.user) {
      const p = {
        label: value.user.location,
        lat: value.user.lat,
        lng: value.user.lng,
      };
      setLocation(p);
      localStorage.setItem("gleam-location", JSON.stringify(p));
    }
    refresh();
    if (pending.current) {
      go(pending.current);
      pending.current = "";
    }
  }
  async function loadSession() {
    setInitError("");
    try {
      const r = await api("/session");
      setCsrf(r.csrfToken);
      setSession(r);
      if (r.user)
        setLocation({
          label: r.user.location,
          lat: r.user.lat,
          lng: r.user.lng,
        });
    } catch (e) {
      setInitError(e.message);
    }
  }
  useEffect(() => {
    loadSession();
    const change = () => {
      setRoute(window.location.hash.slice(1) || "/");
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    let active = true;
    const load = () =>
      api("/notifications")
        .then((r) => {
          if (active) setNotifications(r.notifications);
        })
        .catch(() => {});
    load();
    const timer = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [user?.id, version]);
  function requireAuth(path) {
    if (user) return true;
    pending.current = path || "";
    setAuth(true);
    return false;
  }
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      setCsrf("");
      setSession((s) => ({ ...s, user: null, csrfToken: "" }));
      go("/");
      toast("You’re signed out. See you soon.");
    } catch (e) {
      toast(e.message, "error");
    }
  }
  async function updateLocation(p) {
    if (user) {
      const r = await api("/profile", {
        method: "PUT",
        body: {
          ...user,
          name: user.name,
          email: user.email,
          location: p.label,
          lat: p.lat,
          lng: p.lng,
          notificationsEnabled: user.notificationsEnabled,
        },
      });
      setSession((s) => ({ ...s, user: r.user }));
    }
    setLocation(p);
    localStorage.setItem("gleam-location", JSON.stringify(p));
    refresh();
    setLocationOpen(false);
    toast("Location updated");
  }
  const nav = [
    ["/", House, "Discover"],
    ["/nearby", Compass, "Nearby centres"],
    ["/bookings", CalendarDays, "My bookings"],
    ["/saved", Heart, "Saved centres"],
    ["/garage", Car, "My garage"],
  ];
  const navLink = ([path, Icon, label]) => (
    <a href={`#${path}`} key={path} className={route === path ? "active" : ""}>
      <Icon size={19} />
      <span>{label}</span>
      {route === path && <i />}
    </a>
  );
  if (initError)
    return (
      <div className="startup">
        <Logo />
        <ErrorState message={initError} retry={loadSession} />
      </div>
    );
  if (!session)
    return (
      <div className="startup">
        <Logo />
        <Loading />
      </div>
    );
  const page =
    route === "/" ? (
      <Home />
    ) : route === "/nearby" ? (
      <Home directory />
    ) : route === "/saved" ? (
      <Home saved />
    ) : route.startsWith("/centres/") ? (
      <Centre id={route.split("/")[2]} />
    ) : route.startsWith("/book/") ? (
      <Protected>
        <Booking id={route.split("/")[2]} />
      </Protected>
    ) : route === "/bookings" ? (
      <Protected>
        <Bookings />
      </Protected>
    ) : route === "/garage" ? (
      <Protected>
        <Garage />
      </Protected>
    ) : route === "/profile" ? (
      <Protected>
        <Profile />
      </Protected>
    ) : route === "/admin" ? (
      <Protected>
        <Admin />
      </Protected>
    ) : (
      <Empty
        title="This road leads somewhere else"
        text="Let’s head back to discover your next wash."
        action={<Button onClick={() => go("/")}>Back home</Button>}
      />
    );
  const unread = notifications.filter((n) => !n.is_read).length;
  return (
    <AppContext.Provider
      value={{
        session,
        user,
        acceptSession,
        toast,
        go,
        requireAuth,
        location,
        setLocationOpen,
        updateLocation,
        refresh,
        version,
        logout,
      }}
    >
      <div className="app-shell">
        <aside className="sidebar">
          <a href="#/" aria-label="Gleam home" className="logo-link">
            <Logo />
          </a>
          <div className="nav-label">YOUR EVERYDAY SHINE</div>
          <nav aria-label="Main navigation">{nav.map(navLink)}</nav>
          <div className="sidebar-bottom">
            <div className="care-note">
              <span>
                <Sparkles size={22} />
              </span>
              <h3>
                Good care.
                <br />
                Great journeys.
              </h3>
              <p>
                Make a little room for
                <br />
                your car’s happy place.
              </p>
              <a href="#/nearby">
                Find your next wash <ArrowRight size={14} />
              </a>
            </div>
            <nav aria-label="Account navigation">
              {user?.role === "admin" &&
                navLink(["/admin", LayoutDashboard, "Manage centres"])}
              {navLink(["/profile", Settings2, "My account"])}
              {user && (
                <button onClick={logout}>
                  <LogOut size={18} />
                  Sign out
                </button>
              )}
            </nav>
            <span className="sidebar-footer">Made for the road ahead.</span>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <a className="mobile-logo" href="#/">
              <Logo small />
            </a>
            <button
              className="location-button"
              onClick={() => setLocationOpen(true)}
            >
              <span className="location-icon">
                <MapPin size={19} />
              </span>
              <span>
                <small>YOUR LOCATION</small>
                <strong>{location.label}</strong>
              </span>
              <ChevronDown size={14} />
            </button>
            <div className="header-actions">
              {session.demoMode && <span className="demo-tag">Local demo</span>}
              <button
                className="icon-btn notification-button"
                aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
                onClick={() => {
                  if (requireAuth()) setNotificationsOpen(true);
                }}
              >
                <Bell size={20} />
                {user?.notificationsEnabled && unread > 0 && <i />}
              </button>
              {user ? (
                <button
                  className="profile-button"
                  onClick={() => go("/profile")}
                >
                  <span className="avatar">
                    {user.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    {user.name.split(" ")[0]}
                    <small>
                      {user.role === "admin"
                        ? "Administrator"
                        : "Car enthusiast"}
                    </small>
                  </span>
                  <ChevronDown size={14} />
                </button>
              ) : (
                <Button variant="secondary" onClick={() => setAuth(true)}>
                  Sign in
                  <ArrowRight size={15} />
                </Button>
              )}
            </div>
          </header>
          <main id="main-content" className="main-content">
            {page}
          </main>
          <footer className="page-footer">
            <span>
              gleam. <span>A little care goes a long way.</span>
            </span>
            <span>
              {session.demoMode
                ? "Sample centres · Dehradun"
                : "Car care, simplified"}{" "}
              <i>•</i> Prices in INR
            </span>
          </footer>
        </div>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {[nav[0], nav[1], nav[2], ["/profile", UserRound, "Account"]].map(
            navLink,
          )}
        </nav>
      </div>
      {auth && <Auth onClose={() => setAuth(false)} />}
      {locationOpen && (
        <LocationModal
          location={location}
          onSave={updateLocation}
          onClose={() => setLocationOpen(false)}
        />
      )}
      {notificationsOpen && (
        <Modal title="Your updates" onClose={() => setNotificationsOpen(false)}>
          <div className="notification-header">
            <span className="muted">All your car care, in one place.</span>
            <button
              className="text-link"
              onClick={async () => {
                try {
                  await api("/notifications/read", { method: "POST" });
                  refresh();
                } catch (e) {
                  toast(e.message, "error");
                }
              }}
            >
              Mark all read
            </button>
          </div>
          {notifications.length ? (
            notifications.map((n) => (
              <button
                key={n.id}
                className={`notification-item ${n.is_read ? "" : "unread"}`}
                onClick={() => {
                  if (n.booking_id) {
                    go("/bookings");
                    setNotificationsOpen(false);
                  }
                }}
              >
                <span>
                  <Bell size={18} />
                </span>
                <div>
                  <strong>{n.title}</strong>
                  <p>{n.body}</p>
                  <small>
                    {new Date(n.created_at).toLocaleDateString("en-IN")}
                  </small>
                </div>
                {!n.is_read && <i />}
              </button>
            ))
          ) : (
            <Empty
              icon={Bell}
              title="All quiet for now"
              text="Booking updates will appear here."
            />
          )}
        </Modal>
      )}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span>
              {t.type === "error" ? <X size={17} /> : <Check size={17} />}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}
function Protected({ children }) {
  const { user, requireAuth } = useApp();
  return user ? (
    children
  ) : (
    <Empty
      icon={UserRound}
      title="Your car care starts here"
      text="Sign in to book a wash, save your favourite centres and manage your vehicles."
      action={
        <Button onClick={() => requireAuth()}>
          Sign in to continue
          <ArrowRight size={16} />
        </Button>
      }
    />
  );
}
function LocationModal({ location, onSave, onClose }) {
  const [form, setForm] = useState(location),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const presets = [
    ["Rajpur Road, Dehradun", 30.3398, 78.0563],
    ["Dalanwala, Dehradun", 30.3256, 78.0549],
    ["Ballupur, Dehradun", 30.3354, 78.0121],
    ["Sahastradhara Road, Dehradun", 30.3481, 78.0761],
  ];
  function locate() {
    setError("");
    if (!navigator.geolocation) {
      setError(
        "Location is unavailable in this browser. Choose an area below.",
      );
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setForm({
          label: "My current location",
          lat: p.coords.latitude,
          lng: p.coords.longitude,
        });
        setBusy(false);
      },
      () => {
        setError(
          "We couldn’t access your location. Allow location access or select an area below.",
        );
        setBusy(false);
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave({ ...form, lat: Number(form.lat), lng: Number(form.lng) });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Find your local shine" onClose={onClose}>
      <p className="muted">
        Choose an area or use your location to sort centres by distance.
      </p>
      <Button variant="secondary" className="full" onClick={locate} busy={busy}>
        <Navigation size={17} />
        Use my current location
      </Button>
      <div className="location-presets">
        {presets.map(([label, lat, lng]) => (
          <button
            key={label}
            onClick={() => setForm({ label, lat, lng })}
            className={form.label === label ? "selected" : ""}
          >
            <MapPin size={16} />
            {label}
            {form.label === label && <Check size={16} />}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="form-stack">
        <Field
          label="Location label"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          minLength={2}
          maxLength={150}
          required
        />
        <details>
          <summary>Use exact coordinates</summary>
          <div className="form-row">
            <Field
              label="Latitude"
              type="number"
              min={-90}
              max={90}
              step="any"
              value={form.lat}
              onChange={(e) => setForm({ ...form, lat: e.target.value })}
              required
            />
            <Field
              label="Longitude"
              type="number"
              min={-180}
              max={180}
              step="any"
              value={form.lng}
              onChange={(e) => setForm({ ...form, lng: e.target.value })}
              required
            />
          </div>
        </details>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button busy={busy} type="submit">
          Use this location
          <ArrowRight size={16} />
        </Button>
      </form>
    </Modal>
  );
}
