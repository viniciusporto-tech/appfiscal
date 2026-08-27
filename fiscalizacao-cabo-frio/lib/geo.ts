// Estrutura padronizada da localização retornada pelo celular.
export type GeoPosition = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

// Solicita ao navegador a localização atual do agente.
export function getCurrentPosition(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    // Garante que o navegador possui a API de geolocalização.
    if (!("geolocation" in navigator)) {
      reject(new Error("Este aparelho não oferece geolocalização pelo navegador."));
      return;
    }

    // Solicita uma leitura atual do GPS.
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Converte o resultado nativo para o formato simples usado pelo sistema.
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        // Retorna um erro compreensível para a tela de fiscalização.
        reject(new Error(`Não foi possível obter a localização: ${error.message}`));
      },
      {
        // Pede maior precisão quando o aparelho permitir.
        enableHighAccuracy: true,
        // Aguarda no máximo 15 segundos por uma posição.
        timeout: 15000,
        // Aceita posição em cache de no máximo 30 segundos.
        maximumAge: 30000,
      }
    );
  });
}
