const CACHE_NAME = 'mj-trainer-cache-v1.5.0';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './src/js/app.js',
    './src/js/storage.js',
    './src/js/constants.js',
    './src/js/engine/shanten.js',
    './src/js/engine/handGenerator.js',
    './src/js/components/Tile.js',
    './manifest.json',
    './assets/icons/icon.svg',
    './assets/tailwind.js'
];

// Install Event
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
});

// Activate Event
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Clearing old cache');
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch Event
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached response if found, else fetch from network
                return response || fetch(event.request);
            })
    );
});

// Update Event
self.addEventListener('message', event => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});