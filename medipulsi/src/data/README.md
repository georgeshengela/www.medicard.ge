# OpenStreetMap snapshot

Imported 2026-09-19; © OpenStreetMap contributors, licensed under [ODbL 1.0](https://www.openstreetmap.org/copyright).

Sources:

- Bounded map extract: https://api.openstreetmap.org/api/0.6/map?bbox=44.744,41.703,44.772,41.717
- [Vake Park relation 17233994](https://www.openstreetmap.org/relation/17233994), retrieved through /api/0.6/relation/17233994/full.
- [Vake neighbourhood relation 16355086](https://www.openstreetmap.org/relation/16355086), retrieved through /api/0.6/relation/16355086/full. This is an OSM neighbourhood, not a cadastral or municipal authoritative boundary.

The bundled JSON contains only coordinates, graph references, highway classifications, names and provenance. Contributor account metadata from the raw XML is not bundled.

Eligible types: footway, path, pedestrian, steps, living_street. Explicit private/no foot access is excluded. Ways tagged as areas contribute their mapped perimeter edges, not invented shortcuts across the area. Intersections connect through shared OSM node IDs; grade-separated crossings are not automatically joined.

The playable demo zone uses the largest connected pedestrian component within the park boundary: 328 edges, about 4,194 m. Other disconnected park components are excluded from the pilot completion denominator, so the demo has a reachable target. The larger snapshot includes 3,744 edges in the Vake neighbourhood for nearby GPS matching; it does not represent a complete city or full district import.

Per-edge covered intervals are merged before summing length. The 85% completion threshold applies to playable graph length, not park land area. Park/parent area share is computed separately from the closed outer boundary polygons with a local planar approximation (about 10.37%). It is shown as an approximate OSM-based game-zone share, not a claim that every square metre was visited. Both imported boundary relations contain a single joined outer ring and no inner members.

No claim of on-site verification, barrier completeness, opening-hours validity or accessible routing is made. Real deployment requires field review, exclusions for closures/unsafe segments, and complete licensed dataset management.

## Mission catalogue, September 2026

`../missions.ts` adds 24 editorial mission targets, with deliberately approximate circular gameplay areas. These are not imported legal boundaries, park polygons, route directions or a claim of complete Tbilisi coverage. Goal distances, 60-second movement requirements, names of stamps and descriptions are product choices. No location is advertised as currently open or barrier-free.

Place context was checked against the Georgian National Tourism Administration's [Turtle Lake](https://georgia.travel/turtle-lake), [Lisi Lake](https://georgia.travel/lisi-lake), [Mziuri](https://georgia.travel/family-attractions/mziuri-park), [Rike Park](https://georgia.travel/family-attractions/rike-park), [Mtatsminda](https://georgia.travel/mtatsminda), [Liberty Square](https://georgia.travel/liberty-square-tbilisi), and [Botanical Garden](https://georgia.travel/the-botanical-garden) descriptions. User-facing stories are original game copy, not copied historical passages. Museum/church admission and rides are never completion requirements.

Coordinate cross-checks include OSM-derived map entries for [Vera Park](https://mapcarta.com/W58071509), [Dedaena](https://mapcarta.com/W174304310), [Dighomi Forest Park](https://mapcarta.com/W142588810), [Mushtaidi](https://mapcarta.com/W56660039), [Lisi](https://mapcarta.com/13572048), and the [Mtatsminda upper station](https://mapcarta.com/N2813131204). [Kikvidze](https://geogid.ge/place/6/kikvidzis-parki/) was cross-checked separately. The [9 April Park](https://commons.wikimedia.org/wiki/Category:9th_of_April_Park) coordinate is 41.6983, 44.7994; [Gudiashvili Square](https://www.wikidata.org/wiki/Q12866081) is around 41.691031, 44.803628. The botanical entry target uses the geotagged [entrance photograph](https://commons.wikimedia.org/wiki/File:Entrance_to_the_National_Botanical_Garden_of_Georgia,_Tbilisi.jpg) as a location reference; the photograph itself is not included. Targets still require on-site review before a public campaign. Remaining city targets use approximate landmark centres, linked to their map in the catalogue.

Mission counts are independent of road coverage. Mission progress only consumes accepted movement within a selected zone; it never creates OSM coverage edges outside the imported network or adds arbitrary mission-circle areas to the Vake area calculation.
