'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

type MapComponentProps = {
  userLat: number
  userLng: number
  centerLat: number
  centerLng: number
  radius: number
}

delete (L.Icon.Default.prototype as any)._getIconUrl

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const isValidCoordinate = (value: number) => Number.isFinite(value)

export default function MapComponent({
  userLat,
  userLng,
  centerLat,
  centerLng,
  radius,
}: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const hasValidCoordinates =
    isValidCoordinate(userLat) &&
    isValidCoordinate(userLng) &&
    isValidCoordinate(centerLat) &&
    isValidCoordinate(centerLng) &&
    isValidCoordinate(radius)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || !hasValidCoordinates) return

    const map = L.map(mapRef.current).setView([centerLat, centerLng], 18)

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '(c) OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    const geofenceCircle = L.circle([centerLat, centerLng], {
      color: '#2563eb',
      fillColor: '#10b981',
      fillOpacity: 0.12,
      weight: 2,
      radius,
    }).addTo(map)

    L.marker([centerLat, centerLng], {
      title: 'Office Location',
    })
      .bindPopup('Office Location')
      .addTo(map)

    L.marker([userLat, userLng], {
      icon: L.icon({
        iconUrl:
          'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJ3aGl0ZSIgc3Ryb2tlPSIjMjU2M2ViIiBzdHJva2Utd2lkdGg9IjIuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIvPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjMiIGZpbGw9IiMyNTYzZWIiLz48L3N2Zz4=',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      }),
      title: 'Your Location',
    })
      .bindPopup('Your Location')
      .addTo(map)

    const userPoint = L.latLng(userLat, userLng)
    const geofenceBounds = geofenceCircle.getBounds()
    const bounds = geofenceBounds.extend(userPoint)

    map.fitBounds(bounds, {
      animate: false,
      maxZoom: 18,
      padding: [28, 28],
    })

    setTimeout(() => {
      map.invalidateSize()
    }, 0)

    mapInstanceRef.current = map

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [userLat, userLng, centerLat, centerLng, radius, hasValidCoordinates])

  if (!hasValidCoordinates) {
    return (
      <div className="flex h-64 w-full items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-4 text-center text-sm font-semibold text-amber-900">
        Koordinat kantor belum valid. Isi NEXT_PUBLIC_GEOFENCE_LAT dan NEXT_PUBLIC_GEOFENCE_LNG di .env.local.
      </div>
    )
  }

  return (
    <div
      ref={mapRef}
      className="h-72 w-full overflow-hidden rounded-lg border border-slate-200 sm:h-80 lg:h-64"
    />
  )
}
