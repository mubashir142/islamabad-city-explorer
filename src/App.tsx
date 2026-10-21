import { useEffect, useRef } from 'react'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

const islamabad: L.LatLngExpression = [33.6844, 73.0479]

function App() {
  const mapElement = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = mapElement.current
    if (!element) return

    const map = L.map(element, {
      center: islamabad,
      zoom: 12,
      minZoom: 9,
      maxZoom: 19,
      zoomControl: false,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map)

    return () => {
      map.remove()
    }
  }, [])

  return (
    <main className="explorer">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Islamabad City Explorer home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <path d="M16 3.5 27.5 25 16 21.5 4.5 25 16 3.5Z" />
              <path d="M16 3.5v18" />
            </svg>
          </span>
          <span className="brand-copy">
            <strong>City Explorer</strong>
            <span>ISLAMABAD, PAKISTAN</span>
          </span>
        </a>
        <div className="topbar-note">
          <span className="status-dot" />
          Community map
        </div>
      </header>

      <div className="workspace">
        <aside className="intro-panel">
          <p className="eyebrow">YOUR CITY, AT A GLANCE</p>
          <h1>Explore Islamabad</h1>
          <p className="intro-copy">
            Find your way around the capital. Explore the city map and discover
            local places as they are added.
          </p>

          <div className="location-card">
            <span className="location-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
                <circle cx="12" cy="10" r="2.3" />
              </svg>
            </span>
            <span>
              <strong>Islamabad Capital Territory</strong>
              <small>33.6844° N, 73.0479° E</small>
            </span>
          </div>

          <div className="panel-divider" />

          <section className="places-preview" aria-labelledby="places-heading">
            <div className="section-heading">
              <h2 id="places-heading">Places to explore</h2>
              <span className="coming-soon">COMING SOON</span>
            </div>
            <p>
              Hospitals, universities, parks, and public offices will appear
              here in the next update.
            </p>
            <div className="category-preview" aria-label="Upcoming place categories">
              <span><i className="category-dot hospital" />Hospitals</span>
              <span><i className="category-dot university" />Universities</span>
              <span><i className="category-dot park" />Parks</span>
              <span><i className="category-dot office" />Public offices</span>
            </div>
          </section>

          <div className="data-note">
            <span aria-hidden="true">ⓘ</span>
            <p>
              This community map is not an official source of city information.
            </p>
          </div>
        </aside>

        <section className="map-panel" aria-label="Islamabad map">
          <div className="map-heading">
            <div>
              <span className="map-kicker">INTERACTIVE MAP</span>
              <h2>Islamabad &amp; surroundings</h2>
            </div>
            <span className="map-coordinate">ICT · PAKISTAN</span>
          </div>
          <div
            ref={mapElement}
            className="map-canvas"
            role="application"
            aria-label="Interactive OpenStreetMap centered on Islamabad. Use the zoom controls or your mouse to explore."
          />
          <div className="map-footer">
            <span><i className="live-dot" />Map ready to explore</span>
            <span>Pan to move · Scroll to zoom</span>
          </div>
        </section>
      </div>
    </main>
  )
}

export default App
