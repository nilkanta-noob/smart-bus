# Smart Bus data notes

- Official WBTC city route directory: https://wbtconline.in/wbtc-city-bus-routes
  - Scraped into `client/src/wbtc-routes.ts` with 131 official city-route entries.
- Official WBTC site: https://wbtconline.in/
- Reported WBTC/Yatri Sathi live tracking coverage: https://www.millenniumpost.in/bengal/where-is-my-bus-features-now-on-yatri-sathi-app-610149
  - The May 2025 report describes the “Where Is My Bus” pilot as 60 government buses on 16 airport-linked routes, with GPS/4G tracking, route maps, ETAs, and gradual expansion.
- GTFS realtime reference for a future official feed adapter: https://gtfs.org/documentation/realtime/reference/
  - Vehicle positions use latitude, longitude, bearing, and speed; TripUpdates carry stop-level ETA/delay data.
- Current implementation uses OpenStreetMap embed for the real Kolkata basemap and a server-side `WBTC_VEHICLE_FEED_URL` adapter. No public WBTC GPS endpoint was found in the verified sources, so the UI explicitly marks live GPS as unavailable until an official endpoint/credential is configured.
