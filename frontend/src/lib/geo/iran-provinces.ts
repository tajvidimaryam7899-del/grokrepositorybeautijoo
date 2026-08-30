/**
 * Iran province/city dataset — 31 provinces, full official cities (major first).
 * Source: amar.org.ir via premier213/json-list-iran-cities.
 */
import dataA from './iran-provinces-data-a.json';
import dataB from './iran-provinces-data-b.json';

export type IranCity = { name: string; lat: number; lng: number };
export type IranProvince = { name: string; cities: IranCity[] };

export const IRAN_PROVINCES: IranProvince[] = [
  ...(dataA as IranProvince[]),
  ...(dataB as IranProvince[]),
];

export function citiesOf(province: string): IranCity[] {
  return IRAN_PROVINCES.find((p) => p.name === province)?.cities ?? [];
}

export function findCity(province: string, city: string): IranCity | undefined {
  return citiesOf(province).find((c) => c.name === city);
}

export function provinceNames(): string[] {
  return IRAN_PROVINCES.map((p) => p.name);
}
