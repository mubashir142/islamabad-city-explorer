# Islamabad City Explorer

A responsive city map for exploring Islamabad. The map uses Leaflet and
OpenStreetMap tiles. Place data is community-maintained and is not official city
data.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. To create a production build, run
`npm run build`.

## Validate changes

```sh
npm run lint
npx tsc --noEmit
npm run build
```

## Publish the site

The site deploys to GitHub Pages whenever changes are pushed to `main`:
<https://mubashir142.github.io/islamabad-city-explorer/>. In the repository's
**Settings → Pages**, set the build and deployment source to **GitHub Actions**.
The first deployment will publish the production build at that address.

## Explore the map

- Search places by name or street, then select a result to focus the map and
  view its details.
- Use category filters to narrow the results list.
- Toggle map layers independently to show or hide each category.
- Select any map marker to open its OpenStreetMap record.
- Switch between day and night mode; the choice is saved in this browser and
  follows the system theme on first visit.

## OpenStreetMap places dataset

The bundled GeoJSON snapshot is [`public/data/islamabad-services.geojson`](public/data/islamabad-services.geojson).
It contains 967 point features from these OpenStreetMap tags:

| Category | OSM tags | Features |
| --- | --- | ---: |
| Hospitals | `amenity=hospital` | 152 |
| Universities | `amenity=university` | 60 |
| Parks | `leisure=park` | 576 |
| Public offices | `office=government` or `amenity=townhall` | 179 |

### Source and extraction

- **Source:** OpenStreetMap contributors, queried through the
  [Overpass API](https://overpass.kumi.systems/).
- **Extraction date:** 2026-10-22.
- **OSM snapshot timestamp reported by Overpass:** 2026-07-28 02:16:18 UTC.
- **Search bounds:** latitude 33.5–33.9, longitude 72.8–73.3. The Overpass
  query requests nodes, ways, and relations matching the tags listed above
  within this bounding box.
- **Attribution:** © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
  OpenStreetMap data is available under the
  [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/).
  Follow the ODbL attribution and share-alike requirements when reusing or
  distributing the dataset.

The GeoJSON uses each OSM node's coordinates. Ways and relations are
represented by Overpass's approximate center point, not by their full geometry
or boundaries. The features retain their OSM type, ID, source tags, and a link
to the source OSM element. An English name is used when the primary name is
unavailable; entries without a usable name remain in the data without one.

### Coverage and limitations

- This is a rectangular search area, not an Islamabad Capital Territory
  boundary. It includes nearby areas outside Islamabad, including parts of
  Rawalpindi.
- The snapshot contains only features using the exact tags listed above. Places
  tagged differently, unmapped places, and changes after the OSM snapshot may
  be missing.
- OSM is community-maintained. The dataset may be incomplete, outdated, or
  incorrectly tagged; it is not an official directory and should not be used
  as an authoritative source.
- Some source text values that could not be decoded cleanly are omitted rather
  than included as corrupted text. As a result, some features have no display
  name.
- This is a static snapshot; it does not update automatically. The application
  loads the snapshot bundled with the app.
