-- Keep new member registration working for staff and server-side flows.
-- The primary member-card migration creates the sequence; authenticated
-- staff and service-role inserts require USAGE to obtain the next ID.
GRANT USAGE ON SEQUENCE public.member_card_number_seq TO authenticated, service_role;
