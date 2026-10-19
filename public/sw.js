// Service Worker des Pfötli Buchs: zeigt Push-Nachrichten an (Chat, Mitteilungen, Fahrten).
// Er speichert bewusst nichts zwischen, damit nach jedem Update sofort die neue Version läuft.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data?.json()?.data ?? {};
  } catch {
    // Unlesbare Nachricht: trotzdem einen Hinweis zeigen (Browser verlangen das).
  }
  const link = d.link || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenster) => {
      // Wer genau diesen Chat gerade offen vor sich hat, braucht keinen Hinweis.
      const offen = fenster.some((f) => f.focused && f.visibilityState === "visible" && new URL(f.url).pathname + new URL(f.url).search === link);
      if (offen) return;
      return self.registration.showNotification(d.titel || "NeLuna's Pfötli Buch", {
        body: d.text || "",
        tag: d.tag || undefined,
        renotify: !!d.tag,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { link },
      });
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const link = e.notification.data?.link || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenster) => {
      const f = fenster.find((x) => new URL(x.url).origin === self.location.origin);
      if (!f) return self.clients.openWindow(link);
      return f.focus().then((g) => g.navigate(link)).catch(() => self.clients.openWindow(link));
    }),
  );
});
