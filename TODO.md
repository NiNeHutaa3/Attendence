# TODO

## Geofence validation fix
- [ ] Update `src/utils/geolocation.ts` to use tolerant radius check: `dist <= radius` and require `bestSample.accuracy <= MAX_ACCEPTABLE_ACCURACY_METERS`.
- [ ] Ensure `issues` differentiate: if fail due to accuracy, add issue text about GPS accuracy; if fail due to radius, add issue text about being outside radius.
- [ ] Update `src/components/dashboard/CheckInComponent.tsx` (required) to show correct title/message based on issue reason (accuracy vs radius) so UI tidak selalu menyebut “di luar radius”.

- [ ] Run `npm run dev` and test check-in near geofence.

