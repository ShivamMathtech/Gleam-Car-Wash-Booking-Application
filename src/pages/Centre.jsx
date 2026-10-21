import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Car,
  Check,
  ChevronRight,
  Clock3,
  Heart,
  MapPin,
  Navigation,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Wifi,
} from "lucide-react";
import {
  api,
  useApp,
  useLoad,
  money,
  directions,
  formatTime,
} from "../lib.jsx";
import {
  Button,
  Badge,
  CarPhoto,
  Empty,
  ErrorState,
  Loading,
  Modal,
  Rating,
} from "../components/UI.jsx";
export default function Centre({ id }) {
  const { go, requireAuth, toast, session } = useApp(),
    { data, loading, error, reload } = useLoad(`/providers/${id}`),
    [tab, setTab] = useState("About"),
    [reviewQuery, setReviewQuery] = useState(""),
    [gallery, setGallery] = useState(false),
    [busy, setBusy] = useState(false);
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} retry={reload} />;
  const { provider: p, services, reviews } = data;
  function book(service) {
    if (service) sessionStorage.setItem(`gleam-service-${id}`, service);
    if (requireAuth(`/book/${id}`)) go(`/book/${id}`);
  }
  async function favorite() {
    if (!requireAuth()) return;
    setBusy(true);
    try {
      await api(`/favorites/${id}`, { method: p.favorite ? "DELETE" : "PUT" });
      reload();
      toast(p.favorite ? "Removed from saved centres" : "Saved for later");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="centre-page">
      <div className="breadcrumb">
        <a href="#/nearby">
          <ArrowLeft size={16} />
          All centres
        </a>
        <ChevronRight size={13} />
        <span>{p.name}</span>
      </div>
      <div className="centre-cover">
        <CarPhoto variant={p.image} />
        <div className="cover-gradient" />
        <div className="cover-label">
          <span className="hero-kicker">A LITTLE CARE GOES A LONG WAY</span>
          <h1>{p.name}</h1>
          <p>
            <MapPin size={15} />
            {p.area}, Dehradun
          </p>
        </div>
        <button className="cover-gallery" onClick={() => setGallery(true)}>
          View studio image
          <ArrowUpRight size={15} />
        </button>
        <button
          className={`cover-heart icon-btn ${p.favorite ? "selected" : ""}`}
          onClick={favorite}
          disabled={busy}
          aria-label={p.favorite ? "Unsave centre" : "Save centre"}
        >
          <Heart size={19} fill={p.favorite ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="centre-layout">
        <div>
          <div className="centre-info">
            <div className="centre-meta">
              <Rating rating={p.rating} count={p.reviewCount} />
              <span>·</span>
              <span>{p.distance} km away</span>
              <span>·</span>
              <Badge className={p.isOpen ? "green" : ""}>
                {p.isOpen ? "Open now" : "Closed now"}
              </Badge>
            </div>
            <div className="centre-headline">
              <div>
                <h2>Care that makes a difference.</h2>
                <p>{p.address}</p>
              </div>
              <span className="quality-seal">
                <ShieldCheck size={24} />
              </span>
            </div>
            <nav className="tabs" aria-label="Centre details">
              {["About", "Services", "Gallery", "Reviews"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={tab === t ? "active" : ""}
                >
                  {t}
                  {t === "Reviews" && <span>{p.reviewCount}</span>}
                </button>
              ))}
            </nav>
          </div>
          <div className="tab-content">
            {tab === "About" && (
              <>
                <section className="detail-section">
                  <span className="eyebrow">GET TO KNOW YOUR CENTRE</span>
                  <h3>A good day for your car.</h3>
                  <p>{p.description}</p>
                  <div className="amenities">
                    {p.features.map((f, i) => (
                      <div key={f}>
                        {i % 3 === 0 ? (
                          <ShieldCheck />
                        ) : i % 3 === 1 ? (
                          <Car />
                        ) : (
                          <Wifi />
                        )}
                        {f}
                      </div>
                    ))}
                  </div>
                </section>
                <section className="detail-section">
                  <h3>Thoughtful care, every time.</h3>
                  <div className="process-row">
                    {[
                      [
                        "01",
                        "Book your moment",
                        "Choose the care and time that work for you.",
                      ],
                      [
                        "02",
                        "Drop by & unwind",
                        "Check in with your booking code at the centre.",
                      ],
                      [
                        "03",
                        "Leave with a shine",
                        "Enjoy that fresh-car feeling all over again.",
                      ],
                    ].map(([n, t, d]) => (
                      <div key={n}>
                        <span>{n}</span>
                        <h4>{t}</h4>
                        <p>{d}</p>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="detail-section">
                  <div className="section-heading">
                    <h3>A little something for every ride</h3>
                    <button
                      className="text-link"
                      onClick={() => setTab("Services")}
                    >
                      All services
                      <ArrowRight size={15} />
                    </button>
                  </div>
                  {services.slice(0, 2).map((s) => (
                    <div key={s.id} className="service-mini">
                      <span>
                        <Sparkles size={21} />
                      </span>
                      <div>
                        <h4>{s.name}</h4>
                        <p>
                          {s.duration} minutes · {s.category}
                        </p>
                      </div>
                      <strong>{money(s.price)}</strong>
                      <button
                        className="icon-btn"
                        aria-label={`Book ${s.name}`}
                        onClick={() => book(s.id)}
                      >
                        <ArrowUpRight size={18} />
                      </button>
                    </div>
                  ))}
                </section>
              </>
            )}
            {tab === "Services" && (
              <>
                <div className="section-heading">
                  <div>
                    <h3>Pick your perfect refresh.</h3>
                    <p>
                      Prices shown for hatchbacks & sedans. SUV +₹150, MUV +₹200
                      per visit.
                    </p>
                  </div>
                </div>
                <div className="detail-services">
                  {services.map((s) => (
                    <article key={s.id} className="service-detail">
                      <div className="section-heading">
                        <div>
                          <Badge>{s.category}</Badge>
                          <h3>{s.name}</h3>
                          <p>{s.description}</p>
                        </div>
                        <strong>{money(s.price)}</strong>
                      </div>
                      <ul>
                        {s.features.map((f) => (
                          <li key={f}>
                            <Check size={15} />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <div className="service-detail-bottom">
                        <span>
                          <Clock3 size={14} />
                          {s.duration} minutes
                        </span>
                        <Button variant="secondary" onClick={() => book(s.id)}>
                          Choose service
                          <ArrowRight size={14} />
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
                {!services.length && (
                  <Empty
                    title="Services are being refreshed"
                    text="Please check back soon."
                  />
                )}
              </>
            )}
            {tab === "Gallery" && (
              <div>
                <h3>A glimpse of the shine.</h3>
                <p className="muted">
                  Illustrative studio photography, created for this application.
                </p>
                <button
                  className="gallery-photo"
                  onClick={() => setGallery(true)}
                >
                  <CarPhoto variant={p.image} />
                  <span>
                    Foam wash & finishing
                    <ArrowUpRight size={18} />
                  </span>
                </button>
              </div>
            )}
            {tab === "Reviews" && (
              <>
                <div className="reviews-header">
                  <span className="big-rating">
                    {p.rating || "—"}
                    <Star fill="currentColor" size={24} />
                  </span>
                  <div>
                    <h3>Little details. Happy drivers.</h3>
                    <p>
                      {p.reviewCount} reviews{" "}
                      {session.demoMode
                        ? "· Includes labelled sample reviews"
                        : ""}
                    </p>
                  </div>
                </div>
                <label className="search-field">
                  <Search size={18} />
                  <input
                    aria-label="Search reviews"
                    placeholder="Search reviews…"
                    value={reviewQuery}
                    onChange={(e) => setReviewQuery(e.target.value)}
                  />
                </label>
                <div className="review-list">
                  {reviews
                    .filter((r) =>
                      `${r.author} ${r.comment}`
                        .toLowerCase()
                        .includes(reviewQuery.toLowerCase()),
                    )
                    .map((r) => (
                      <article className="review-item" key={r.id}>
                        <div className="review-top">
                          <span className="avatar">{r.author[0]}</span>
                          <div>
                            <strong>{r.author}</strong>
                            <small>
                              {r.is_demo ? "Sample review" : "Verified visit"}
                            </small>
                          </div>
                          <Rating rating={r.rating} />
                        </div>
                        <p>{r.comment}</p>
                        <small>
                          {new Date(r.created_at).toLocaleDateString("en-IN")}
                        </small>
                      </article>
                    ))}
                </div>
                <p className="muted">
                  Completed a visit? Leave a review from{" "}
                  <a href="#/bookings" className="text-link">
                    My bookings
                  </a>
                  .
                </p>
              </>
            )}
          </div>
        </div>
        <aside className="centre-aside">
          <div className="booking-callout">
            <span className="eyebrow">YOUR NEXT FRESH START</span>
            <h3>
              Ready for that
              <br />
              new-car feeling?
            </h3>
            <p>Give your ride a little love.</p>
            <div className="from-price">
              <span>Services from</span>
              <strong>{p.fromPrice === null ? "—" : money(p.fromPrice)}</strong>
            </div>
            <Button
              className="full"
              onClick={() => book()}
              disabled={!services.length}
            >
              Book a service
              <ArrowRight size={17} />
            </Button>
            <small>
              <ShieldCheck size={13} />
              Pay at the centre · No online payment
            </small>
          </div>
          <div className="visit-card">
            <h3>Plan your visit</h3>
            <div>
              <Clock3 size={18} />
              <span>
                <strong>Open every day</strong>
                <small>
                  {formatTime(`${String(p.opens).padStart(2, "0")}:00`)} –{" "}
                  {formatTime(`${String(p.closes).padStart(2, "0")}:00`)} IST
                </small>
              </span>
            </div>
            <div>
              <MapPin size={18} />
              <span>
                <strong>{p.area}</strong>
                <small>{p.address}</small>
              </span>
            </div>
            <a
              href={directions(p)}
              target="_blank"
              rel="noreferrer"
              className="btn secondary"
            >
              <Navigation size={16} />
              Get directions
              <ArrowUpRight size={14} />
            </a>
            {session.demoMode ? (
              <button
                className="text-link full"
                onClick={() =>
                  toast(
                    "This is a sample centre. No real phone service is connected.",
                  )
                }
              >
                Contact centre
                <Phone size={14} />
              </button>
            ) : (
              <a className="text-link full" href={`tel:${p.phone}`}>
                Contact centre
                <Phone size={14} />
              </a>
            )}
          </div>
          <div className="care-tip">
            <Sparkles size={19} />
            <p>
              A small tip: arrive 5 minutes early and remove personal belongings
              before your wash.
            </p>
          </div>
        </aside>
      </div>
      {gallery && (
        <Modal title="A closer look" wide onClose={() => setGallery(false)}>
          <CarPhoto variant={p.image} />
          <p className="muted">
            Original AI-generated studio illustration. Sample photography is not
            evidence of a real business.
          </p>
        </Modal>
      )}
    </div>
  );
}
