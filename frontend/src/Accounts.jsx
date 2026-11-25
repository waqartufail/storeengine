import { link, local } from "./navigation";
import React, { useEffect, useState } from "react";
import { api, Header, Field, Select, Message, useAction } from "./ui";
export function LoginPage({ role, onLogin, reason }) {
  const a = useAction();
  const admin = role === "admin";
  async function submit(e, signup) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    await a.run(async () => {
      if (signup) {
        await api("/auth/signup", "POST", body);
        form.reset();
        a.setMessage(
          "Registration received. Your store is pending owner approval.",
        );
      } else {
        await api("/auth/" + role + "/login", "POST", body);
        await onLogin();
      }
    });
  }
  return (
    <>
      <Header />
      <main className="wrap">
        <div className="eyebrow">NATUR-WALA & CO.</div>
        <h1>{admin ? "Store administration" : "Platform owner"}</h1>
        <Message text={a.message || reason} />
        <div className="authGrid">
          <section className="panel">
            <h2>{admin ? "Admin login" : "Owner login"}</h2>
            {local && (
              <p className="muted">
                Local sample login is filled in. Choose Sign in to open the
                dashboard.
              </p>
            )}
            <form className="form" onSubmit={(e) => submit(e, false)}>
              <Field
                label="Email"
                name="email"
                defaultValue={local ? window.NW_LOCAL.accounts[role].email : ""}
                type="email"
                autoComplete="username"
                required
              />
              <Field
                label="Password"
                name="password"
                defaultValue={
                  local ? window.NW_LOCAL.accounts[role].password : ""
                }
                type="password"
                autoComplete="current-password"
                required
              />
              <button disabled={a.busy} className="cta">
                Sign in
              </button>
            </form>
          </section>
          {admin && (
            <section className="panel">
              <h2>Create a store</h2>
              <p className="muted">
                The owner reviews registrations before opening a store.
              </p>
              <form className="form" onSubmit={(e) => submit(e, true)}>
                <Field
                  label="Admin name"
                  name="adminName"
                  required
                  maxLength="100"
                />
                <Field
                  label="Store name"
                  name="name"
                  required
                  maxLength="100"
                />
                <Field label="Admin email" name="email" type="email" required />
                <Field
                  label="New password (12 characters minimum)"
                  name="password"
                  type="password"
                  minLength="12"
                  maxLength="128"
                  autoComplete="new-password"
                  required
                />
                <button disabled={a.busy} className="cta">
                  Request approval
                </button>
              </form>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
export function Owner({ logout }) {
  const [stores, setStores] = useState([]),
    [plans, setPlans] = useState({});
  const a = useAction();
  const load = async () => setStores(await api("/owner/stores"));
  useEffect(() => {
    a.run(load);
  }, []);
  async function decide(s, action) {
    const plan = plans[s.id] || s.plan || "Trial";
    if (
      !window.confirm(
        action === "Activate"
          ? "Activate " + s.name + " on " + plan + " starting today?"
          : action + " " + s.name + "?",
      )
    )
      return;
    await a.run(async () => {
      await api("/owner/stores/" + s.id, "PUT", { action, plan });
      await load();
      a.setMessage(s.name + " updated.");
    });
  }
  return (
    <>
      <Header>
        <a href={link("/admin")}>Admin portal</a>
        <button onClick={logout}>Sign out</button>
      </Header>
      <main className="wrap">
        <div className="eyebrow">PLATFORM OWNER</div>
        <div className="head">
          <h1>Store approvals</h1>
          <button className="secondary" onClick={() => a.run(load)}>
            Refresh
          </button>
        </div>
        <Message text={a.message} />
        <section className="panel">
          <h2>Registered stores ({stores.length})</h2>
          {stores.map((s) => (
            <article className="row ownerRow" key={s.id}>
              <div>
                <b>{s.name}</b>
                <small>
                  {s.adminName} · {s.email} · Store ID {s.id}
                </small>
                <small>{s.slug}</small>
                <span className="statusPill">
                  {s.status === "Active" &&
                  s.expiresAt &&
                  new Date(s.expiresAt) <= new Date()
                    ? "Expired"
                    : s.status}
                </span>{" "}
                {s.plan}
                {s.expiresAt && (
                  <small>
                    Expires {new Date(s.expiresAt).toLocaleString()}
                  </small>
                )}
              </div>
              <div className="actions">
                <Select
                  label="Approval plan"
                  value={plans[s.id] || s.plan || "Trial"}
                  values={["Trial", "Monthly", "Yearly", "Lifetime"]}
                  onChange={(e) =>
                    setPlans({ ...plans, [s.id]: e.target.value })
                  }
                />
                {["Activate", "Deactivate", "Reject"].map((action) => (
                  <button
                    key={action}
                    className={
                      action === "Activate"
                        ? "cta"
                        : action === "Reject"
                          ? "remove"
                          : "secondary"
                    }
                    disabled={a.busy}
                    onClick={() => decide(s, action)}
                  >
                    {action}
                  </button>
                ))}
              </div>
            </article>
          ))}
          {!stores.length && (
            <p className="muted">No stores have registered yet.</p>
          )}
        </section>
      </main>
    </>
  );
}
