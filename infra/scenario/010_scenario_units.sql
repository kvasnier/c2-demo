--
-- PostgreSQL database dump
--

-- Dumped from database version 16.4 (Debian 16.4-1.pgdg110+2)
-- Dumped by pg_dump version 16.4 (Debian 16.4-1.pgdg110+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: units; Type: TABLE DATA; Schema: public; Owner: c2
--

INSERT INTO public.units (id, name, side, unit_type, echelon, sidc, geom, created_at) VALUES ('fcc9d8ce-39d9-44d8-a8f8-1a282330628b', 'New unit', 'ENEMY', 'ARMOR', 'BATTALION', 'SHGPUCA----F', '0101000020E6100000000000108BF64340890C6673981F4840', '2026-02-13 18:07:27.514537+00');
INSERT INTO public.units (id, name, side, unit_type, echelon, sidc, geom, created_at) VALUES ('37b1ba99-efbc-42cc-80a1-4299306d3d1b', 'New unit', 'ENEMY', 'ARMOR', 'BRIGADE', 'SHGPUCA----H', '0101000020E61000000100007832F643401BCB27AAE11D4840', '2026-02-13 18:07:42.159669+00');
INSERT INTO public.units (id, name, side, unit_type, echelon, sidc, geom, created_at) VALUES ('d77898d4-7011-418d-be89-46ed1c3314b8', 'New unit', 'ENEMY', 'ARTILLERY', 'BATTALION', 'SHGPUCF----F', '0101000020E6100000010000C0F8F6434058BEB46270224840', '2026-02-13 18:07:57.467008+00');
INSERT INTO public.units (id, name, side, unit_type, echelon, sidc, geom, created_at) VALUES ('fd7fd4be-579a-475c-91be-2399ce3ccd29', 'New unit', 'FRIEND', 'ARMOR', 'BRIGADE', 'SFGPUCA----H', '0101000020E61000000100008069F3434049310CBA3D204840', '2026-02-13 18:08:34.459095+00');
INSERT INTO public.units (id, name, side, unit_type, echelon, sidc, geom, created_at) VALUES ('201698af-5c0a-4805-9595-d6ce99738d9f', 'New unit', 'FRIEND', 'ARTILLERY', 'BRIGADE', 'SFGPUCF----H', '0101000020E6100000010000E8A8F14340975A719222204840', '2026-02-13 18:08:41.604166+00');
INSERT INTO public.units (id, name, side, unit_type, echelon, sidc, geom, created_at) VALUES ('adc9e453-a0d2-4562-81c6-70e874d7e853', 'New unit', 'FRIEND', 'INFANTRY', 'SECTION', 'SFGPUCI----C', '0101000020E610000001000008B4F34340C2E95685AD1F4840', '2026-02-13 18:08:58.071323+00');
INSERT INTO public.units (id, name, side, unit_type, echelon, sidc, geom, created_at) VALUES ('ddd468e0-5998-4cd5-98fa-e14d5ad33c8b', 'New unit', 'FRIEND', 'INFANTRY', 'SECTION', 'SFGPUCI----C', '0101000020E6100000000000E897F343402D43489AEC1E4840', '2026-02-13 18:09:02.123359+00');
INSERT INTO public.units (id, name, side, unit_type, echelon, sidc, geom, created_at) VALUES ('2e240a63-715c-40cc-a728-64a9b0f96a51', 'New unit', 'FRIEND', 'UAS_PATROL', 'SECTION', 'SFAPMFQP---C', '0101000020E6100000010000C0DCF4434039ABF24E28224840', '2026-02-13 18:11:02.609066+00');
INSERT INTO public.units (id, name, side, unit_type, echelon, sidc, geom, created_at) VALUES ('1b5b8a98-d0c6-4e1f-a3dd-db8548440ff4', 'New unit', 'FRIEND', 'UAS_BOMBER', 'SECTION', 'SFAPMFQB---C', '0101000020E610000001000090DFF44340443600C39D214840', '2026-02-13 18:11:11.579051+00');
INSERT INTO public.units (id, name, side, unit_type, echelon, sidc, geom, created_at) VALUES ('5745d442-1f4f-4817-9c89-32995af9ed41', 'UAV-REC-001', 'FRIEND', 'UAS_RECON', 'SECTION', 'SFAPMFQR---C', '0101000020E61000000100000015F5434070D74A94E71F4840', '2026-02-13 19:50:24.435833+00');
INSERT INTO public.units (id, name, side, unit_type, echelon, sidc, geom, created_at) VALUES ('2d8f8a96-6a1b-4d07-b845-0c20253f02ca', 'UAV-REC-002', 'FRIEND', 'UAS_RECON', 'SECTION', 'SFAPMFQR---C', '0101000020E6100000010000802BF5434034A039DB5A224840', '2026-02-13 19:50:35.406606+00');
INSERT INTO public.units (id, name, side, unit_type, echelon, sidc, geom, created_at) VALUES ('ae21417f-d191-4ca0-816c-098d9ad49ac3', 'UAV-REC-003', 'FRIEND', 'UAS_RECON', 'SECTION', 'SFAPMFQR---C', '0101000020E6100000000000D0DCF343409B2737F1091E4840', '2026-02-13 19:50:44.87563+00');


--
-- PostgreSQL database dump complete
--

