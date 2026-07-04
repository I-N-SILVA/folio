-- The original CHECK constraint omitted 'page_click' (heatmaps) and
-- 'gate_unlock' (lead capture), both of which the API and client have
-- always sent. Every insert of those types has been silently rejected.
ALTER TABLE public.events DROP CONSTRAINT events_event_type_check;

ALTER TABLE public.events ADD CONSTRAINT events_event_type_check CHECK (event_type IN (
  'book_open','page_view','page_flip','hotspot_click',
  'modal_open','modal_close','video_play','video_complete',
  'audio_play','cta_click','book_complete','page_click','gate_unlock'
));
