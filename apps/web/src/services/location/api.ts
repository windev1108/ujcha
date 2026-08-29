export interface ReverseGeocodeResult {
    place_id: number
    licence: string
    osm_type: string
    osm_id: number
    lat: string
    lon: string
    class: string
    type: string
    place_rank: number
    importance: number
    addresstype: string
    name: string
    display_name: string
    address: Address
    boundingbox: string[]
}

export interface Address {
    house_number: string
    road: string
    suburb: string
    city: string
    'ISO3166-2-lvl4': string;
    postcode: string
    country: string
    country_code: string
}

export interface LocationSearchResult {
    place_id: number; licence: string; osm_type: string; osm_id: number; lat: string; lon: string; class: string; type: string; place_rank: number; importance: number; addresstype: string; name: string; display_name: string; address: Partial<Address>; boundingbox: string[];
}
export interface LocationSearchParams { query: string; viewbox?: string; bounded?: boolean; countrycodes?: string; limit?: number; lang?: string; }

export async function reverseGeocode(
    lat: number,
    lon: number,
    lang: string
): Promise<ReverseGeocodeResult> {
    const response = await fetch(
        `/api/location/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&lang=${encodeURIComponent(lang)}`,
    );

    if (!response.ok) {
        throw new Error(
            `Reverse geocoding failed: ${response.status}`,
        );
    }

    return response.json();
}

export async function searchLocation(params: LocationSearchParams,): Promise<LocationSearchResult[]> {
    const { query, viewbox, bounded = true, countrycodes = 'vn', limit = 6, lang = 'vi', } = params;
    const trimmedQuery = query.trim(); if (!trimmedQuery) { return []; }
    const searchParams = new URLSearchParams({ q: trimmedQuery, limit: String(limit), lang, countrycodes, });
    if (viewbox) { searchParams.set('viewbox', viewbox); }
    if (bounded) { searchParams.set('bounded', '1'); }
    const response = await fetch(`/api/location/search?${searchParams.toString()}`,
        { method: 'GET', headers: { Accept: 'application/json', }, cache: 'no-store', },);
    if (!response.ok) { throw new Error(`Location search failed: ${response.status}`,); }
    return response.json();
}