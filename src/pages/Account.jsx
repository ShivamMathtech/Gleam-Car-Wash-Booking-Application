import { useState } from "react";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Car,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  Edit3,
  Heart,
  LockKeyhole,
  LogOut,
  MapPin,
  Navigation,
  Plus,
  Printer,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import {
  api,
  useApp,
  useLoad,
  money,
  formatDate,
  formatTime,
  statusLabel,
  directions,
} from "../lib.jsx";
import {
  Button,
  PageHeading,
  Loading,
  ErrorState,
  Empty,
  Modal,
  Field,
  VehicleForm,
  CarPhoto,
  Badge,
  Logo,
} from "../components/UI.jsx";

export function Bookings() {
  const { go, toast, refresh } = useApp(),
    { data, loading, error, reload } = useLoad("/bookings"),
    [tab, setTab] = useState("active"),
    [cancel, setCancel] = useState(null),
    [review, setReview] = useState(null),
    [receipt, setReceipt] = useState(null),
    [busy, setBusy] = useState(false);
  const all = data?.bookings || [],
    bookings = all.filter(
      (b) =>
        tab === "all" ||
        (tab === "active"
          ? !["completed", "cancelled"].includes(b.status)
          : ["completed", "cancelled"].includes(b.status)),
    );
  async function doCancel() {
    setBusy(true);
    try {
      await api(`/bookings/${cancel.id}/cancel`, { method: "POST" });
      setCancel(null);
      reload();
      refresh();
      toast("Booking cancelled");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }
  function calendar(b) {
    const esc = (s) =>
        s
          .replaceAll("\\", "\\\\")
          .replaceAll("\n", "\\n")
          .replaceAll(",", "\\,")
          .replaceAll(";", "\\;"),
      stamp = (t) =>
        new Date(t)
          .toISOString()
          .replace(/[-:]/g, "")
          .replace(/\.\d{3}Z/, "Z");
    const content = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Gleam//Car Care//EN",
      "BEGIN:VEVENT",
      `UID:${b.id}@gleam.local`,
      `DTSTAMP:${stamp(Date.now())}`,
      `DTSTART:${stamp(b.start_at)}`,
      `DTEND:${stamp(b.end_at)}`,
      `SUMMARY:${esc(`Car wash at ${b.provider_name}`)}`,
      `LOCATION:${esc(b.provider_address)}`,
      `DESCRIPTION:${esc(`Booking ${b.code}. ${b.services.map((s) => s.name).join(", ")}. Pay ${money(b.total)} at the centre.`)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(
        new Blob([content], { type: "text/calendar;charset=utf-8" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = `Gleam-${b.code}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Calendar file downloaded");
  }
  return (
    <div>
      <PageHeading
        eyebrow="ALL YOUR CAR CARE, IN ONE PLACE"
        title="Your moments of shine."
        description="Upcoming visits, fresh finishes and everything in between."
        action={
          <Button onClick={() => go("/nearby")}>
            Book a wash
            <Plus size={16} />
          </Button>
        }
      />
      <div className="tabs booking-tabs">
        {[
          ["active", "Active visits"],
          ["history", "Past visits"],
          ["all", "All bookings"],
        ].map(([v, t]) => (
          <button
            key={v}
            className={v === tab ? "active" : ""}
            onClick={() => setTab(v)}
          >
            {t}
            {v === "all" && <span>{all.length}</span>}
          </button>
        ))}
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={reload} />
      ) : !bookings.length ? (
        <Empty
          icon={CalendarDays}
          title="A little shine belongs here"
          text={
            tab === "history"
              ? "Your completed and cancelled visits will appear here."
              : "Your next fresh start is just a few taps away."
          }
          action={
            <Button onClick={() => go("/nearby")}>
              Find a wash centre
              <ArrowRight size={16} />
            </Button>
          }
        />
      ) : (
        <div className="bookings-list">
          {bookings.map((b) => (
            <article className="booking-card" key={b.id}>
              <div className="booking-card-top">
                <span>
                  {b.code}
                  <small>
                    Booked {new Date(b.created_at).toLocaleDateString("en-IN")}
                  </small>
                </span>
                <Badge className={`status-${b.status}`}>
                  {statusLabel(b.status)}
                </Badge>
              </div>
              <div className="booking-card-body">
                <CarPhoto variant={b.provider_image} />
                <div className="booking-card-info">
                  <h3>{b.provider_name}</h3>
                  <p>
                    <MapPin size={13} />
                    {b.provider_area}
                  </p>
                  <div className="booking-service-names">
                    {b.services.map((s) => s.name).join(" + ")}
                  </div>
                  <div className="booking-facts">
                    <span>
                      <CalendarDays size={15} />
                      {formatDate(b.date)}
                    </span>
                    <span>
                      <Clock3 size={15} />
                      {formatTime(b.time)} IST
                    </span>
                    <span>
                      <Car size={15} />
                      {b.vehicle.name} · {b.vehicle.plate}
                    </span>
                  </div>
                </div>
                <div className="booking-price">
                  <strong>{money(b.total)}</strong>
                  <small>
                    {b.payment_status === "paid"
                      ? "Payment recorded"
                      : b.status === "cancelled"
                        ? "Cancelled · no payment"
                        : "Pay at centre"}
                  </small>
                </div>
              </div>
              {!["completed", "cancelled"].includes(b.status) && (
                <div className="status-track">
                  {[
                    ["confirmed", "Booked"],
                    ["checked_in", "Checked in"],
                    ["in_progress", "In progress"],
                    ["completed", "Ready to shine"],
                  ].map(([s, t], i) => (
                    <span
                      key={s}
                      className={
                        [
                          "confirmed",
                          "checked_in",
                          "in_progress",
                          "completed",
                        ].indexOf(b.status) >= i
                          ? "done"
                          : ""
                      }
                    >
                      <i>
                        {[
                          "confirmed",
                          "checked_in",
                          "in_progress",
                          "completed",
                        ].indexOf(b.status) >= i ? (
                          <Check size={11} />
                        ) : (
                          i + 1
                        )}
                      </i>
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="booking-card-actions">
                <div>
                  {b.status === "confirmed" && b.start_at > Date.now() && (
                    <button
                      className="text-link danger"
                      onClick={() => setCancel(b)}
                    >
                      Cancel booking
                    </button>
                  )}
                  {b.status === "completed" &&
                    (b.review ? (
                      <span className="reviewed">
                        <Star size={14} fill="currentColor" />
                        {b.review.rating}/5 · Thank you for your review
                      </span>
                    ) : (
                      <button
                        className="text-link"
                        onClick={() => setReview(b)}
                      >
                        <Star size={15} />
                        Leave a review
                      </button>
                    ))}
                </div>
                <div>
                  <button className="text-link" onClick={() => setReceipt(b)}>
                    <Printer size={15} />
                    Receipt
                  </button>
                  {!["completed", "cancelled"].includes(b.status) && (
                    <button className="text-link" onClick={() => calendar(b)}>
                      <CalendarDays size={15} />
                      Calendar
                    </button>
                  )}
                  {["completed", "cancelled"].includes(b.status) ? (
                    <Button
                      variant="secondary"
                      onClick={() => go(`/book/${b.provider_id}`)}
                    >
                      Book again
                      <ArrowRight size={14} />
                    </Button>
                  ) : (
                    <a
                      className="btn secondary"
                      href={directions(b)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Navigation size={14} />
                      Directions
                    </a>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {cancel && (
        <Modal title="Cancel this fresh start?" onClose={() => setCancel(null)}>
          <p>
            Your visit to <strong>{cancel.provider_name}</strong> on{" "}
            {formatDate(cancel.date)} at {formatTime(cancel.time)} will be
            cancelled. No online payment was taken.
          </p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setCancel(null)}>
              Keep my booking
            </Button>
            <Button busy={busy} onClick={doCancel}>
              Cancel booking
            </Button>
          </div>
        </Modal>
      )}
      {review && (
        <ReviewModal
          booking={review}
          onClose={() => setReview(null)}
          onSaved={() => {
            setReview(null);
            reload();
            refresh();
          }}
        />
      )}
      {receipt && (
        <Receipt booking={receipt} onClose={() => setReceipt(null)} />
      )}
    </div>
  );
}
function ReviewModal({ booking, onClose, onSaved }) {
  const { toast } = useApp(),
    [rating, setRating] = useState(5),
    [comment, setComment] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/bookings/${booking.id}/review`, {
        method: "POST",
        body: { rating, comment },
      });
      toast("Thanks for sharing your shine!");
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="How was your fresh start?" onClose={onClose}>
      <form onSubmit={submit} className="form-stack">
        <div className="review-centre">
          <CarPhoto variant={booking.provider_image} />
          <h3>{booking.provider_name}</h3>
          <p>{formatDate(booking.date)}</p>
        </div>
        <div className="star-picker" role="group" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              type="button"
              key={i}
              aria-label={`Rate ${i} stars`}
              aria-pressed={rating === i}
              onClick={() => setRating(i)}
            >
              <Star size={31} fill={i <= rating ? "currentColor" : "none"} />
            </button>
          ))}
        </div>
        <Field label="Tell us about your visit">
          <textarea
            value={comment}
            minLength={10}
            maxLength={1000}
            required
            rows={4}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What made your visit a good one?"
          />
        </Field>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button busy={busy} type="submit">
          Share my review
          <ArrowRight size={15} />
        </Button>
      </form>
    </Modal>
  );
}
function Receipt({ booking: b, onClose }) {
  return (
    <Modal title="Booking receipt" onClose={onClose}>
      <div className="receipt">
        <Logo />
        <div className="receipt-title">
          <h2>
            {b.payment_status === "paid"
              ? "Payment receipt"
              : "Booking summary"}
          </h2>
          <p>{b.code}</p>
          <Badge className={`status-${b.status}`}>
            {statusLabel(b.status)}
          </Badge>
        </div>
        <h3>{b.provider_name}</h3>
        <p>{b.provider_address}</p>
        <div className="receipt-facts">
          <span>
            {formatDate(b.date)} · {formatTime(b.time)} IST
          </span>
          <span>
            {b.vehicle.name} · {b.vehicle.plate}
          </span>
        </div>
        <div className="receipt-lines">
          {b.services.map((s) => (
            <div key={s.id}>
              <span>{s.name}</span>
              <strong>{money(s.price)}</strong>
            </div>
          ))}
          {b.subtotal > b.services.reduce((a, s) => a + s.price, 0) && (
            <div>
              <span>Vehicle size surcharge</span>
              <strong>
                {money(
                  b.subtotal - b.services.reduce((a, s) => a + s.price, 0),
                )}
              </strong>
            </div>
          )}
          {b.discount > 0 && (
            <div>
              <span>Discount ({b.coupon})</span>
              <strong>−{money(b.discount)}</strong>
            </div>
          )}
          <div className="receipt-total">
            <strong>Total</strong>
            <strong>{money(b.total)}</strong>
          </div>
        </div>
        <p>
          <strong>
            {b.payment_status === "paid"
              ? "Payment recorded by the centre"
              : b.status === "cancelled"
                ? "Cancelled. No online payment taken."
                : "Unpaid. Pay at the centre."}
          </strong>
        </p>
        <small>
          Booking record only. This is not a GST tax invoice. Ask the centre for
          its tax invoice.
        </small>
      </div>
      <Button className="full print-button" onClick={() => window.print()}>
        <Printer size={16} />
        Print / save as PDF
      </Button>
    </Modal>
  );
}

export function Garage() {
  const { toast } = useApp(),
    { data, loading, error, reload } = useLoad("/vehicles"),
    [editing, setEditing] = useState(null),
    [adding, setAdding] = useState(false),
    [removing, setRemoving] = useState(null),
    [busy, setBusy] = useState(false);
  async function remove() {
    setBusy(true);
    try {
      await api(`/vehicles/${removing.id}`, { method: "DELETE" });
      setRemoving(null);
      reload();
      toast("Vehicle removed");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <PageHeading
        eyebrow="YOUR RIDE, REMEMBERED"
        title="A happy little garage."
        description="Save your favourite rides. Make your next booking effortless."
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} />
            Add a vehicle
          </Button>
        }
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={reload} />
      ) : !data.vehicles.length ? (
        <Empty
          icon={Car}
          title="Let’s meet your ride"
          text="Add your car once and keep the details ready for every visit."
          action={
            <Button onClick={() => setAdding(true)}>
              <Plus size={16} />
              Add my first vehicle
            </Button>
          }
        />
      ) : (
        <div className="garage-grid">
          {data.vehicles.map((v) => (
            <article className="garage-card" key={v.id}>
              <div className="garage-car-art">
                <span />
                <Car size={100} strokeWidth={0.8} />
                <Sparkles size={27} />
              </div>
              <Badge>{v.kind.toUpperCase()}</Badge>
              <h2>{v.name}</h2>
              <p>{v.color}</p>
              <span className="license-plate">
                <small>IND</small>
                {v.plate}
              </span>
              <div className="garage-card-actions">
                <button className="text-link" onClick={() => setEditing(v)}>
                  <Edit3 size={15} />
                  Edit details
                </button>
                <button
                  aria-label={`Remove ${v.name}`}
                  className="icon-btn"
                  onClick={() => setRemoving(v)}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          ))}
          <button className="add-vehicle-card" onClick={() => setAdding(true)}>
            <span>
              <Plus size={29} />
            </span>
            <h3>Room for another ride</h3>
            <p>Add a vehicle to your garage</p>
          </button>
        </div>
      )}
      <div className="notice">
        <ShieldCheck size={19} />
        <p>
          Existing bookings keep a copy of your vehicle details, even if you
          edit or remove a vehicle.
        </p>
      </div>
      {(adding || editing) && (
        <VehicleForm
          vehicle={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={() => {
            setAdding(false);
            setEditing(null);
            reload();
          }}
        />
      )}
      {removing && (
        <Modal title="Remove this vehicle?" onClose={() => setRemoving(null)}>
          <p>
            <strong>{removing.name}</strong> will be removed from your garage.
            Your existing bookings will keep their original details.
          </p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              Keep vehicle
            </Button>
            <Button busy={busy} onClick={remove}>
              Remove vehicle
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
export function Profile() {
  const { user, acceptSession, session, toast, setLocationOpen, logout, go } =
      useApp(),
    [form, setForm] = useState({
      name: user.name,
      email: user.email,
      notificationsEnabled: user.notificationsEnabled,
    }),
    [password, setPassword] = useState({
      currentPassword: "",
      newPassword: "",
    }),
    [busy, setBusy] = useState(false),
    [pwBusy, setPwBusy] = useState(false),
    [error, setError] = useState(""),
    [pwError, setPwError] = useState("");
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api("/profile", {
        method: "PUT",
        body: { ...user, ...form },
      });
      acceptSession({ ...r, csrfToken: session.csrfToken });
      toast("Your profile is all polished up");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function changePassword(e) {
    e.preventDefault();
    setPwBusy(true);
    setPwError("");
    try {
      await api("/auth/password", { method: "PUT", body: password });
      setPassword({ currentPassword: "", newPassword: "" });
      toast("Password updated. Other sessions have been signed out.");
    } catch (e) {
      setPwError(e.message);
    } finally {
      setPwBusy(false);
    }
  }
  return (
    <div>
      <PageHeading
        eyebrow="A LITTLE ABOUT YOU"
        title="Make yourself at home."
        description="Your details, your preferences, your next fresh start."
      />
      <div className="profile-layout">
        <aside className="profile-summary">
          <span className="profile-avatar">{user.name[0].toUpperCase()}</span>
          <h2>{user.name}</h2>
          <p>{user.email || user.phone}</p>
          <Badge>
            {user.role === "admin" ? "Administrator" : "Car enthusiast"}
          </Badge>
          <div className="profile-shortcuts">
            <button onClick={() => go("/bookings")}>
              <CalendarDays size={17} />
              My bookings
              <ArrowRight size={15} />
            </button>
            <button onClick={() => go("/garage")}>
              <Car size={17} />
              My garage
              <ArrowRight size={15} />
            </button>
            <button onClick={() => go("/saved")}>
              <Heart size={17} />
              Saved centres
              <ArrowRight size={15} />
            </button>
            {user.role === "admin" && (
              <button onClick={() => go("/admin")}>
                <ShieldCheck size={17} />
                Admin dashboard
                <ArrowRight size={15} />
              </button>
            )}
            <button onClick={logout}>
              <LogOut size={17} />
              Sign out
            </button>
          </div>
        </aside>
        <div>
          <form className="settings-panel form-stack" onSubmit={save}>
            <div>
              <h3>The essentials</h3>
              <p className="muted">Keep your profile fresh.</p>
            </div>
            <div className="form-row">
              <Field
                label="Full name"
                value={form.name}
                minLength={2}
                maxLength={80}
                required
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Field
                label="Email address"
                type="email"
                value={form.email}
                required={!user.phone}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            {user.phone && (
              <Field
                label="Verified mobile number"
                value={user.phone}
                disabled
                hint="This number is used for mobile sign-in."
              />
            )}
            <div className="location-setting">
              <MapPin size={21} />
              <span>
                <small>YOUR LOCATION</small>
                <strong>{user.location}</strong>
              </span>
              <button
                type="button"
                className="text-link"
                onClick={() => setLocationOpen(true)}
              >
                Change
              </button>
            </div>
            <label className="toggle-label">
              <span>
                <strong>A little heads-up</strong>
                <small>
                  Show unread notification badges. Booking updates remain
                  available in your inbox.
                </small>
              </span>
              <input
                type="checkbox"
                checked={form.notificationsEnabled}
                onChange={(e) =>
                  setForm({ ...form, notificationsEnabled: e.target.checked })
                }
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" busy={busy}>
              Save my details
              <Check size={16} />
            </Button>
          </form>
          <form className="settings-panel form-stack" onSubmit={changePassword}>
            <div className="section-heading">
              <div>
                <h3>Keep your account yours.</h3>
                <p>Update your password. Use at least 10 characters.</p>
              </div>
              <LockKeyhole size={24} />
            </div>
            <Field
              label="Current password"
              type="password"
              autoComplete="current-password"
              value={password.currentPassword}
              maxLength={128}
              onChange={(e) =>
                setPassword({ ...password, currentPassword: e.target.value })
              }
              hint="Leave blank only if your account was created with OTP and has no password yet."
            />
            <Field
              label="New password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              maxLength={128}
              required
              value={password.newPassword}
              onChange={(e) =>
                setPassword({ ...password, newPassword: e.target.value })
              }
            />
            {pwError && (
              <p className="form-error" role="alert">
                {pwError}
              </p>
            )}
            <Button variant="secondary" busy={pwBusy} type="submit">
              Update password
              <ArrowRight size={16} />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
