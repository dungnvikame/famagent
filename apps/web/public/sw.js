// FamAgent service worker: installable app + "sắp hết" push reminders (plans/260924-1431-shopping-plan-redesign, phase 4).
// No offline caching of family data: pages always come from the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : "" }; }
  const title = data.title || "FamAgent";
  event.waitUntil(self.registration.showNotification(title, { body: data.body || "", tag: data.tag || "famagent", icon: "/icon.svg", badge: "/icon.svg", data: { url: data.url || "/shopping" } }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/shopping", self.location.origin);
  const url = target.origin === self.location.origin ? target.href : new URL("/shopping", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const open = windows.find((client) => client.url.startsWith(self.location.origin));
    if (open) { open.navigate(url); return open.focus(); }
    return self.clients.openWindow(url);
  }));
});
