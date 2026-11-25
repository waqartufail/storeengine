import React, { useState } from "react";
import { api, Field, Message, useAction } from "./ui";
import { local } from "./navigation";
export default function PostExToken({ settings }) {
  const [token, setToken] = useState(""),
    [email, setEmail] = useState(settings.adminEmail || ""),
    [configured, setConfigured] = useState(settings.postExConfigured);
  const a = useAction();
  async function save(e) {
    e.preventDefault();
    await a.run(async () => {
      const value = token.trim();
      if (!/^[\x21-\x7e]{1,4096}$/.test(value))
        throw Error("Enter the token without spaces or line breaks.");
      if (local) {
        const digest = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(email.trim().toLowerCase()),
        );
        const name =
          Array.from(new Uint8Array(digest), (x) =>
            x.toString(16).padStart(2, "0"),
          ).join("") + ".token";
        const url = URL.createObjectURL(
          new Blob([value], { type: "application/octet-stream" }),
        );
        const link = document.createElement("a");
        link.download = name;
        link.href = url;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        a.setMessage(
          "Private token file downloaded. Place it in private/postex on your server for the matching merchant email.",
        );
      } else {
        await api("/admin/couriers/postex/token", "PUT", { token: value });
        setConfigured(true);
        a.setMessage("PostEx token saved for this store.");
      }
      setToken("");
    });
  }
  return (
    <section className="panel">
      <h3>PostEx API token</h3>
      <form className="form" onSubmit={save}>
        {local ? (
          <>
            <p>
              For live bookings, save the token in your{" "}
              <a
                href="http://localhost:5173/admin#shipping"
                target="_blank"
                rel="noreferrer"
              >
                server Admin
              </a>
              . For offline setup, download the private token file here and
              place it in the server’s <code>private/postex</code> folder. Keep
              it out of GitHub.
            </p>
            <Field
              label="Registered server merchant email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </>
        ) : (
          <p>
            Credential status · {configured ? "Configured" : "Awaiting token"}
          </p>
        )}
        <Field
          label="PostEx API token"
          name="postex-secret"
          type="password"
          autoComplete="new-password"
          required
          maxLength={4096}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={
            configured
              ? "Enter a replacement token"
              : "Paste your merchant token"
          }
        />
        <button className="cta" disabled={a.busy || !token.trim()}>
          {local ? "Download private token file" : "Save PostEx token"}
        </button>
        <Message text={a.message} />
      </form>
    </section>
  );
}
