type NominatimResponse = {
  display_name?: string;
  address?: Record<string, string | undefined>;
};

export async function reverseGeocode(latitude: number, longitude: number) {
  const endpoint = new URL("https://nominatim.openstreetmap.org/reverse");
  endpoint.searchParams.set("format", "jsonv2");
  endpoint.searchParams.set("lat", String(latitude));
  endpoint.searchParams.set("lon", String(longitude));
  endpoint.searchParams.set("zoom", "18");
  endpoint.searchParams.set("addressdetails", "1");
  endpoint.searchParams.set("accept-language", "pt-BR");

  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "pt-BR,pt;q=0.9",
      "User-Agent": "FiscalizacaoCaboFrio/0.5 (sistema interno de fiscalizacao)",
    },
    cache: "no-store",
  });

  if (!response.ok) throw new Error("Não foi possível converter o GPS em endereço.");

  const data = (await response.json()) as NominatimResponse;
  const address = data.address ?? {};
  const road = address.road ?? address.pedestrian ?? address.residential ?? address.footway ?? address.path;
  const number = address.house_number;
  const district = address.suburb ?? address.neighbourhood ?? address.quarter ?? address.city_district;
  const city = address.city ?? address.town ?? address.municipality ?? address.village;
  const state = address.state;
  const postcode = address.postcode;
  const parts = [
    [road, number].filter(Boolean).join(", "),
    district,
    city,
    state,
    postcode ? `CEP ${postcode}` : undefined,
  ].filter(Boolean);

  return {
    address: parts.length ? parts.join(" - ") : data.display_name ?? null,
    displayName: data.display_name ?? null,
    details: { road, number, district, city, state, postcode },
  };
}
