-- 'gate_view' records a reader reaching the lead gate. Without it the dashboard
-- could only show unlocks, which is a count with no denominator — an author had
-- no way to tell whether their gate copy converts or whether people simply never
-- get that far.
--
-- Keep in sync with EventType in lib/book-schema.ts and the enum in
-- app/api/events/route.ts.
ALTER TABLE public.events DROP CONSTRAINT events_event_type_check;

ALTER TABLE public.events ADD CONSTRAINT events_event_type_check CHECK (event_type IN (
  'book_open','page_view','page_flip','hotspot_click',
  'modal_open','modal_close','video_play','video_complete',
  'audio_play','cta_click','book_complete','page_click',
  'gate_view','gate_unlock'
));
