/**
 * English copy for the stock MEDIRUN missions (core/missions.js is generated from medipulsi/src by
 * build-core.mjs and stays Georgian). Mission rows live in the DB and admins may edit them, so a
 * field is swapped for English only while the row still carries the stock Georgian text for it —
 * an admin-edited field is shown as written.
 */
import { MISSIONS } from './core/missions.js';

const DEFAULT_TIP = 'Walk in public pedestrian space. You don’t need to reach the exact centre of the zone.';

export const MISSIONS_EN = Object.freeze({
  vake: { name: 'Vake Park', title: 'A green start', story: 'A familiar park with fresh eyes. Find your calm path.' },
  mziuri: { name: 'Mziuri', title: 'A little sunny day', story: 'A walk in the shade of the trees changes the city’s everyday pace.' },
  vera: { name: 'Vera Garden', title: 'A pause in Vera', story: 'Fit a short walk into the middle of a big day.' },
  dedaena: { name: 'Dedaena Garden', title: 'Sounds of the city', story: 'The river nearby and the city’s rhythm in one walk.' },
  april9: { name: 'April 9 Garden', title: 'A garden in the heart of the city', story: 'Step off your usual route and unlock one more stamp.' },
  mushtaidi: { name: 'Mushtaidi Garden', title: 'A garden’s small story', story: 'Walk slowly and notice what you would usually pass by.', tip: 'Check the local entry rules. Rides on attractions don’t count.' },
  kikvidze: { name: 'Kikvidze Park', title: 'The green road north', story: 'One more neighborhood, one more reason to head out on foot.' },
  dighomi: { name: 'Dighomi Forest Park', title: 'A city of trees', story: 'Pick an accessible trail and collect your share of green kilometers.' },
  freedom: { name: 'Freedom Square', title: 'The heartbeat of Tbilisi', story: 'Your Old Town collection starts here.', tip: 'The goal counts from the sidewalk too. You don’t need to step into the roundabout or the roadway.' },
  orbeliani: { name: 'Orbeliani Square', title: 'A city meeting place', story: 'Discover a small crossing of streets and your next story.' },
  gabriadze: { name: 'Gabriadze Clock Tower', title: 'Time is on your side', story: 'This time, set time aside for a walk.' },
  peace: { name: 'Bridge of Peace', title: 'A tale of two banks', story: 'Keep discovering along the river.', tip: 'The stamp counts from the nearby walking area too; crossing the whole bridge isn’t required.' },
  rike: { name: 'Rike Park', title: 'The rhythm of the Mtkvari', story: 'Find your new path between the bridges and the park.' },
  metekhi: { name: 'Metekhi outdoor area', title: 'The Old Town’s balcony', story: 'Take in the city view from the public outdoor space.', tip: 'You don’t need to enter the church. Stay away from narrow edges and keep to open walking space.' },
  abanotubani: { name: 'Abanotubani', title: 'Where Tbilisi began', story: 'The streets of the old quarter open a new page in your passport.' },
  gudiashvili: { name: 'Gudiashvili Square', title: 'Sololaki details', story: 'One small square and plenty of details to notice.' },
  turtle: { name: 'Turtle Lake', title: 'The lake’s calm pace', story: 'Walk by the shore at your own pace. You don’t have to go all the way around.', tip: 'The zone circle includes the lake, but going into the water isn’t the goal. Use the shoreline paths.' },
  lisi: { name: 'Lisi Lake', title: 'The Lisi horizon', story: 'Collect a kilometer around the lake — in several walks if you like.', tip: 'Walk on the accessible shoreline paths. A full loop and going into the water aren’t needed.' },
  mtatsminda: { name: 'Mtatsminda Park', title: 'The city below you', story: 'The stamp needs a walk in the park; climbing the mountain on foot isn’t required.', tip: 'This mission is about walking. Use the public paths instead of the funicular and rides.' },
  mother: { name: 'Mother of Georgia', title: 'The Sololaki horizon', story: 'Take in one more view of the city.', tip: 'With the stairs and slopes, pick a route that works for you. Climbing walls isn’t needed.' },
  chronicle: { name: 'Chronicle of Georgia', title: 'The city’s big story', story: 'A new place for your Tbilisi collection.', tip: 'The goal is completed in the outdoor area. Stairs may make moving around harder.' },
  sameba: { name: 'Sameba outdoor area', title: 'The city’s silhouette', story: 'Discover a new stamp with a calm walk in the outdoor area.', tip: 'You don’t need to enter the cathedral. Respect the local rules of the space.' },
  botanical: { name: 'Botanical Garden entrance', title: 'Gateway to the green city', story: 'This stamp is for the garden’s public approach.', tip: 'You don’t need a ticket for the mission. Stay at the public approach; visits inside the garden have their own terms.' },
  opera: { name: 'Opera and Rustaveli', title: 'The Rustaveli rhythm', story: 'A short walk through architecture and everyday Tbilisi.', tip: 'Walk on the sidewalk. You don’t need to enter the Opera or buy an event ticket.' },
});

const STOCK = new Map(MISSIONS.map((m) => [m.id, m]));
const FIELDS = ['name', 'title', 'story', 'tip'];
const GEORGIAN = /[ა-ჿ]/;

/** English copy of one mission row for an English request; Georgian (unchanged object) otherwise. */
export function localizeMission(mission, lang = 'ka') {
  if (lang !== 'en' || !mission || typeof mission !== 'object') return mission;
  const stock = STOCK.get(mission.id);
  const en = MISSIONS_EN[mission.id];
  if (!stock || !en) return mission;
  const out = { ...mission };
  for (const field of FIELDS) {
    const english = en[field] ?? (field === 'tip' ? DEFAULT_TIP : undefined);
    if (english && mission[field] === stock[field]) out[field] = english;
  }
  return out;
}

/**
 * English view of a MEDIRUN snapshot (bootstrap and every call that returns one). The admin's
 * pause message is free Georgian text: English requests drop it so the app shows its own English.
 */
export function localizeSnapshot(snapshot, lang = 'ka') {
  if (lang !== 'en' || !snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.missions)) return snapshot;
  const config = snapshot.config && GEORGIAN.test(String(snapshot.config.message || ''))
    ? { ...snapshot.config, message: '' }
    : snapshot.config;
  return { ...snapshot, missions: snapshot.missions.map((m) => localizeMission(m, lang)), config };
}
