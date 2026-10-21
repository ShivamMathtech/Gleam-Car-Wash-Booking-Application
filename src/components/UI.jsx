import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Car,
  Check,
  ChevronRight,
  Clock3,
  Heart,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  X,
  Droplets,
  AlertCircle,
  Navigation,
} from "lucide-react";
import { api, useApp, money } from "../lib.jsx";

export function Logo({ small = false }) {
  return (
    <span className={`brand ${small ? "small" : ""}`}>
      <span className="brand-mark">
        <Droplets size={25} />
      </span>
      <span>
        gleam<span className="brand-dot">.</span>
        <small>CAR CARE, SIMPLIFIED</small>
      </span>
    </span>
  );
}
export function Button({
  children,
  variant = "primary",
  busy,
  className = "",
  ...props
}) {
  return (
    <button
      className={`btn ${variant} ${className}`}
      disabled={busy || props.disabled}
      {...props}
    >
      {busy ? <LoaderCircle size={17} className="spin" /> : null}
      {children}
    </button>
  );
}
export function Field({ label, hint, children, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children || <input {...props} />}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Empty({ icon: Icon = Car, title, text, action }) {
  return (
    <div className="empty">
      <span>
        <Icon size={32} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" /> A little polish, one moment…
    </div>
  );
}
export function ErrorState({ message, retry }) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={22} />
      <p>{message}</p>
      {retry && (
        <Button variant="secondary" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
export function Badge({ children, className = "" }) {
  return <span className={`badge ${className}`}>{children}</span>;
}
export function Rating({ rating, count }) {
  return (
    <span className="rating">
      <Star size={13} fill="currentColor" />
      {rating || "New"}
      {count !== undefined && <small>({count})</small>}
    </span>
  );
}
export function Modal({ title, children, onClose, wide = false }) {
  const dialog = useRef(null);
  useEffect(() => {
    const el = dialog.current,
      previous = document.activeElement,
      scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    el.querySelector('input,button,select,textarea,[tabindex="0"]')?.focus();
    const key = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const nodes = [
          ...el.querySelectorAll(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',
          ),
        ].filter((n) => n.offsetParent !== null);
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = scroll;
      previous?.focus?.();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "wide" : ""}`}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button
            aria-label="Close dialog"
            className="icon-btn"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function CarPhoto({
  variant = "wash",
  className = "",
  alt = "A silver car receiving a professional foam wash",
}) {
  return (
    <div className={`car-photo ${variant} ${className}`}>
      <img src="/images/carwash.png" alt={alt} loading="lazy" />
    </div>
  );
}
export function ProviderCard({ provider: p, onFavorite }) {
  const { go, requireAuth, toast } = useApp(),
    [busy, setBusy] = useState(false);
  async function favorite(e) {
    e.stopPropagation();
    if (!requireAuth()) return;
    setBusy(true);
    try {
      await api(`/favorites/${p.id}`, {
        method: p.favorite ? "DELETE" : "PUT",
      });
      onFavorite?.();
      toast(
        p.favorite ? "Removed from saved centres" : "Saved for your next wash",
      );
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="provider-card">
      <div className="provider-photo">
        <button
          className="photo-link"
          onClick={() => go(`/centres/${p.id}`)}
          aria-label={`View ${p.name}`}
        >
          <CarPhoto variant={p.image} />
        </button>
        <Badge className="photo-badge">
          <Star size={12} fill="currentColor" />
          {p.rating || "New"} <span>· {p.reviewCount} reviews</span>
        </Badge>
        <button
          className={`favorite-btn ${p.favorite ? "selected" : ""}`}
          disabled={busy}
          aria-label={`${p.favorite ? "Unsave" : "Save"} ${p.name}`}
          onClick={favorite}
        >
          <Heart size={17} fill={p.favorite ? "currentColor" : "none"} />
        </button>
        <span className={`open-badge ${p.isOpen ? "" : "closed"}`}>
          <i />
          {p.isOpen ? "Open now" : "Closed now"}
        </span>
      </div>
      <div className="provider-copy">
        <div className="provider-title">
          <button
            className="text-button"
            onClick={() => go(`/centres/${p.id}`)}
          >
            <h3>{p.name}</h3>
          </button>
          <ArrowUpRight size={18} />
        </div>
        <p>
          <MapPin size={13} />
          {p.area} <span>·</span> {p.distance} km
        </p>
        <div className="feature-pills">
          {p.features.slice(0, 2).map((f) => (
            <span key={f}>{f}</span>
          ))}
        </div>
        <div className="provider-bottom">
          <span>
            From{" "}
            <strong>{p.fromPrice === null ? "—" : money(p.fromPrice)}</strong>
          </span>
          <button className="text-link" onClick={() => go(`/centres/${p.id}`)}>
            View centre <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}
export function VehicleForm({ vehicle, onSaved, onClose }) {
  const { toast } = useApp(),
    [form, setForm] = useState(
      vehicle || { name: "", plate: "", kind: "hatchback", color: "White" },
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api(`/vehicles${vehicle ? `/${vehicle.id}` : ""}`, {
        method: vehicle ? "PUT" : "POST",
        body: form,
      });
      toast(vehicle ? "Vehicle updated" : "Your ride is ready");
      onSaved(r.vehicle);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={vehicle ? "Edit your vehicle" : "Add your vehicle"}
      onClose={onClose}
    >
      <form onSubmit={submit} className="form-stack">
        <p className="muted">
          A few details help the centre prepare for your visit.
        </p>
        <Field
          label="Make & model"
          name="name"
          placeholder="e.g. Hyundai i20"
          value={form.name}
          onChange={change}
          required
          minLength={2}
          maxLength={80}
        />
        <Field
          label="Registration number"
          name="plate"
          placeholder="UK07 AB 1234"
          value={form.plate}
          onChange={change}
          required
          minLength={4}
          maxLength={20}
        />
        <div className="form-row">
          <Field label="Vehicle type">
            <select name="kind" value={form.kind} onChange={change}>
              <option value="hatchback">Hatchback</option>
              <option value="sedan">Sedan</option>
              <option value="suv">SUV (+₹150 / visit)</option>
              <option value="muv">MUV (+₹200 / visit)</option>
            </select>
          </Field>
          <Field
            label="Colour"
            name="color"
            value={form.color}
            onChange={change}
            required
            minLength={2}
            maxLength={30}
          />
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button busy={busy} type="submit">
          {vehicle ? "Save changes" : "Add to my garage"}
          <ArrowRight size={16} />
        </Button>
      </form>
    </Modal>
  );
}
export function AreaMap({ providers, selected, onSelect, location }) {
  const pts = providers.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng }));
  if (location) pts.push(location);
  const lats = pts.map((p) => p.lat),
    lngs = pts.map((p) => p.lng),
    minLat = Math.min(...lats, 30.32) - 0.008,
    maxLat = Math.max(...lats, 30.35) + 0.008,
    minLng = Math.min(...lngs, 78.01) - 0.008,
    maxLng = Math.max(...lngs, 78.08) + 0.008;
  const place = (p) => ({
    left: `${10 + ((p.lng - minLng) / (maxLng - minLng)) * 80}%`,
    top: `${90 - ((p.lat - minLat) / (maxLat - minLat)) * 80}%`,
  });
  return (
    <div className="area-map">
      <div className="map-land park-a" />
      <div className="map-land park-b" />
      <div className="map-road road-a" />
      <div className="map-road road-b" />
      <div className="map-road road-c" />
      <div className="map-river" />
      <span className="map-label l1">RAJPUR ROAD</span>
      <span className="map-label l2">DEHRADUN</span>
      <span className="map-label l3">DALANWALA</span>
      {providers.map((p) => (
        <button
          key={p.id}
          aria-label={`Select ${p.name}`}
          className={`map-pin ${selected === p.id ? "selected" : ""}`}
          style={place(p)}
          onClick={() => onSelect(p.id)}
        >
          <Car size={18} />
          <span>{p.name}</span>
        </button>
      ))}
      {location && (
        <span
          className="you-pin"
          style={place(location)}
          title="Your selected location"
        >
          <i />
        </span>
      )}
      <span className="map-caption">
        <MapPin size={12} />
        Area overview · illustrative, not a road map
      </span>
    </div>
  );
}
