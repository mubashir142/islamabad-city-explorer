import { useEffect, useMemo, useRef, useState } from 'react'
import type { Feature, FeatureCollection, Point } from 'geojson'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

const center: L.LatLngExpression = [33.6844, 73.0479]

const categories = {
  hospital: { label: 'Hospitals', color: '#d96a5d' },
  university: { label: 'Universities', color: '#647dc5' },
  park: { label: 'Parks', color: '#68a476' },
  'public-office': { label: 'Public offices', color: '#d6a64e' },
} as const

type Category = keyof typeof categories
type Properties = {
  category: Category
  name?: string
  osm_type?: 'node' | 'way' | 'relation'
  osm_id?: number
  tags?: Record<string, string>
}
type PlaceGeometry = Point & { coordinates: [number, number] }
type Place = Feature<PlaceGeometry, Properties>
type Dataset = FeatureCollection<PlaceGeometry, Properties>

const categoryKeys: Category[] = [
  'hospital',
  'university',
  'park',
  'public-office',
]

function getInitialNightMode(): boolean {
  const savedTheme = localStorage.getItem('islamabad-city-explorer-theme')
  return savedTheme === null
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : savedTheme === 'night'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCategory(value: unknown): value is Category {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(categories, value)
  )
}

function isDataset(value: unknown): value is Dataset {
  if (!isRecord(value) || value.type !== 'FeatureCollection') return false
  if (!Array.isArray(value.features)) return false

  return value.features.every((feature) => {
    if (!isRecord(feature) || feature.type !== 'Feature') return false
    if (!isRecord(feature.geometry) || feature.geometry.type !== 'Point') {
      return false
    }

    const coordinates = feature.geometry.coordinates
    const properties = feature.properties
    return (
      Array.isArray(coordinates) &&
      typeof coordinates[0] === 'number' &&
      typeof coordinates[1] === 'number' &&
      Number.isFinite(coordinates[0]) &&
      Number.isFinite(coordinates[1]) &&
      Math.abs(coordinates[0]) <= 180 &&
      Math.abs(coordinates[1]) <= 90 &&
      (feature.id === undefined ||
        typeof feature.id === 'string' ||
        typeof feature.id === 'number') &&
      isRecord(properties) &&
      isCategory(properties.category) &&
      (properties.name === undefined || typeof properties.name === 'string') &&
      (properties.tags === undefined ||
        (isRecord(properties.tags) &&
          Object.values(properties.tags).every(
            (value) => typeof value === 'string',
          ))) &&
      (properties.osm_type === undefined ||
        properties.osm_type === 'node' ||
        properties.osm_type === 'way' ||
        properties.osm_type === 'relation') &&
      (properties.osm_id === undefined ||
        (typeof properties.osm_id === 'number' &&
          Number.isInteger(properties.osm_id)))
    )
  })
}

function placeId(place: Place): string {
  return String(place.id ?? `${place.properties.osm_type}/${place.properties.osm_id}`)
}

function placeName(place: Place): string {
  return (
    place.properties.name ||
    `${categories[place.properties.category].label} (unnamed)`
  )
}

function popupContent(place: Place): HTMLElement {
  const popup = L.DomUtil.create('div', 'place-popup')
  const title = L.DomUtil.create('strong', 'place-popup-title', popup)
  title.textContent = placeName(place)

  const category = L.DomUtil.create('span', 'place-popup-category', popup)
  category.textContent = categories[place.properties.category].label

  const { osm_type, osm_id } = place.properties
  if (osm_type && Number.isInteger(osm_id)) {
    const link = L.DomUtil.create('a', 'place-popup-link', popup)
    link.href = `https://www.openstreetmap.org/${osm_type}/${osm_id}`
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.textContent = 'View on OpenStreetMap'
  }
  return popup
}

