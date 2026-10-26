// Smuggle legs. Internal valley trucks stay on the road graph.
// These are planned export runs: capacity, risk, and travel time.

export const VEHICLES = {
  truck: {
    id: 'truck',
    name: 'Box truck',
    capacity: 4,
    risk: 0.16,
    seconds: 16,
    pay: 1,
    heat: 4,
    needs: null
  },
  boat: {
    id: 'boat',
    name: 'Night boat',
    capacity: 8,
    risk: 0.26,
    seconds: 28,
    pay: 1.28,
    heat: 6,
    needs: 'pier'
  },
  plane: {
    id: 'plane',
    name: 'Bush plane',
    capacity: 14,
    risk: 0.4,
    seconds: 20,
    pay: 1.55,
    heat: 11,
    needs: 'strip'
  }
};

export const VEHICLE_LIST = Object.values(VEHICLES);
