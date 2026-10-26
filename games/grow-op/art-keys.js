// Maps gameplay thumbnail ids (bldg_<buildingId>) onto the art lane's
// go-card-<role> and go-icon-<role> textures. One table, used by the
// build menu and the map badges.

import * as Art from './art.js';

const BUILDING_ROLE = {
  plantation: 'plantation',
  coffee_estate: 'coffee_estate',
  highland_farm: 'highland_farm',
  drying_barn: 'lab',
  packaging_mill: 'lab',
  chem_lab: 'lab',
  warehouse: 'warehouse',
  transport_depot: 'distribution',
  river_pier: 'distribution',
  aerodrome: 'distribution',
  taxi_co: 'front',
  salsa_club: 'front',
  banco_regional: 'front'
};

const ROLE = {
  launder: 'front',
  front: 'front',
  stash: 'stash',
  lab: 'lab',
  distribution: 'distribution',
  warehouse: 'warehouse',
  safehouse: 'safehouse',
  hq: 'hq',
  produce: 'plantation',
  process: 'lab',
  export: 'distribution',
  plantation: 'plantation',
  coffee_estate: 'coffee_estate',
  highland_farm: 'highland_farm'
};

const PROPERTY_ROLE = {
  gas_station: 'front',
  laundromat: 'front',
  diner: 'front',
  pawn: 'stash',
  apartments: 'safehouse',
  warehouse_old: 'warehouse',
  fish_house: 'distribution',
  garage: 'distribution',
  office: 'hq',
  car_lot: 'front',
  bank: 'front',
  motel: 'safehouse',
  nightclub: 'front',
  casino: 'front',
  hangar: 'distribution',
  freight_shed: 'warehouse',
  villa: 'safehouse',
  hacienda: 'plantation',
  farmhouse: 'plantation',
  sawmill: 'warehouse',
  river_dock: 'distribution',
  airstrip: 'distribution',
  outpost: 'hq'
};

export function roleForBuilding(id) {
  return BUILDING_ROLE[id] || ROLE[id] || 'warehouse';
}

export function roleForRole(role) {
  return ROLE[role] || 'warehouse';
}

export function roleForProperty(type) {
  return PROPERTY_ROLE[type] || 'warehouse';
}

export function cardKeyForBuilding(id) {
  return `go-card-${roleForBuilding(id)}`;
}

export function iconKeyForBuilding(id) {
  return `go-icon-${roleForBuilding(id)}`;
}

export function cardKeyForRole(role) {
  return `go-card-${roleForRole(role)}`;
}

export function iconKeyForRole(role) {
  return `go-icon-${roleForRole(role)}`;
}

export function iconKeyForProperty(type) {
  return `go-icon-${roleForProperty(type)}`;
}

const urls = new Map();

export function artURL(key) {
  if (!key) return '';
  if (urls.has(key)) return urls.get(key);
  let url = '';
  try {
    const canvas = Art.bakeCanvas(key);
    if (canvas && canvas.toDataURL) url = canvas.toDataURL('image/png');
  } catch (err) {
    url = '';
  }
  urls.set(key, url);
  return url;
}
