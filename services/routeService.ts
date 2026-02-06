
export interface RoutePoint {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  type: string;
  phone: string;
}

export interface OptimizedRoute {
  points: RoutePoint[];
  totalDistance: number;
  totalDuration: number;
}

export const routeService = {
  /**
   * Otimiza a rota usando a API do OSRM (Trip Service)
   * Resolve o problema do caixeiro viajante para os pontos fornecidos.
   */
  optimizeRoute: async (points: RoutePoint[]): Promise<OptimizedRoute> => {
    if (points.length < 2) {
      return { points, totalDistance: 0, totalDuration: 0 };
    }

    // OSRM usa formato longitude,latitude
    const coordinates = points.map(p => `${p.lng},${p.lat}`).join(';');
    const url = `https://router.project-osrm.org/trip/v1/driving/${coordinates}?source=first&overview=full&geometries=geojson`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.code !== 'Ok') {
        throw new Error('Falha ao calcular rota otimizada');
      }

      // OSRM Trip retorna os waypoints na ordem otimizada
      // data.waypoints contém a ordem via 'waypoint_index' e 'trips_index'
      // Mas o mais simples é usar o array 'trips[0].legs' ou reconstruir pela ordem sugerida
      
      const trip = data.trips[0];
      const waypoints = data.waypoints.sort((a: any, b: any) => a.waypoint_index - b.waypoint_index);
      
      const optimizedPoints = waypoints.map((wp: any) => {
        return points[wp.trips_index];
      });

      return {
        points: optimizedPoints,
        totalDistance: trip.distance, // em metros
        totalDuration: trip.duration, // em segundos
      };
    } catch (error) {
      console.error('Erro na roteirização:', error);
      // Fallback: retorna a ordem original se a API falhar
      return { points, totalDistance: 0, totalDuration: 0 };
    }
  }
};
