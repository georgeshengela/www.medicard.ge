import { api } from '@/lib/api';

export type WeatherProductEvent =
  | 'weather_card_viewed'
  | 'weather_detail_opened'
  | 'weather_recommendation_shown'
  | 'weather_push_opened';

/** Category only — never GPS. */
export function logWeatherEvent(
  kind: WeatherProductEvent,
  category?: string,
): void {
  void api.push
    .syncProductEvents({
      events: [
        {
          kind,
          category: category || undefined,
          occurredAt: new Date().toISOString(),
        },
      ],
    })
    .catch(() => undefined);
}
