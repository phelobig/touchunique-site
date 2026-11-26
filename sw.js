/* Touch Unique Studio — notifications push du site (messages reçus dans l’app). */
'use strict';

self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

function safeURL(raw) {
  if (!raw) return './#contact';
  try {
    var u = new URL(String(raw), self.registration.scope);
    if (u.origin !== self.location.origin) return './#contact';
    return u.href;
  } catch (e) { return './#contact'; }
}

self.addEventListener('push', function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : '' }; }
  var title = String(data.title || 'Touch Unique Studio').slice(0, 80);
  var body = String(data.body || 'Vous avez un nouveau message.').slice(0, 300);
  event.waitUntil(self.registration.showNotification(title, {
    body: body,
    icon: 'ic_launcher_192.png',
    badge: 'ic_launcher_192.png',
    tag: 'tus-message-' + String(data.thread || 'site').slice(0, 40),
    data: { url: safeURL(data.url) }
  }));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = safeURL(event.notification.data && event.notification.data.url);
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if ('focus' in list[i] && list[i].url === url) return list[i].focus();
    }
    for (var j = 0; j < list.length; j++) {
      if ('focus' in list[j]) return list[j].focus();
    }
    return self.clients.openWindow(url);
  }));
});
