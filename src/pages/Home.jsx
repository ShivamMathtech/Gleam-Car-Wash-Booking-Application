import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Car,
  Check,
  ChevronDown,
  Clock3,
  Compass,
  Droplets,
  Heart,
  Map,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sofa,
  Sparkles,
  SprayCan,
  Star,
  Tag,
  X,
} from "lucide-react";
import { useApp, useLoad, money } from "../lib.jsx";
import {
  Button,
  PageHeading,
  ProviderCard,
  Empty,
  ErrorState,
  Loading,
  AreaMap,
} from "../components/UI.jsx";

export default function Home({ directory = false, saved = false }) {
  const { user, go, location, version, requireAuth, toast, session } = useApp();
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [sort, setSort] = useState("distance"),
    [open, setOpen] = useState(false),
    [maxPrice, setMaxPrice] = useState(""),
    [filters, setFilters] = useState(false),
    [map, setMap] = useState(directory),
    [selected, setSelected] = useState("");
  const params = new URLSearchParams({
    q: query,
    sort,
    lat: location.lat,
    lng: location.lng,
    ...(category ? { category } : {}),
    ...(open ? { open: "true" } : {}),
    ...(maxPrice ? { maxPrice } : {}),
    ...(saved ? { favorite: "true" } : {}),
  });
  const { data, loading, error, reload } = useLoad(`/providers?${params}`, [
    version,
  ]);
  const providers = data?.providers || [],
    shown = directory || saved ? providers : providers.slice(0, 3),
    active = providers.find((p) => p.id === selected) || providers[0];
  const categories = [
    ["", Car, "All services"],
    ["Exterior", Droplets, "Exterior wash"],
    ["Interior", Sofa, "Interior care"],
    ["Detailing", Sparkles, "Full detailing"],
    ["Protection", ShieldCheck, "Wax & protect"],
  ];
  async function copyOffer() {
    try {
      await navigator.clipboard.writeText("FIRST20");
      toast("Copied FIRST20. Apply it at checkout.");
    } catch {
      toast("Use FIRST20 at checkout for your first booking.");
    }
  }
  if (saved && !user)
    return (
      <Empty
        icon={Heart}
        title="Save a little shine for later"
        text="Sign in to keep your favourite wash centres close."
        action={
          <Button onClick={() => requireAuth()}>
            Sign in
            <ArrowRight size={16} />
          </Button>
        }
      />
    );
  return (
    <div className="home-page">
      <PageHeading
        eyebrow={
          saved
            ? "YOUR LITTLE BLACK BOOK"
            : directory
              ? "A FRESH START, CLOSE BY"
              : `HEY ${user ? user.name.split(" ")[0].toUpperCase() : "THERE"}, LET’S MAKE IT SHINE`
        }
        title={
          saved
            ? "Your saved centres"
            : directory
              ? "Find your happy place."
              : "Good days start with a clean car."
        }
        description={
          saved
            ? "Your favourites, ready for your next visit."
            : directory
              ? "The right care. The right centre. Just around the corner."
              : "Discover thoughtful car care, from a quick rinse to a complete refresh."
        }
        action={
          !directory && !saved ? (
            <span className="today-note">
              <span className="sun-icon">✳</span> A fresh start awaits
            </span>
          ) : null
        }
      />
      {!directory && !saved && (
        <div className="hero-row">
          <section className="hero">
            <img
              src="/images/carwash.png"
              alt="A silver car being carefully foam washed"
            />
            <div className="hero-shade" />
            <div className="hero-copy">
              <span className="hero-kicker">
                <span />
                MORE THAN JUST A CAR WASH
              </span>
              <h2>
                A little care.
                <br />A lot of <em>shine.</em>
              </h2>
              <p>
                Good as new. Better than ever.
                <br />
                Find your car’s next fresh start.
              </p>
              <Button onClick={() => go("/nearby")}>
                Find a wash centre
                <ArrowUpRight size={17} />
              </Button>
            </div>
            <div className="hero-note">
              <ShieldCheck size={14} />
              Care that goes the extra mile
            </div>
          </section>
          <section className="offer-card">
            <div className="offer-top">
              <span className="offer-label">
                <Tag size={14} />A WARM WELCOME
              </span>
              <Sparkles size={25} />
            </div>
            <div>
              <h3>
                Your first wash,
                <br />a little sweeter.
              </h3>
              <div className="offer-value">
                20
                <span>
                  %<small>OFF</small>
                </span>
              </div>
              <p>Fresh starts deserve a little extra.</p>
            </div>
            <button className="coupon" onClick={copyOffer}>
              <span>
                USE CODE <strong>FIRST20</strong>
              </span>
              <ArrowRight size={17} />
            </button>
            <small>First booking only · Up to ₹200 · Min. ₹499</small>
          </section>
        </div>
      )}
      {!saved && (
        <section className="services-section">
          <div className="section-label">
            <h2>What does your car need?</h2>
            <span>A little something for every ride</span>
          </div>
          <div className="categories">
            {categories.map(([value, Icon, label]) => (
              <button
                key={value}
                className={category === value ? "active" : ""}
                onClick={() => setCategory(value)}
              >
                <span>
                  <Icon size={24} strokeWidth={1.6} />
                </span>
                <strong>{label}</strong>
                {category === value && <i />}
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="centres-section">
        <div className="section-heading">
          <div>
            <h2>
              {saved
                ? "Good care, worth keeping"
                : directory
                  ? "Centres around you"
                  : "A fresh finish, not far away"}
            </h2>
            <p>
              <MapPin size={13} />
              {location.label}
              {session.demoMode && (
                <span className="sample-label">Sample directory</span>
              )}
            </p>
          </div>
          {!directory && !saved ? (
            <a className="text-link" href="#/nearby">
              View all centres
              <ArrowRight size={15} />
            </a>
          ) : (
            <Button
              variant="secondary"
              className="compact"
              onClick={() => setMap(!map)}
            >
              <Map size={16} />
              {map ? "Hide map" : "Map view"}
            </Button>
          )}
        </div>
        <div className="search-row">
          <label className="search-field">
            <Search size={19} />
            <input
              type="search"
              aria-label="Search centres"
              placeholder="Search for a centre or neighbourhood…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button aria-label="Clear search" onClick={() => setQuery("")}>
                <X size={16} />
              </button>
            )}
          </label>
          <label className="sort-control">
            <span>Sort by:</span>
            <select
              aria-label="Sort centres"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="distance">Nearest first</option>
              <option value="rating">Top rated</option>
              <option value="price">Lowest price</option>
            </select>
          </label>
          <button
            className={`filter-button ${filters || open || maxPrice ? "active" : ""}`}
            onClick={() => setFilters(!filters)}
            aria-expanded={filters}
          >
            <SlidersHorizontal size={17} />
            <span>Filters</span>
            {(open || maxPrice) && <i />}
          </button>
        </div>
        {filters && (
          <div className="filters-panel">
            <label className="check-label">
              <input
                type="checkbox"
                checked={open}
                onChange={(e) => setOpen(e.target.checked)}
              />
              Open now
            </label>
            <label>
              Starting price{" "}
              <select
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              >
                <option value="">Any price</option>
                <option value="500">Up to ₹500</option>
                <option value="600">Up to ₹600</option>
                <option value="1000">Up to ₹1,000</option>
              </select>
            </label>
            <button
              className="text-link"
              onClick={() => {
                setOpen(false);
                setMaxPrice("");
                setCategory("");
                setQuery("");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} retry={reload} />
        ) : !providers.length ? (
          <Empty
            icon={saved ? Heart : Search}
            title={saved ? "Your favourites are waiting" : "No centres found"}
            text={
              saved
                ? "Tap the heart on a centre to keep it here."
                : "Try another neighbourhood or clear your filters."
            }
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  if (saved) go("/nearby");
                  else {
                    setQuery("");
                    setCategory("");
                    setOpen(false);
                    setMaxPrice("");
                  }
                }}
              >
                {saved ? "Discover centres" : "Clear filters"}
              </Button>
            }
          />
        ) : (
          <div className={`discovery-layout ${map ? "with-map" : ""}`}>
            <div className="provider-grid">
              {shown.map((p) => (
                <ProviderCard key={p.id} provider={p} onFavorite={reload} />
              ))}
            </div>
            {map && (
              <aside className="map-panel">
                <AreaMap
                  providers={providers}
                  selected={active?.id}
                  onSelect={setSelected}
                  location={location}
                />
                {active && (
                  <div className="map-selection">
                    <span className="eyebrow">YOUR NEXT STOP</span>
                    <h3>{active.name}</h3>
                    <p>
                      <MapPin size={14} />
                      {active.area} · {active.distance} km
                    </p>
                    <Button onClick={() => go(`/centres/${active.id}`)}>
                      Explore centre
                      <ArrowRight size={16} />
                    </Button>
                  </div>
                )}
              </aside>
            )}
          </div>
        )}
      </section>
      {!directory && !saved && (
        <>
          <section className="garage-banner">
            <span className="garage-illustration">
              <Car size={48} strokeWidth={1.2} />
              <Sparkles size={20} />
            </span>
            <div>
              <span className="eyebrow">YOUR RIDE, REMEMBERED</span>
              <h3>Less typing. More shining.</h3>
              <p>Save your vehicle once. Make every booking a breeze.</p>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                if (requireAuth("/garage")) go("/garage");
              }}
            >
              My garage
              <ArrowRight size={16} />
            </Button>
          </section>
          <div className="trust-row">
            <span>
              <ShieldCheck />
              Carefully selected services
            </span>
            <span>
              <Clock3 />
              Book a time that suits you
            </span>
            <span>
              <Car />
              Pay at the wash centre
            </span>
          </div>
        </>
      )}
    </div>
  );
}
