import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Car,
  Check,
  CheckCircle2,
  Clock3,
  MapPin,
  Navigation,
  Plus,
  ShieldCheck,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import {
  api,
  useApp,
  useLoad,
  money,
  today,
  days,
  formatDate,
  formatTime,
  directions,
} from "../lib.jsx";
import {
  Button,
  PageHeading,
  Loading,
  ErrorState,
  VehicleForm,
  CarPhoto,
  Badge,
  Field,
  Empty,
} from "../components/UI.jsx";

export default function Booking({ id }) {
  const { user, go, toast, refresh } = useApp(),
    providerLoad = useLoad(`/providers/${id}`),
    vehicleLoad = useLoad("/vehicles");
  const [step, setStep] = useState(0),
    [services, setServices] = useState([]),
    [vehicle, setVehicle] = useState(""),
    [date, setDate] = useState(today()),
    [time, setTime] = useState(""),
    [couponInput, setCouponInput] = useState(""),
    [coupon, setCoupon] = useState(""),
    [notes, setNotes] = useState(""),
    [quote, setQuote] = useState(null),
    [quoteError, setQuoteError] = useState(""),
    [quoteLoading, setQuoteLoading] = useState(false),
    [adding, setAdding] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [complete, setComplete] = useState(null);
  const requestKey = useRef(null);
  useEffect(() => {
    if (providerLoad.data) {
      const all = providerLoad.data.services,
        preferred = sessionStorage.getItem(`gleam-service-${id}`);
      setServices(
        all.length
          ? [all.find((s) => s.id === preferred)?.id || all[0].id]
          : [],
      );
    }
  }, [providerLoad.data, id]);
  useEffect(() => {
    if (vehicleLoad.data?.vehicles.length && !vehicle)
      setVehicle(vehicleLoad.data.vehicles[0].id);
  }, [vehicleLoad.data, vehicle]);
  const selected = (providerLoad.data?.services || []).filter((s) =>
      services.includes(s.id),
    ),
    duration = selected.reduce((a, s) => a + s.duration, 0);
  const slotsLoad = useLoad(
    `/providers/${id}/slots?date=${date}&duration=${duration || 30}`,
  );
  useEffect(() => {
    setTime("");
    requestKey.current = null;
  }, [date, duration, vehicle, coupon, services.join(",")]);
  useEffect(() => {
    requestKey.current = null;
  }, [time, notes]);
  useEffect(() => {
    setQuote(null);
    setQuoteError("");
    setQuoteLoading(false);
    if (!services.length || !vehicle) return;
    const controller = new AbortController();
    setQuoteLoading(true);
    api("/bookings/quote", {
      method: "POST",
      body: {
        providerId: id,
        serviceIds: services,
        vehicleId: vehicle,
        coupon,
      },
      signal: controller.signal,
    })
      .then((r) => {
        setQuote(r);
        setQuoteLoading(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setQuoteError(e.message);
          setQuoteLoading(false);
        }
      });
    return () => controller.abort();
  }, [services.join(","), vehicle, coupon, id]);
  function toggle(s) {
    setServices((current) =>
      current.includes(s) ? current.filter((x) => x !== s) : [...current, s],
    );
    setError("");
  }
  async function confirm() {
    setBusy(true);
    setError("");
    if (!requestKey.current)
      requestKey.current =
        crypto.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(36).slice(2)}-gleam`;
    try {
      const r = await api("/bookings", {
        method: "POST",
        body: {
          providerId: id,
          serviceIds: services,
          vehicleId: vehicle,
          date,
          time,
          coupon,
          notes,
          requestKey: requestKey.current,
        },
      });
      setComplete(r.booking);
      refresh();
      sessionStorage.removeItem(`gleam-service-${id}`);
      toast("Your next fresh start is booked!");
    } catch (e) {
      setError(e.message);
      if (e.status === 409) {
        setTime("");
        setStep(1);
        slotsLoad.reload();
      }
      if (e.status && e.status < 500) requestKey.current = null;
    } finally {
      setBusy(false);
    }
  }
  if (providerLoad.loading || vehicleLoad.loading) return <Loading />;
  if (providerLoad.error || vehicleLoad.error)
    return (
      <ErrorState
        message={providerLoad.error || vehicleLoad.error}
        retry={() => {
          providerLoad.reload();
          vehicleLoad.reload();
        }}
      />
    );
  const { provider: p, services: all } = providerLoad.data,
    vehicles = vehicleLoad.data.vehicles,
    chosenVehicle = vehicles.find((v) => v.id === vehicle);
  if (complete)
    return (
      <div className="booking-success">
        <span className="success-symbol">
          <CheckCircle2 size={58} strokeWidth={1.4} />
        </span>
        <span className="eyebrow">A FRESH START IS ON THE CALENDAR</span>
        <h1>You’re all booked in!</h1>
        <p>
          {user.name.split(" ")[0]}, your car’s happy place is ready for you.
        </p>
        <div className="success-ticket">
          <div>
            <span className="muted">YOUR BOOKING</span>
            <strong>{complete.code}</strong>
            <Badge className="green">Confirmed</Badge>
          </div>
          <h3>{p.name}</h3>
          <p>
            <MapPin size={15} />
            {p.address}
          </p>
          <div className="ticket-grid">
            <span>
              <CalendarDays size={19} />
              <strong>{formatDate(complete.date)}</strong>
            </span>
            <span>
              <Clock3 size={19} />
              <strong>{formatTime(complete.time)} IST</strong>
            </span>
            <span>
              <Car size={19} />
              <strong>{complete.vehicle.name}</strong>
            </span>
            <span>
              <Tag size={19} />
              <strong>{money(complete.total)} · Pay at centre</strong>
            </span>
          </div>
          <div className="ticket-services">
            {complete.services.map((s) => s.name).join(" + ")}
            <small>{complete.duration} minutes of good care</small>
          </div>
        </div>
        <div className="success-actions">
          <Button onClick={() => go("/bookings")}>
            View my bookings
            <ArrowRight size={16} />
          </Button>
          <a
            className="btn secondary"
            href={directions(p)}
            target="_blank"
            rel="noreferrer"
          >
            <Navigation size={16} />
            Get directions
          </a>
        </div>
        <p className="small muted">
          Show your booking code at the centre. No online payment has been
          taken.
        </p>
      </div>
    );
  return (
    <div className="booking-page">
      <button className="back-link" onClick={() => go(`/centres/${id}`)}>
        <ArrowLeft size={16} />
        Back to {p.name}
      </button>
      <PageHeading
        eyebrow="MAKE TIME FOR A LITTLE CARE"
        title="Your next fresh start."
        description="A few details, and we’ll take care of the rest."
      />
      <div className="booking-steps">
        {["Your car & care", "Pick a time", "Review & book"].map((name, i) => (
          <button
            disabled={i > step}
            key={name}
            onClick={() => setStep(i)}
            className={i === step ? "active" : i < step ? "done" : ""}
          >
            <span>
              {i < step ? <Check size={16} /> : String(i + 1).padStart(2, "0")}
            </span>
            {name}
          </button>
        ))}
      </div>
      <div className="checkout-layout">
        <div className="checkout-main">
          {step === 0 && (
            <>
              <section className="checkout-section">
                <div className="section-heading">
                  <div>
                    <h2>Which ride are we refreshing?</h2>
                    <p>Your vehicle helps us get the details right.</p>
                  </div>
                  <button className="text-link" onClick={() => setAdding(true)}>
                    <Plus size={16} />
                    Add vehicle
                  </button>
                </div>
                {vehicles.length ? (
                  <div className="vehicle-choices">
                    {vehicles.map((v) => (
                      <button
                        key={v.id}
                        className={`vehicle-choice ${vehicle === v.id ? "selected" : ""}`}
                        onClick={() => setVehicle(v.id)}
                      >
                        <span className="vehicle-icon">
                          <Car size={30} strokeWidth={1.4} />
                        </span>
                        <div>
                          <strong>{v.name}</strong>
                          <small>
                            {v.plate} · {v.kind.toUpperCase()}
                          </small>
                        </div>
                        <span className="radio-dot">
                          {vehicle === v.id && <i />}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <Empty
                    icon={Car}
                    title="Let’s meet your ride"
                    text="Add your first vehicle to get started."
                    action={
                      <Button
                        variant="secondary"
                        onClick={() => setAdding(true)}
                      >
                        <Plus size={16} />
                        Add a vehicle
                      </Button>
                    }
                  />
                )}
              </section>
              <section className="checkout-section">
                <div className="section-heading">
                  <div>
                    <h2>A little care, your way.</h2>
                    <p>
                      Choose one or more services. Packages can include
                      overlapping treatments.
                    </p>
                  </div>
                </div>
                <div className="service-choices">
                  {all.map((s) => (
                    <button
                      key={s.id}
                      className={`service-choice ${services.includes(s.id) ? "selected" : ""}`}
                      onClick={() => toggle(s.id)}
                    >
                      <span className="service-choice-icon">
                        <Sparkles size={22} />
                      </span>
                      <div>
                        <strong>{s.name}</strong>
                        <p>{s.description}</p>
                        <small>
                          <Clock3 size={13} />
                          {s.duration} min <span>·</span>
                          {s.category}
                        </small>
                      </div>
                      <span className="choice-price">
                        {money(s.price)}
                        <i>{services.includes(s.id) && <Check size={13} />}</i>
                      </span>
                    </button>
                  ))}
                </div>
                <p className="small muted">
                  SUV +₹150 / MUV +₹200 per visit. Hatchbacks and sedans have no
                  size surcharge.
                </p>
              </section>
            </>
          )}
          {step === 1 && (
            <section className="checkout-section">
              <h2>Make a little time for shine.</h2>
              <p className="muted">
                All appointments use India Standard Time (IST).
              </p>
              <div className="date-options">
                {days().map((d) => (
                  <button
                    key={d}
                    className={date === d ? "selected" : ""}
                    onClick={() => setDate(d)}
                  >
                    <small>
                      {new Date(`${d}T12:00:00`).toLocaleDateString("en-IN", {
                        weekday: "short",
                      })}
                    </small>
                    <strong>{d.slice(-2)}</strong>
                    <span>
                      {new Date(`${d}T12:00:00`).toLocaleDateString("en-IN", {
                        month: "short",
                      })}
                    </span>
                  </button>
                ))}
              </div>
              <Field
                label="Or choose another day (next 30 days)"
                type="date"
                min={today()}
                max={days(31).at(-1)}
                value={date}
                onChange={(e) => {
                  if (e.target.value) setDate(e.target.value);
                }}
              />
              <div className="section-heading slot-heading">
                <h3>A time that suits you</h3>
                <span>{duration} minute visit</span>
              </div>
              {slotsLoad.loading ? (
                <Loading />
              ) : slotsLoad.error ? (
                <ErrorState
                  message={slotsLoad.error}
                  retry={slotsLoad.reload}
                />
              ) : (
                <>
                  <div className="time-slots">
                    {slotsLoad.data.slots.map((s) => (
                      <button
                        key={s.time}
                        disabled={!s.available}
                        onClick={() => setTime(s.time)}
                        className={time === s.time ? "selected" : ""}
                      >
                        {formatTime(s.time)}
                      </button>
                    ))}
                  </div>
                  {!slotsLoad.data.slots.some((s) => s.available) && (
                    <p className="notice">
                      No times available on this date. Please choose another
                      day.
                    </p>
                  )}
                  <p className="small muted">
                    Unavailable times include existing appointments, closing
                    hours and your other bookings.
                  </p>
                </>
              )}
            </section>
          )}
          {step === 2 && (
            <section className="checkout-section">
              <span className="review-icon">
                <CheckCircle2 size={27} />
              </span>
              <h2>Looking good. Let’s make it official.</h2>
              <p className="muted">
                Take a quick look before we reserve your visit.
              </p>
              <div className="review-details">
                <div>
                  <CalendarDays />
                  <span>
                    YOUR TIME
                    <strong>
                      {formatDate(date)} · {formatTime(time)} IST
                    </strong>
                    <small>{duration} minutes</small>
                  </span>
                  <button className="text-link" onClick={() => setStep(1)}>
                    Change
                  </button>
                </div>
                <div>
                  <Car />
                  <span>
                    YOUR VEHICLE<strong>{chosenVehicle?.name}</strong>
                    <small>
                      {chosenVehicle?.plate} · {chosenVehicle?.color}
                    </small>
                  </span>
                  <button className="text-link" onClick={() => setStep(0)}>
                    Change
                  </button>
                </div>
                <div>
                  <Sparkles />
                  <span>
                    YOUR CARE
                    <strong>{selected.map((s) => s.name).join(" + ")}</strong>
                  </span>
                </div>
              </div>
              <Field label="Anything we should know? (optional)">
                <textarea
                  maxLength={500}
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Please pay extra attention to the boot area."
                />
              </Field>
              <div className="payment-choice">
                <span>
                  <Check size={19} />
                </span>
                <div>
                  <strong>Pay at the centre</strong>
                  <p>
                    No payment now. Pay {money(quote?.total)} when you visit.
                  </p>
                </div>
                <ShieldCheck size={24} />
              </div>
              <p className="small muted">
                You can cancel an upcoming, confirmed booking from My bookings.
                Once you check in, contact the centre for changes.
              </p>
            </section>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="checkout-actions">
            {step > 0 && (
              <Button variant="secondary" onClick={() => setStep(step - 1)}>
                <ArrowLeft size={15} />
                Back
              </Button>
            )}
            <Button
              busy={busy}
              disabled={
                !quote ||
                quoteLoading ||
                !services.length ||
                !vehicle ||
                (step > 0 && !time)
              }
              onClick={() => (step < 2 ? setStep(step + 1) : confirm())}
            >
              {step === 2
                ? "Confirm my booking"
                : step === 0
                  ? "Choose date & time"
                  : "Review booking"}
              <ArrowRight size={17} />
            </Button>
          </div>
        </div>
        <aside className="order-summary">
          <CarPhoto variant={p.image} />
          <div className="summary-content">
            <span className="eyebrow">YOUR LITTLE REFRESH</span>
            <h3>{p.name}</h3>
            <p className="summary-location">
              <MapPin size={13} />
              {p.area}
            </p>
            <div className="summary-items">
              {selected.map((s) => (
                <div key={s.id}>
                  <span>
                    {s.name}
                    <small>{s.duration} min</small>
                  </span>
                  <strong>{money(s.price)}</strong>
                </div>
              ))}
              {chosenVehicle && ["suv", "muv"].includes(chosenVehicle.kind) && (
                <div>
                  <span>{chosenVehicle.kind.toUpperCase()} size surcharge</span>
                  <strong>
                    {money(chosenVehicle.kind === "suv" ? 150 : 200)}
                  </strong>
                </div>
              )}
            </div>
            <div className="coupon-form">
              <label htmlFor="coupon">
                <Tag size={14} />
                Have a little extra?
              </label>
              <div>
                <input
                  id="coupon"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  maxLength={20}
                  placeholder="Offer code"
                />
                <button
                  disabled={!couponInput.trim()}
                  onClick={() => setCoupon(couponInput.trim().toUpperCase())}
                >
                  Apply
                </button>
              </div>
              {coupon && (
                <button
                  className="coupon-applied"
                  onClick={() => {
                    setCoupon("");
                    setCouponInput("");
                  }}
                >
                  {coupon}
                  <X size={13} />
                </button>
              )}
              <small>
                FIRST20: first booking, 20% off up to ₹200.
                <br />
                SHINE10: 10% off up to ₹150, min. ₹799.
              </small>
            </div>
            {quoteLoading && <p className="muted">Calculating your total…</p>}
            {quoteError && (
              <p className="form-error" role="alert">
                {quoteError}
                {coupon && (
                  <button
                    className="text-link"
                    onClick={() => {
                      setCoupon("");
                      setCouponInput("");
                    }}
                  >
                    Remove code
                  </button>
                )}
              </p>
            )}
            {quote && (
              <>
                <div className="summary-line">
                  <span>Subtotal</span>
                  <strong>{money(quote.subtotal)}</strong>
                </div>
                {quote.discount > 0 && (
                  <div className="summary-line discount">
                    <span>Your little saving</span>
                    <strong>−{money(quote.discount)}</strong>
                  </div>
                )}
                <div className="summary-total">
                  <span>
                    Total to pay<small>At the centre</small>
                  </span>
                  <strong>{money(quote.total)}</strong>
                </div>
              </>
            )}
            <div className="summary-trust">
              <ShieldCheck size={17} />
              <span>Clear prices. No online payment.</span>
            </div>
          </div>
        </aside>
      </div>
      {adding && (
        <VehicleForm
          onClose={() => setAdding(false)}
          onSaved={(v) => {
            setAdding(false);
            vehicleLoad.reload();
            setVehicle(v.id);
          }}
        />
      )}
    </div>
  );
}
