const root = document.getElementById("merchantWorkspace");

if (root) {
  const signInButton = root.querySelector("#merchantSignIn");
  const signOutButton = root.querySelector("#merchantSignOut");
  const accountStatus = root.querySelector("#merchantAccountStatus");
  const connectionSection = root.querySelector("#merchantConnections");
  const authNotice = root.querySelector("#merchantAuthNotice");
  const trackingForm = root.querySelector("#merchantTrackingForm");
  const trackingCarrier = root.querySelector("#merchantTrackingCarrier");
  const trackingNumber = root.querySelector("#merchantTrackingNumber");
  const trackingButton = root.querySelector("#merchantTrackButton");
  const trackingStatus = root.querySelector("#merchantTrackingStatus");
  const trackingResult = root.querySelector("#merchantTrackingResult");
  const trackingSummary = root.querySelector("#merchantTrackingSummary");
  const trackingEvents = root.querySelector("#merchantTrackingEvents");
  const providers = ["ups", "fedex"];
  let authenticated = false;
  let busy = false;

  function setText(element, value) {
    if (element) element.textContent = String(value ?? "");
  }

  function messageFor(code) {
    const messages = {
      unauthenticated: "Sign in before using your merchant workspace.",
      merchant_auth_not_configured: "Merchant sign-in is not configured in this environment yet.",
      invalid_tracking_number: "Enter a valid tracking number for the selected carrier.",
      carrier_lookup_failed: "The carrier adapter could not return a tracking result. Check the number and try again.",
      carrier_lookup_timeout: "The carrier adapter timed out. Try again later.",
      carrier_verification_required: "The carrier requires an additional verification step. Try again later.",
      carrier_rate_limited: "The carrier rate limit was reached. Try again later.",
      global_rate_limiter_unavailable: "The secure request limiter is unavailable. No carrier request was sent.",
      global_rate_limiter_not_configured: "The secure request limiter is not configured. No carrier request was sent.",
      origin_forbidden: "The request origin was not accepted."
    };
    return messages[code] || "The request could not be completed (" + String(code || "unknown_error") + ").";
  }

  async function requestJson(path, options = {}) {
    const response = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      ...options
    });
    let data = {};
    try { data = await response.json(); } catch { data = {}; }
    if (!response.ok) {
      const error = new Error(typeof data.error === "string" ? data.error : "request_failed");
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function updateControls() {
    root.querySelectorAll("button").forEach(button => {
      if (button.dataset.stayEnabled === "true") return;
      button.disabled = busy || (!authenticated && button !== signInButton);
    });
    if (trackingForm) {
      trackingForm.querySelectorAll("input, select, button").forEach(control => {
        control.disabled = !authenticated || busy;
      });
    }
    if (trackingButton) trackingButton.disabled = !authenticated || busy;
    if (signInButton) signInButton.hidden = authenticated;
    if (signOutButton) signOutButton.hidden = !authenticated;
    if (connectionSection) connectionSection.hidden = !authenticated;
    if (authNotice) authNotice.hidden = authenticated;
  }

  function setBusy(value) {
    busy = value;
    updateControls();
  }

  function clearTrackingResult() {
    trackingResult.hidden = true;
    setText(trackingSummary, "");
    trackingEvents.replaceChildren();
  }

  function renderTrackingResult(result) {
    clearTrackingResult();
    const carrier = String(result.carrier || result.provider || "").toUpperCase();
    const status = String(result.status || "unknown").replaceAll("_", " ");
    const delivery = result.expectedDelivery ? " · Expected delivery: " + result.expectedDelivery : "";
    setText(trackingSummary,
      carrier + " · " + status + delivery + " · Source: " + String(result.source || "carrier adapter"));

    const events = Array.isArray(result.events) ? result.events : [];
    events.forEach(event => {
      const item = document.createElement("li");
      item.className = "merchant-event";
      const heading = document.createElement("strong");
      heading.textContent = String(event.stage || "update").replaceAll("_", " ");
      const description = document.createElement("p");
      description.textContent = String(event.description || "Carrier update");
      const metadata = document.createElement("p");
      metadata.className = "merchant-event-meta";
      metadata.textContent = [event.time, event.location]
        .filter(value => typeof value === "string" && value).join(" · ");
      item.append(heading, description, metadata);
      trackingEvents.append(item);
    });

    if (events.length === 0) {
      const item = document.createElement("li");
      item.className = "merchant-event";
      item.textContent = "The carrier returned a status without a scan timeline.";
      trackingEvents.append(item);
    }
    trackingResult.hidden = false;
  }

  async function loadSession() {
    setText(accountStatus, "Checking merchant sign-in…");
    try {
      const response = await fetch("/api/merchant/session", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      const data = await response.json().catch(() => ({}));
      authenticated = response.ok && data.authenticated === true;
      if (authenticated) {
        setText(accountStatus, "Signed in as " + (data.user?.email || "merchant account"));
      } else if (response.status === 401) {
        setText(accountStatus, "Sign in to access your merchant shipments.");
      } else {
        setText(accountStatus, messageFor(data.error || "merchant_auth_not_configured"));
      }
    } catch {
      authenticated = false;
      setText(accountStatus, "Merchant sign-in status is temporarily unavailable.");
    }
    updateControls();
    if (signInButton && /not configured/i.test(accountStatus.textContent)) {
      signInButton.disabled = true;
    }
  }

  signInButton?.addEventListener("click", async () => {
    signInButton.disabled = true;
    setText(accountStatus, "Opening secure sign-in…");
    try {
      const result = await requestJson("/api/merchant/auth/google/start", {
        method: "POST",
        headers: { Accept: "application/json" }
      });
      if (typeof result.authorizationUrl !== "string" ||
          new URL(result.authorizationUrl).origin !== "https://accounts.google.com") {
        throw new Error("invalid_authorization_response");
      }
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      setText(accountStatus, messageFor(error.message));
      signInButton.disabled = false;
    }
  });

  signOutButton?.addEventListener("click", async () => {
    setBusy(true);
    try {
      await requestJson("/api/merchant/session", {
        method: "DELETE",
        headers: { Accept: "application/json" }
      });
      authenticated = false;
      clearTrackingResult();
      setText(accountStatus, "Signed out.");
      setText(trackingStatus, "Sign in to track a shipment.");
    } catch (error) {
      setText(accountStatus, messageFor(error.message));
    } finally {
      setBusy(false);
    }
  });

  trackingForm?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!authenticated || busy) return;

    const provider = trackingCarrier.value;
    const number = trackingNumber.value.trim();
    if (!providers.includes(provider)) {
      setText(trackingStatus, "Choose a supported carrier.");
      return;
    }
    if (!number) {
      setText(trackingStatus, messageFor("invalid_tracking_number"));
      return;
    }

    clearTrackingResult();
    setBusy(true);
    setText(trackingStatus, "Sending the lookup through ExportFlow's " + provider.toUpperCase() + " adapter…");
    try {
      const result = await requestJson("/api/merchant/carriers/" + provider + "/track", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ number })
      });
      renderTrackingResult(result);
      setText(trackingStatus, "ExportFlow's carrier adapter returned a tracking response.");
    } catch (error) {
      setText(trackingStatus, messageFor(error.message));
    } finally {
      setBusy(false);
    }
  });

  const authResult = new URLSearchParams(window.location.search).get("auth");
  if (authResult === "success") setText(accountStatus, "Sign-in completed. Loading your merchant account…");
  if (authResult?.startsWith("failed")) {
    setText(accountStatus, "Sign-in was not completed. Check the merchant account configuration and try again.");
  }
  loadSession();
}
