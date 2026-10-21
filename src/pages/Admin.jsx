import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Car,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Download,
  Edit3,
  LayoutDashboard,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
} from "lucide-react";
import {
  api,
  useApp,
  useLoad,
  money,
  formatDate,
  formatTime,
  statusLabel,
} from "../lib.jsx";
import {
  Button,
  PageHeading,
  Loading,
  ErrorState,
  Empty,
  Modal,
  Field,
  Badge,
} from "../components/UI.jsx";
const nextStatuses = {
  confirmed: ["checked_in", "cancelled"],
  checked_in: ["in_progress", "cancelled"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
};
export default function Admin() {
  const { user, toast, refresh } = useApp(),
    { data, loading, error, reload } = useLoad("/admin/dashboard"),
    [tab, setTab] = useState("bookings"),
    [filter, setFilter] = useState(""),
    [query, setQuery] = useState(""),
    [edit, setEdit] = useState(null),
    [action, setAction] = useState(null),
    [busy, setBusy] = useState(false);
  if (user.role !== "admin")
    return (
      <Empty
        icon={ShieldCheck}
        title="This space is for the centre team"
        text="Use the customer area to manage your own bookings."
      />
    );
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} retry={reload} />;
  const { stats, bookings, providers } = data,
    visible = bookings.filter(
      (b) =>
        (!filter || b.status === filter) &&
        `${b.code} ${b.customer.name} ${b.customer.email} ${b.provider_name}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
  async function update() {
    setBusy(true);
    try {
      await api(`/admin/bookings/${action.booking.id}`, {
        method: "PATCH",
        body: action.body,
      });
      setAction(null);
      reload();
      refresh();
      toast("Booking updated");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }
  function exportCSV() {
    const cols = [
      "Booking",
      "Customer",
      "Email",
      "Centre",
      "Date",
      "Time IST",
      "Vehicle",
      "Status",
      "Amount INR",
      "Payment",
    ];
    const cell = (v) =>
      `"${String(v ?? "")
        .replace(/^[=+@-]/, "'")
        .replaceAll('"', '""')}"`;
    const csv = [
      cols,
      ...visible.map((b) => [
        b.code,
        b.customer.name,
        b.customer.email,
        b.provider_name,
        b.date,
        b.time,
        b.vehicle.plate,
        b.status,
        b.total,
        b.payment_status,
      ]),
    ]
      .map((r) => r.map(cell).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
        new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = "Gleam-bookings.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="admin-page">
      <PageHeading
        eyebrow="BEHIND EVERY GREAT FINISH"
        title="A little care, well managed."
        description="Your centres, appointments and everyday operations."
        action={
          <Button variant="secondary" onClick={reload}>
            Refresh dashboard
          </Button>
        }
      />
      <div className="admin-stats">
        {[
          [CalendarDays, stats.bookings || 0, "Total bookings"],
          [Clock3, stats.today || 0, "Visits today · IST"],
          [Car, stats.active || 0, "Active bookings"],
          [
            CircleDollarSign,
            money(stats.revenue),
            "Collected on completed visits",
          ],
        ].map(([Icon, value, label]) => (
          <div className="stat-card" key={label}>
            <span>
              <Icon size={21} />
            </span>
            <strong>{value}</strong>
            <small>{label}</small>
          </div>
        ))}
      </div>
      <div className="tabs admin-tabs">
        <button
          className={tab === "bookings" ? "active" : ""}
          onClick={() => setTab("bookings")}
        >
          <CalendarDays size={16} />
          Bookings
        </button>
        <button
          className={tab === "catalog" ? "active" : ""}
          onClick={() => setTab("catalog")}
        >
          <Store size={16} />
          Centres & services
        </button>
      </div>
      {tab === "bookings" ? (
        <section className="admin-section">
          <div className="admin-toolbar">
            <label className="search-field">
              <Search size={18} />
              <input
                aria-label="Search admin bookings"
                placeholder="Search booking, customer or centre…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <select
              aria-label="Filter booking status"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              {Object.keys(nextStatuses).map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={exportCSV}>
              <Download size={16} />
              Export CSV
            </Button>
          </div>
          {visible.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Booking / customer</th>
                    <th>Visit</th>
                    <th>Vehicle & service</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Next step</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <strong>{b.code}</strong>
                        <span>{b.customer.name}</span>
                        <small>{b.customer.email || b.customer.phone}</small>
                      </td>
                      <td>
                        <strong>{b.provider_name}</strong>
                        <span>{formatDate(b.date)}</span>
                        <small>{formatTime(b.time)} IST</small>
                      </td>
                      <td>
                        <strong>{b.vehicle.name}</strong>
                        <span>{b.vehicle.plate}</span>
                        <small>
                          {b.services.map((s) => s.name).join(" + ")}
                        </small>
                        {b.notes && (
                          <small className="booking-note">
                            Note: {b.notes}
                          </small>
                        )}
                      </td>
                      <td>
                        <Badge className={`status-${b.status}`}>
                          {statusLabel(b.status)}
                        </Badge>
                      </td>
                      <td>
                        <strong>{money(b.total)}</strong>
                        <span
                          className={
                            b.payment_status === "paid" ? "paid-text" : "muted"
                          }
                        >
                          {b.payment_status === "paid" ? "Recorded" : "Unpaid"}
                        </span>
                      </td>
                      <td>
                        <div className="admin-row-actions">
                          {nextStatuses[b.status].map((s) => (
                            <button
                              className={
                                s === "cancelled"
                                  ? "text-link danger"
                                  : "btn secondary compact"
                              }
                              key={s}
                              onClick={() =>
                                setAction({
                                  booking: b,
                                  body: { status: s },
                                  label: `Mark as ${statusLabel(s).toLowerCase()}`,
                                })
                              }
                            >
                              {statusLabel(s)}
                              {s !== "cancelled" && <ChevronRight size={13} />}
                            </button>
                          ))}
                          {["in_progress", "completed"].includes(b.status) &&
                            b.payment_status === "unpaid" && (
                              <button
                                className="text-link"
                                onClick={() =>
                                  setAction({
                                    booking: b,
                                    body: { paymentStatus: "paid" },
                                    label: "Record payment",
                                  })
                                }
                              >
                                Record payment
                              </button>
                            )}
                          {!nextStatuses[b.status].length &&
                            b.payment_status === "paid" && (
                              <span className="paid-text">
                                <Check size={15} />
                                All done
                              </span>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              icon={CalendarDays}
              title="A clean slate"
              text="Customer appointments will appear here. Try booking a visit from the customer account."
            />
          )}
          <p className="small muted table-note">
            Showing up to the latest 1,000 bookings. Payment is a manual record
            of money collected at the centre.
          </p>
        </section>
      ) : (
        <section>
          <div className="section-heading">
            <div>
              <h2>Your centres</h2>
              <p>
                {providers.length} centres · {data.customers} customer accounts
              </p>
            </div>
            <Button onClick={() => setEdit({ type: "provider" })}>
              <Plus size={16} />
              Add centre
            </Button>
          </div>
          <div className="catalog-grid">
            {providers.map((p) => (
              <article className="catalog-centre" key={p.id}>
                <div className="catalog-centre-head">
                  <span className="catalog-icon">
                    <Store size={24} />
                  </span>
                  <div>
                    <h3>{p.name}</h3>
                    <p>
                      {p.area} · {p.capacity} wash bays
                    </p>
                  </div>
                  <Badge className={p.active ? "green" : ""}>
                    {p.active ? "Active" : "Hidden"}
                  </Badge>
                  <button
                    className="icon-btn"
                    aria-label={`Edit ${p.name}`}
                    onClick={() => setEdit({ type: "provider", item: p })}
                  >
                    <Edit3 size={17} />
                  </button>
                </div>
                <div className="catalog-services">
                  {p.services.map((s) => (
                    <div key={s.id}>
                      <span>
                        <strong>{s.name}</strong>
                        <small>
                          {s.duration} min · {s.category}{" "}
                          {!s.active && "· Hidden"}
                        </small>
                      </span>
                      <strong>{money(s.price)}</strong>
                      <button
                        className="icon-btn"
                        aria-label={`Edit ${s.name} at ${p.name}`}
                        onClick={() =>
                          setEdit({ type: "service", item: s, provider: p })
                        }
                      >
                        <Edit3 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  className="text-link"
                  onClick={() => setEdit({ type: "service", provider: p })}
                >
                  <Plus size={15} />
                  Add a service
                </button>
              </article>
            ))}
          </div>
          {!providers.length && (
            <Empty
              icon={Store}
              title="Your first centre starts here"
              text="Add a centre, then add its services to open bookings."
            />
          )}
        </section>
      )}
      {action && (
        <Modal title={action.label} onClose={() => setAction(null)}>
          <p>
            Update <strong>{action.booking.code}</strong> for{" "}
            {action.booking.customer.name}?
          </p>
          {action.body.paymentStatus && (
            <p className="notice">
              Confirm that {money(action.booking.total)} has actually been
              collected at the centre. This records payment; it does not charge
              the customer.
            </p>
          )}
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setAction(null)}>
              Go back
            </Button>
            <Button onClick={update} busy={busy}>
              {action.label}
            </Button>
          </div>
        </Modal>
      )}
      {edit && (
        <CatalogForm
          config={edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            reload();
            refresh();
          }}
        />
      )}
    </div>
  );
}
function CatalogForm({ config, onClose, onSaved }) {
  const { toast } = useApp(),
    provider = config.type === "provider",
    item = config.item;
  const [form, setForm] = useState(
    provider
      ? {
          name: "",
          area: "",
          address: "",
          lat: 30.3398,
          lng: 78.0563,
          description: "",
          phone: "",
          opens: 9,
          closes: 19,
          capacity: 2,
          image: "wash",
          features: ["Hand wash", "Parking"],
          active: true,
          ...item,
        }
      : {
          providerId: config.provider.id,
          name: "",
          description: "",
          category: "Exterior",
          price: 499,
          duration: 30,
          features: [],
          active: true,
          ...item,
        },
  );
  const [featureText, setFeatureText] = useState(
      (form.features || []).join(", "),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const change = (e) =>
    setForm({
      ...form,
      [e.target.name]:
        e.target.type === "checkbox"
          ? e.target.checked
          : e.target.type === "number"
            ? Number(e.target.value)
            : e.target.value,
    });
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        `/admin/${provider ? "providers" : "services"}${item ? `/${item.id}` : ""}`,
        {
          method: item ? "PUT" : "POST",
          body: {
            ...form,
            active: !!form.active,
            features: featureText
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
          },
        },
      );
      toast(`${provider ? "Centre" : "Service"} saved`);
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`${item ? "Edit" : "Add"} ${provider ? "centre" : "service"}`}
      onClose={onClose}
      wide
    >
      <form className="form-stack" onSubmit={submit}>
        <Field
          label={provider ? "Centre name" : "Service name"}
          name="name"
          required
          minLength={2}
          maxLength={100}
          value={form.name}
          onChange={change}
        />
        {provider && (
          <>
            <div className="form-row">
              <Field
                label="Area"
                name="area"
                required
                minLength={2}
                maxLength={80}
                value={form.area}
                onChange={change}
              />
              <Field
                label="Contact phone"
                name="phone"
                required
                minLength={6}
                maxLength={20}
                value={form.phone}
                onChange={change}
              />
            </div>
            <Field
              label="Full address"
              name="address"
              required
              minLength={5}
              maxLength={200}
              value={form.address}
              onChange={change}
            />
            <div className="form-row">
              <Field
                label="Latitude"
                type="number"
                min={-90}
                max={90}
                step="any"
                name="lat"
                required
                value={form.lat}
                onChange={change}
              />
              <Field
                label="Longitude"
                type="number"
                min={-180}
                max={180}
                step="any"
                name="lng"
                required
                value={form.lng}
                onChange={change}
              />
            </div>
            <div className="form-row three">
              <Field
                label="Opens (24h, IST)"
                type="number"
                min={0}
                max={22}
                name="opens"
                required
                value={form.opens}
                onChange={change}
              />
              <Field
                label="Closes (24h, IST)"
                type="number"
                min={1}
                max={23}
                name="closes"
                required
                value={form.closes}
                onChange={change}
              />
              <Field
                label="Wash bays"
                type="number"
                min={1}
                max={20}
                name="capacity"
                required
                value={form.capacity}
                onChange={change}
              />
            </div>
            <Field label="Studio image style">
              <select name="image" value={form.image} onChange={change}>
                <option value="wash">Signature wash</option>
                <option value="studio">Studio</option>
                <option value="foam">Foam</option>
                <option value="detail">Detailing</option>
              </select>
            </Field>
          </>
        )}
        {!provider && (
          <>
            <Field label="Category">
              <select name="category" value={form.category} onChange={change}>
                {["Exterior", "Interior", "Detailing", "Protection"].map(
                  (c) => (
                    <option key={c}>{c}</option>
                  ),
                )}
              </select>
            </Field>
            <div className="form-row">
              <Field
                label="Price (INR)"
                type="number"
                min={1}
                max={100000}
                name="price"
                required
                value={form.price}
                onChange={change}
              />
              <Field
                label="Duration (minutes)"
                type="number"
                min={15}
                max={600}
                name="duration"
                required
                value={form.duration}
                onChange={change}
              />
            </div>
          </>
        )}
        <Field label="Description">
          <textarea
            name="description"
            rows={3}
            required
            minLength={provider ? 10 : 3}
            maxLength={provider ? 1500 : 500}
            value={form.description}
            onChange={change}
          />
        </Field>
        <Field
          label={
            provider
              ? "Amenities (comma separated)"
              : "Included treatments (comma separated)"
          }
          value={featureText}
          onChange={(e) => setFeatureText(e.target.value)}
          hint="Up to 8 items."
        />
        <label className="check-label">
          <input
            type="checkbox"
            name="active"
            checked={!!form.active}
            onChange={change}
          />
          Visible to customers
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" busy={busy}>
          Save {provider ? "centre" : "service"}
          <Check size={16} />
        </Button>
      </form>
    </Modal>
  );
}
