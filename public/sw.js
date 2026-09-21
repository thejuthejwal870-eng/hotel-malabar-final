/* Hotel Malabar background push bridge.
 * Native Android Admin is responsible for audible order alerts.
 * This service worker deliberately NEVER creates a system notification
 * or notification tone for an order.
 */
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

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const message = {
        type: data.type === 'NEW_ORDER' ? 'HOTEL_MALABAR_NEW_ORDER' : 'HOTEL_MALABAR_ORDER_STATUS',
        orderId: data.orderId || '',
        orderNumber: data.orderNumber || '',
      };

      for (const client of clients) {
        try {
          client.postMessage(message);
        } catch {}
      }

      // Intentionally do not call showNotification().
      // No browser/Chrome notification tone is part of the Hotel Malabar alert flow.
    })
  );
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