function App() {
  const mapElement = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layersRef = useRef(new Map<Category, L.LayerGroup>())
  const markersRef = useRef(new Map<string, L.CircleMarker>())
  const [nightMode, setNightMode] = useState(getInitialNightMode)
  const [places, setPlaces] = useState<Place[]>([])
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all')
  const [visibleLayers, setVisibleLayers] = useState<Set<Category>>(
    () => new Set(categoryKeys),
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!mapElement.current) return

    const map = L.map(mapElement.current, {
      center,
      zoom: 12,
      minZoom: 9,
      maxZoom: 19,
      zoomControl: false,
    })
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map)

    const controller = new AbortController()
    async function loadPlaces() {
      try {
        const response = await fetch('/data/islamabad-services.geojson', {
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(`Dataset request failed (${response.status})`)
        }

        const data: unknown = await response.json()
        if (!isDataset(data)) throw new Error('Places dataset is invalid')
        setPlaces(data.features)
      } catch (error) {
        if (controller.signal.aborted) return
        console.error('Unable to load the Islamabad places dataset.', error)
        setLoadError('Places could not be loaded. Please refresh to try again.')
      }
    }
    void loadPlaces()

    return () => {
      controller.abort()
      map.remove()
      mapRef.current = null
      layersRef.current.clear()
      markersRef.current.clear()
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(
      'islamabad-city-explorer-theme',
      nightMode ? 'night' : 'day',
    )
  }, [nightMode])

  useEffect(() => {
    const map = mapRef.current
    if (!map || places.length === 0) return

    const layers = new Map<Category, L.LayerGroup>()
    const markers = new Map<string, L.CircleMarker>()
    for (const category of categoryKeys) {
      layers.set(category, L.layerGroup().addTo(map))
    }

    for (const place of places) {
      const category = place.properties.category
      const marker = L.circleMarker(
        [place.geometry.coordinates[1], place.geometry.coordinates[0]],
        {
          radius: 5,
          color: '#fff',
          weight: 1.25,
          fillColor: categories[category].color,
          fillOpacity: 0.92,
        },
      )
      marker.bindPopup(popupContent(place))
      marker.on('click', () => setSelectedId(placeId(place)))
      layers.get(category)?.addLayer(marker)
      markers.set(placeId(place), marker)
    }

    layersRef.current = layers
    markersRef.current = markers
    return () => {
      layers.forEach((layer) => layer.remove())
      layersRef.current.clear()
      markersRef.current.clear()
    }
  }, [places])

  useEffect(() => {
    for (const category of categoryKeys) {
      const layer = layersRef.current.get(category)
      if (!layer || !mapRef.current) continue
      if (visibleLayers.has(category)) layer.addTo(mapRef.current)
      else layer.remove()
    }
  }, [visibleLayers, places])

  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const selected = id === selectedId
      marker.setStyle({
        radius: selected ? 8 : 5,
        weight: selected ? 2 : 1.25,
        color: selected ? '#21392a' : '#fff',
      })
      if (selected) marker.bringToFront()
    })
  }, [selectedId, places])

  const counts = useMemo(
    () =>
      places.reduce(
        (total, place) => {
          total[place.properties.category] += 1
          return total
        },
        { hospital: 0, university: 0, park: 0, 'public-office': 0 },
      ),
    [places],
  )

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return places.filter((place) => {
      const matchesCategory =
        categoryFilter === 'all' ||
        place.properties.category === categoryFilter
      const searchableText = [
        place.properties.name,
        place.properties.tags?.['addr:street'],
        place.properties.tags?.['addr:city'],
        place.properties.tags?.['is_in'],
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase()
      return (
        matchesCategory &&
        (!normalizedQuery || searchableText.includes(normalizedQuery))
      )
    })
  }, [places, query, categoryFilter])

  const selectedPlace = places.find((place) => placeId(place) === selectedId)

  function toggleLayer(category: Category) {
    setVisibleLayers((current) => {
      const next = new Set(current)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  function selectPlace(place: Place) {
    const id = placeId(place)
    setSelectedId(id)
    setVisibleLayers((current) =>
      current.has(place.properties.category)
        ? current
        : new Set(current).add(place.properties.category),
    )
    const marker = markersRef.current.get(id)
    const map = mapRef.current
    if (marker && map) {
      layersRef.current.get(place.properties.category)?.addTo(map)
      map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 15), {
        duration: 0.6,
      })
      marker.openPopup()
    }
  }

  const shownResults = results.slice(0, 30)

  return (
    <main className="explorer" data-theme={nightMode ? 'night' : 'day'}>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Islamabad City Explorer home">
          <span className="brand-mark" aria-hidden="true">N</span>
          <span className="brand-copy">
            <strong>City Explorer</strong>
            <span>ISLAMABAD, PAKISTAN</span>
          </span>
        </a>
        <div className="topbar-actions">
          <span className="topbar-note"><i />Community map</span>
          <button
            type="button"
            className="theme-toggle"
            aria-label={nightMode ? 'Switch to day mode' : 'Switch to night mode'}
            aria-pressed={nightMode}
            onClick={() => setNightMode((current) => !current)}
          >
            {nightMode ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" />
              </svg>
            )}
            <span>{nightMode ? 'Day mode' : 'Night mode'}</span>
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar" aria-label="Explore city places">
          <div className="sidebar-heading">
            <p className="eyebrow">ISLAMABAD CAPITAL TERRITORY</p>
            <h1>Find a place</h1>
            <p>Explore community-mapped places across the capital and nearby areas.</p>
          </div>

          <label className="search-box">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search places or streets"
              aria-label="Search places or streets"
            />
            {query && (
              <button
                type="button"
                className="clear-search"
                onClick={() => setQuery('')}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </label>

          <section className="filter-section" aria-labelledby="filter-heading">
            <h2 id="filter-heading">Browse categories</h2>
            <div className="filter-chips">
              <button
                type="button"
                className={categoryFilter === 'all' ? 'active' : ''}
                aria-pressed={categoryFilter === 'all'}
                onClick={() => setCategoryFilter('all')}
              >
                All places <span>{places.length}</span>
              </button>
              {categoryKeys.map((category) => (
                <button
                  type="button"
                  className={categoryFilter === category ? 'active' : ''}
                  aria-pressed={categoryFilter === category}
                  key={category}
                  onClick={() => setCategoryFilter(category)}
                >
                  {categories[category].label}
                  <span>{counts[category]}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="layer-section" aria-labelledby="layers-heading">
            <h2 id="layers-heading">Map layers</h2>
            {categoryKeys.map((category) => (
              <label className="layer-toggle" key={category}>
                <input
                  type="checkbox"
                  checked={visibleLayers.has(category)}
                  onChange={() => toggleLayer(category)}
                />
                <i style={{ backgroundColor: categories[category].color }} />
                <span>{categories[category].label}</span>
                <small>{counts[category]}</small>
              </label>
            ))}
          </section>

          <section className="results-section" aria-labelledby="results-heading">
            <div className="results-heading">
              <h2 id="results-heading">Places</h2>
              <span>{results.length.toLocaleString()} results</span>
            </div>
            {loadError ? (
              <p className="empty-state error-state">{loadError}</p>
            ) : places.length === 0 ? (
              <p className="empty-state">Loading places…</p>
            ) : results.length === 0 ? (
              <p className="empty-state">No places match your search.</p>
            ) : (
              <div className="place-list">
                {shownResults.map((place) => {
                  const id = placeId(place)
                  const category = place.properties.category
                  return (
                    <button
                      type="button"
                      className={`place-result${selectedId === id ? ' selected' : ''}`}
                      key={id}
                      onClick={() => selectPlace(place)}
                    >
                      <i style={{ backgroundColor: categories[category].color }} />
                      <span>
                        <strong>{placeName(place)}</strong>
                        <small>{categories[category].label}</small>
                      </span>
                      <span className="result-arrow" aria-hidden="true">›</span>
                    </button>
                  )
                })}
                {results.length > shownResults.length && (
                  <p className="more-results">
                    Showing 30 of {results.length.toLocaleString()} places. Refine your search to see more.
                  </p>
                )}
              </div>
            )}
          </section>

          {selectedPlace && (
            <section className="selected-place" aria-labelledby="selected-heading">
              <div className="selected-heading">
                <span className="selected-pin" aria-hidden="true">●</span>
                <h2 id="selected-heading">Selected place</h2>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  aria-label="Clear selected place"
                >
                  ×
                </button>
              </div>
              <strong>{placeName(selectedPlace)}</strong>
              <span>{categories[selectedPlace.properties.category].label}</span>
              {selectedPlace.properties.tags?.['addr:street'] && (
                <small>{selectedPlace.properties.tags['addr:street']}</small>
              )}
              {selectedPlace.properties.osm_type &&
                selectedPlace.properties.osm_id !== undefined && (
                  <a
                    href={`https://www.openstreetmap.org/${selectedPlace.properties.osm_type}/${selectedPlace.properties.osm_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View OpenStreetMap record
                  </a>
                )}
            </section>
          )}

          <p className="data-note">
            © OpenStreetMap contributors · Community data, not an official directory.
          </p>
        </aside>

        <section className="map-panel" aria-label="Islamabad map">
          <div className="map-heading">
            <div>
              <span className="map-kicker">INTERACTIVE MAP</span>
              <h2>Islamabad &amp; surroundings</h2>
            </div>
            <span className="map-coordinate">ICT · PAKISTAN</span>
          </div>
          <div className="map-stage">
            <div
              ref={mapElement}
              className="map-canvas"
              role="application"
              aria-label="Interactive OpenStreetMap. Select a marker to see place details."
            />
            <div className="map-legend" aria-label="Map legend">
              <strong>Map legend</strong>
              {categoryKeys.map((category) => (
                <span key={category}>
                  <i
                    className="legend-dot"
                    style={{ backgroundColor: categories[category].color }}
                  />
                  {categories[category].label}
                </span>
              ))}
            </div>
            {loadError && <p className="map-error">{loadError}</p>}
          </div>
          <div className="map-footer">
            <span aria-live="polite">
              <i className={`live-dot${loadError ? ' error' : ''}`} />
              {loadError ||
                (places.length === 0
                  ? 'Loading places…'
                  : `${places.length.toLocaleString()} places mapped`)}
            </span>
            <span>Pan to move · Scroll to zoom</span>
          </div>
        </section>
      </div>
    </main>
  )
}

export default App
