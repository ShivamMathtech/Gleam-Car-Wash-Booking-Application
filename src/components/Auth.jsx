import { useState } from "react";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { api, useApp } from "../lib.jsx";
import { Modal, Button, Field, Logo } from "./UI.jsx";

export default function Auth({ onClose }) {
  const { session, acceptSession, toast } = useApp();
  const [mode, setMode] = useState("login"),
    [form, setForm] = useState({
      name: "",
      email: "",
      password: "",
      phone: "",
      code: "",
    }),
    [otp, setOtp] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [show, setShow] = useState(false);
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const switchMode = (m) => {
    setMode(m);
    setError("");
    setOtp(null);
  };
  async function submit(e, demo) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "phone" && !otp && !demo) {
        const r = await api("/auth/request-otp", {
          method: "POST",
          body: { phone: form.phone },
        });
        setOtp(r);
        toast(r.message);
      } else {
        const endpoint = demo
          ? "/auth/login"
          : mode === "phone"
            ? "/auth/verify-otp"
            : mode === "register"
              ? "/auth/register"
              : "/auth/login";
        const body = demo
          ? {
              email:
                demo === "admin" ? "admin@gleam.local" : "customer@gleam.local",
              password: demo === "admin" ? "AdminDemo123!" : "GleamDemo123!",
            }
          : form;
        const r = await api(endpoint, { method: "POST", body });
        acceptSession(r);
        toast(`Welcome, ${r.user.name.split(" ")[0]}!`);
        onClose();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        mode === "register"
          ? "Make room for a little shine"
          : mode === "phone"
            ? "Your number. Your next wash."
            : "Good to see you again"
      }
      onClose={onClose}
    >
      <div className="auth-brand">
        <Logo />
        <p>
          {mode === "register"
            ? "Create an account to save your rides and book your next visit."
            : "Sign in and give your car the care it deserves."}
        </p>
      </div>
      <form onSubmit={submit} className="form-stack">
        {mode === "register" && (
          <Field
            label="Full name"
            name="name"
            autoComplete="name"
            value={form.name}
            onChange={change}
            required
            minLength={2}
            maxLength={80}
          />
        )}
        {mode !== "phone" ? (
          <>
            <Field
              label="Email address"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={change}
              required
            />
            <Field label="Password">
              <div className="password-field">
                <input
                  name="password"
                  type={show ? "text" : "password"}
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  minLength={mode === "register" ? 10 : 1}
                  maxLength={128}
                  value={form.password}
                  onChange={change}
                  required
                  placeholder={
                    mode === "register"
                      ? "At least 10 characters"
                      : "Your password"
                  }
                />
                <button
                  type="button"
                  aria-label={show ? "Hide password" : "Show password"}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </Field>
          </>
        ) : (
          <>
            <Field
              label="Indian mobile number"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              disabled={!!otp}
              value={form.phone}
              onChange={change}
              required
            />
            {otp && (
              <>
                <Field
                  label="6-digit verification code"
                  name="code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={form.code}
                  onChange={change}
                  required
                  placeholder="Enter your code"
                />
                {otp.demoCode && (
                  <div className="demo-code">
                    <ShieldCheck size={19} />
                    <div>
                      Local demo code: <strong>{otp.demoCode}</strong>
                      <small>No SMS has been sent. Expires in 5 minutes.</small>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    setOtp(null);
                    setForm({ ...form, code: "" });
                  }}
                >
                  Change number / request a new code
                </button>
              </>
            )}
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" busy={busy}>
          {mode === "phone"
            ? otp
              ? "Verify & continue"
              : "Get verification code"
            : mode === "register"
              ? "Create account"
              : "Sign in"}
          <ArrowRight size={16} />
        </Button>
      </form>
      <div className="auth-switch">
        {mode === "login" ? (
          <>
            New here?{" "}
            <button onClick={() => switchMode("register")}>
              Create an account
            </button>
          </>
        ) : (
          <button onClick={() => switchMode("login")}>
            Back to email sign-in
          </button>
        )}
      </div>
      {mode !== "phone" && session.smsEnabled && (
        <button
          className="btn secondary full"
          onClick={() => switchMode("phone")}
        >
          <Phone size={16} />
          Sign in with mobile OTP
        </button>
      )}
      {session.demoMode && (
        <div className="demo-access">
          <span>EXPLORE THE LOCAL DEMO</span>
          <div>
            <Button
              variant="secondary"
              busy={busy}
              onClick={(e) => submit(e, "customer")}
            >
              Customer demo
            </Button>
            <Button
              variant="ghost"
              busy={busy}
              onClick={(e) => submit(e, "admin")}
            >
              Admin demo
            </Button>
          </div>
        </div>
      )}
      <p className="auth-foot">
        Pay at the centre. Your next fresh start is just a few taps away.
      </p>
    </Modal>
  );
}
