self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { body: event.data ? event.data.text() : "Tienes una actualización." }; }
  const title = data.title || "EL CAIMAN CAR WASH";
  const options = {
    body: data.body || data.message || "Tienes una nueva actualización de reservas.",
    icon: "./logo.png",
    badge: "./logo.png",
    data: { url: data.url || "./" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "./", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const client of list) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) return client.focus();
    }
    return clients.openWindow(target);
  }));
});
