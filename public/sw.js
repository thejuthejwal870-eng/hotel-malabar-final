/* Hotel Malabar background order notification service worker. */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : 'New order received.' };
  }

  const title = data.title || 'HOTEL MALABAR — New Order';
  const options = {
    body: data.body || 'A new customer order has been received.',
    tag: data.orderId ? 'hotel-malabar-order-' + data.orderId : 'hotel-malabar-new-order',
    renotify: true,
    requireInteraction: true,
    vibrate: [250, 120, 250, 120, 400],
    data: {
      url: data.url || '/admin',
      orderId: data.orderId || '',
      orderNumber: data.orderNumber || '',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/admin';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === self.location.origin) {
            client.focus();
            if ('navigate' in client && clientUrl.pathname !== targetUrl) client.navigate(targetUrl);
            return;
          }
        } catch {}
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
