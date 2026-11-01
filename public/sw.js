self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : { title: "Smart Bus", body: "Your bus update is ready." };
  event.waitUntil(self.registration.showNotification(data.title || "Smart Bus", {
    body: data.body || "Your bus update is ready.",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: { url: "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/"));
});
