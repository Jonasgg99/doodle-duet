// Service worker for notifications only. No fetch handler: it never caches or serves the app.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let m = {};
  try {
    m = e.data.json();
  } catch {}
  e.waitUntil(
    self.registration.showNotification(m.title || "Doodle Duet", {
      body: m.body || "",
      icon: "icons/icon-192.png",
      tag: "doodle-duet", // a newer one replaces an unread older one
      renotify: true,
      data: { url: m.url || self.registration.scope },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || self.registration.scope;
  e.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const tab = open.find((c) => c.url.startsWith(self.registration.scope));
      return tab ? tab.focus() : self.clients.openWindow(url); // an open game updates live
    })()
  );
});
