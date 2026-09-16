import { db } from './db.ts';

/**
 * Hotel Malabar delivery-location enforcement.
 *
 * The current delivery service is centered on the Bommasandra / Yarandahalli /
 * Jigani / Electronic City / Hebbagodi / Attibele belt. This coarse geofence
 * is intentionally wider than the named delivery areas so that normal GPS
 * drift does not reject a genuine nearby customer. The selected delivery area
 * must still be an active area configured by the admin.
 *
 * This is a service-zone check, not a road-distance calculation. Delivery
 * pricing continues to use the configured distanceKm for the selected area.
 */
const SERVICE_ZONE = {
  minLatitude: 12.73,
  maxLatitude: 12.90,
  minLongitude: 77.60,
  maxLongitude: 77.80,
};

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isInsideHotelMalabarServiceZone(latitude: number, longitude: number): boolean {
  return (
    latitude >= SERVICE_ZONE.minLatitude &&
    latitude <= SERVICE_ZONE.maxLatitude &&
    longitude >= SERVICE_ZONE.minLongitude &&
    longitude <= SERVICE_ZONE.maxLongitude
  );
}

let installed = false;

export function installDeliveryGeofence() {
  if (installed) return;
  installed = true;

  const originalCreateOrder = db.createOrder.bind(db);

  db.createOrder = ((data: Parameters<typeof db.createOrder>[0]) => {
    if (!isFiniteCoordinate(data.customerLatitude) || !isFiniteCoordinate(data.customerLongitude)) {
      throw new Error(
        'Delivery location is required. Please tap “📍 Use My Current Location” at checkout before placing the order.'
      );
    }

    if (!isInsideHotelMalabarServiceZone(data.customerLatitude, data.customerLongitude)) {
      throw new Error(
        'Sorry, this location is outside Hotel Malabar delivery service area. We currently deliver only around Bommasandra, Yarandahalli, Jigani, Electronic City, Hebbagodi and Attibele.'
      );
    }

    const requestedArea = String(data.deliveryArea || '').trim().toLowerCase();
    const activeAreas = db.getDeliveryAreas().filter((area) => area.isActive);
    const selectedArea = activeAreas.find(
      (area) => area.name.trim().toLowerCase() === requestedArea
    );

    if (!selectedArea) {
      throw new Error('Please select a valid active delivery area before placing the order.');
    }

    return originalCreateOrder(data);
  }) as typeof db.createOrder;
}
