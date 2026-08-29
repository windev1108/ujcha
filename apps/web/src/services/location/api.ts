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