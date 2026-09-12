import type { AirQualityBand, WeatherCategory, WeatherCondition, WeatherLang } from './types.ts';

type Flavor = 'default' | 'pain' | 'steps_low' | 'steps_done' | 'hydration';

type CopyPair = { title: string; body: string };

const CONDITION: Record<WeatherLang, Record<WeatherCondition, string>> = {
  ka: {
    clear: 'მზიანი',
    mostly_clear: 'უმეტესად მზიანი',
    partly_cloudy: 'ნაწილობრივ ღრუბლიანი',
    cloudy: 'ღრუბლიანი',
    fog: 'ნისლი',
    drizzle: 'წვიმის წვეთები',
    rain: 'წვიმა',
    heavy_rain: 'ძლიერი წვიმა',
    snow: 'თოვლი',
    heavy_snow: 'ძლიერი თოვლი',
    storm: 'ჭექა-ქუხილი',
  },
  en: {
    clear: 'Clear',
    mostly_clear: 'Mostly clear',
    partly_cloudy: 'Partly cloudy',
    cloudy: 'Cloudy',
    fog: 'Fog',
    drizzle: 'Drizzle',
    rain: 'Rain',
    heavy_rain: 'Heavy rain',
    snow: 'Snow',
    heavy_snow: 'Heavy snow',
    storm: 'Storm',
  },
  fr: {
    clear: 'Ensoleillé',
    mostly_clear: 'Plutôt ensoleillé',
    partly_cloudy: 'Partiellement nuageux',
    cloudy: 'Nuageux',
    fog: 'Brouillard',
    drizzle: 'Bruine',
    rain: 'Pluie',
    heavy_rain: 'Forte pluie',
    snow: 'Neige',
    heavy_snow: 'Forte neige',
    storm: 'Orage',
  },
  ru: {
    clear: 'Ясно',
    mostly_clear: 'Преимущественно ясно',
    partly_cloudy: 'Переменная облачность',
    cloudy: 'Облачно',
    fog: 'Туман',
    drizzle: 'Морось',
    rain: 'Дождь',
    heavy_rain: 'Сильный дождь',
    snow: 'Снег',
    heavy_snow: 'Сильный снег',
    storm: 'Гроза',
  },
};

const VARIANTS: Record<WeatherLang, Record<string, CopyPair[]>> = {
  ka: {
    excellent_outdoor: [
      { title: 'გარეთ მშვენიერი ამინდია ☀️', body: 'თუ ცოტა მოძრაობა გინდა, პატარა გასეირნებისთვის კარგი დროა.' },
      { title: 'დღეს ამინდი შენს მხარესაა 😄', body: 'სუფთა ჰაერი დღეს კარგად გამოგადგება.' },
      { title: 'სასიამოვნო დღეა გარეთ გასასვლელად.', body: 'Medi გეკითხება: ცოტა გავიაროთ? 🚶' },
      { title: 'გარეთ სიამოვნებით ისუნთქავ ☀️', body: 'თუ გინდა, მოკლე გასეირნება დღეს კარგად ერგება.' },
    ],
    good_outdoor: [
      { title: 'სასიამოვნო ამინდია გარეთ გასასვლელად.', body: 'პატარა გასეირნება დღეს მშვიდად ჯდება.' },
      { title: 'დღეს გარეთ გასვლა კარგი იდეაა ☀️', body: 'თუ თავს კარგად გრძნობ, მოკლე გასეირნება საკმარისია.' },
      { title: 'ამინდი მეგობრულია 🌤️', body: 'თუ ცოტა ჰაერი გინდა, დღეს ხელსაყრელი დროა.' },
    ],
    okay_outdoor: [
      { title: 'გასვლა შეიძლება — უბრალოდ იდეალური არაა.', body: 'თუ გინდა, მოკლე გასეირნება მაინც ნორმალურია.' },
      { title: 'დღეს ამინდი საშუალოა 🌤️', body: 'გარეთ თუ გადიხარ, მოკლედ და კომფორტულად.' },
    ],
    rainy: [
      { title: 'წვიმა გეგმებს ცოტას გვიცვლის ☔', body: 'თუ გასვლას აპირებ, ქოლგა დღეს ცუდი კომპანიონი არ იქნება.' },
      { title: 'დღეს ქოლგა კარგი მეგობარი იქნება ☔', body: 'თუ გარეთ გასვლა არ გინდა, სახლში ცოტა მოძრაობაც მშვენივრად ითვლება.' },
      { title: 'სველი დღეა 🌧️', body: 'გასვლა შეიძლება — უბრალოდ წყალს მოემზადე.' },
    ],
    rain_soon: [
      { title: 'ახლა გასასვლელად კარგი დროა 👀', body: 'რამდენიმე საათში წვიმის შანსი იზრდება, ასე რომ თუ გასეირნებას გეგმავ, ადრე ჯობს.' },
      { title: 'ჯერ მშვიდია, მერე წვიმა უახლოვდება ☔', body: 'თუ გასვლა გინდა, ახლა უფრო მშვიდი ფანჯარა ჩანს.' },
    ],
    heavy_rain: [
      { title: 'დღეს გარეთ ხანგრძლივი სეირნობის დღე ნაკლებადაა 🌧️', body: 'თუ არ გჭირდება გასვლა, თავს ნუ შეაწუხებ — სახლში მოძრაობაც მოძრაობაა.' },
      { title: 'წვიმა დღეს საკმაოდ სერიოზულია 🌧️', body: 'თუ სახლში დარჩები, ესეც სრულიად ნორმალური გეგმაა.' },
    ],
    hot: [
      { title: 'დღეს ცხელა 🥵', body: 'გარეთ თუ გადიხარ, წყალი თან იქონიე და ყველაზე ცხელ საათებს მოერიდე.' },
      { title: 'სიცხე იგრძნობა ☀️', body: 'მოკლე გასვლა შეიძლება — უბრალოდ ნუ გადააჭარბებ შუადღეს.' },
    ],
    very_hot: [
      { title: 'დღეს ძალიან ცხელა ☀️', body: 'შუადღის სიცხეში ინტენსიურ აქტივობას ნუ დაგეგმავ. თუ გასვლა გინდა, დილა ან საღამო უკეთესია.' },
      { title: 'სიცხე დღეს მკაცრია ☀️', body: 'თუ არ გჭირდება გასვლა, შუადღე სახლში უფრო კომფორტული იქნება.' },
    ],
    cold: [
      { title: 'გარეთ ცოტა ცივა 🧣', body: 'პატარა გასეირნება მაინც შესაძლებელია — უბრალოდ თბილად ჩაიცვი.' },
      { title: 'დღეს გრილია 🧥', body: 'თუ გახვალ, თბილი ფენა საკმარისი იქნება.' },
    ],
    very_cold: [
      { title: 'დღეს საკმაოდ ცივა ❄️', body: 'თუ გარეთ გასვლა არ გჭირდება, მოკლე გასვლა ან სახლში მოძრაობა უფრო კომფორტული იქნება.' },
      { title: 'გარეთ ნამდვილად ცივა ❄️', body: 'ხანგრძლივ სეირნობას დღეს ნუ დაგეგმავ, თუ არ გჭირდება.' },
    ],
    high_uv: [
      { title: 'მზე დღეს ძლიერია ☀️', body: 'თუ გარეთ დიდხანს იქნები, მზისგან დაცვა კარგი იდეაა.' },
      { title: 'ამინდი სასიამოვნოა, მაგრამ UV მაღალია ☀️', body: 'თუ გახვალ, ჩრდილი, შესაბამისი ტანსაცმელი და მზისგან დაცვა დაგეხმარება.' },
    ],
    very_windy: [
      { title: 'დღეს ქარი თავის აზრზეა 😄', body: 'გასვლა შეიძლება, უბრალოდ ცოტა უფრო ქარიანი დღეა.' },
      { title: 'დღეს ქარი ძლიერია.', body: 'ხანგრძლივი გასეირნებისთვის იდეალური დრო არაა.' },
    ],
    storm: [
      { title: 'ამინდი დღეს არასტაბილურია ⛈️', body: 'გარეთ აქტივობის დაგეგმვა ახლა კარგი იდეა არ არის.' },
    ],
    night: [
      { title: 'დღე უკვე დასრულდა 🌙', body: 'გარეთ თუ გადიხარ, ამინდი მშვიდია — მაგრამ ახლა დასვენებაც კარგი გეგმაა.' },
      { title: 'ღამეა 🌙', body: 'თუ ხვალ გასვლას გეგმავ, ფანჯარას დილით გადავხედავთ.' },
    ],
    evening: [
      { title: 'საღამოს ამინდი მშვიდია 🌙', body: 'თუ ცოტა სუფთა ჰაერი გინდა, მოკლე გასეირნებისთვის ცუდი დრო არაა.' },
      { title: 'საღამო მშვიდია 🌤️', body: 'მოკლე გასვლა შეიძლება — და მერე დასვენებაც.' },
    ],
    morning: [
      { title: 'დილა მშვიდობისა ☀️', body: 'დღეს საუკეთესო გასასვლელი ფანჯარა ცოტა მოგვიანებით ჩანს.' },
      { title: 'დილა კარგად იწყება ☀️', body: 'თუ გასვლას გეგმავ, დღის ფანჯარას ქვემოთ ნახავ.' },
    ],
    poor_visibility: [
      { title: 'ხილვადობა დღეს სუსტია 🌫️', body: 'თუ გახვალ, ნელა და ყურადღებით — იძულებითი გასეირნება საჭირო არაა.' },
    ],
    mixed: [
      { title: 'დღეს ამინდი საშუალოა.', body: 'გასვლა შენზეა — იძულება აქ არავის აქვს.' },
      { title: 'დღეს კარგი ფანჯარა ვერ ვიპოვე.', body: 'სახლში მოძრაობაც სრულიად ითვლება.' },
    ],
    pain: [
      { title: 'გარეთ კარგი ამინდია, მაგრამ დღეს თავს ნუ დააძალებ 💚', body: 'თუ მოძრაობა გინდა, მხოლოდ იმდენი, რამდენიც კომფორტულია.' },
      { title: 'ამინდი კარგია — შენი ტემპი მაინც შენია 💚', body: 'დღეს იძულებითი გასეირნება საჭირო არაა.' },
    ],
    steps_low: [
      { title: 'გარეთ მშვენიერი ამინდია ☀️', body: 'დღეს ჯერ ბევრი ნაბიჯი არ დაგვიგროვებია — 10–15 წუთიანი გასეირნება კარგი კომბინაციაა.' },
      { title: 'სუფთა ჰაერი ახლოსაა 🚶', body: 'თუ გინდა, მოკლე გასეირნება დღეს მშვიდად ერგება.' },
    ],
    steps_done: [
      { title: 'დღეს ნაბიჯების მიზანი უკვე შესრულებულია 🎉', body: 'ამიტომ გარეთ თუ გახვალ, მხოლოდ სიამოვნებისთვის.' },
      { title: 'დღეს უკვე კარგად გაიარე 🎉', body: 'გასვლა თუ გინდა — უბრალოდ სიამოვნებისთვის, არა ვალდებულებით.' },
    ],
    hydration: [
      { title: 'დღეს სიცხეა და წყალს ცოტა მეტი ყურადღება მოუხდება 💧', body: 'გარეთ თუ გადიხარ, ერთი ყლუპი თან წაიღე — დიაგნოზი აქ არ არის.' },
      { title: 'დღეს ცხელა ☀️', body: 'წყალს ცოტა მეტი ყურადღება მივაქციოთ 💧' },
    ],
  },
  en: {
    excellent_outdoor: [
      { title: 'It is a lovely day to step outside ☀️', body: 'If you feel like moving a little, a short walk would land nicely.' },
      { title: 'The weather is on your side today 😄', body: 'A little fresh air is rarely a bad idea.' },
      { title: 'A pleasant day to go out.', body: 'Medi wonders: a short stroll? 🚶' },
      { title: 'The air outside looks kind ☀️', body: 'A short walk would fit the day, if you want one.' },
    ],
    good_outdoor: [
      { title: 'Nice weather for heading out.', body: 'A short walk would sit comfortably today.' },
      { title: 'Going outside looks like a good idea ☀️', body: 'Keep it short if you like — that is enough.' },
      { title: 'The weather is friendly 🌤️', body: 'If you want some air, today is a fair time.' },
    ],
    okay_outdoor: [
      { title: 'Going out is fine — just not perfect.', body: 'A short walk is still okay if you want one.' },
      { title: 'A mixed kind of day 🌤️', body: 'If you go out, keep it short and comfortable.' },
    ],
    rainy: [
      { title: 'Rain is rearranging the plans a little ☔', body: 'If you are heading out, an umbrella is a kind friend today.' },
      { title: 'An umbrella would be good company ☔', body: 'Staying in and moving a little at home still counts.' },
      { title: 'A wet day 🌧️', body: 'You can still go out — just expect some rain.' },
    ],
    rain_soon: [
      { title: 'It is a good moment to go out now 👀', body: 'Rain looks more likely in a few hours, so sooner is kinder if you planned a walk.' },
      { title: 'Still calm — rain is on the way ☔', body: 'If you want to go out, the quieter window looks like now.' },
    ],
    heavy_rain: [
      { title: 'Not really a long-walk kind of day 🌧️', body: 'If you do not need to go out, do not push it — moving at home still counts.' },
      { title: 'The rain is quite serious today 🌧️', body: 'Staying in is a perfectly fine plan.' },
    ],
    hot: [
      { title: 'It is hot today 🥵', body: 'If you go out, take water and skip the hottest hours.' },
      { title: 'The heat is noticeable ☀️', body: 'A short outing is fine — just do not overdo midday.' },
    ],
    very_hot: [
      { title: 'It is very hot today ☀️', body: 'Do not plan intense activity in the midday heat. Morning or evening is kinder.' },
      { title: 'The heat is sharp today ☀️', body: 'If you do not need to go out, midday is more comfortable indoors.' },
    ],
    cold: [
      { title: 'It is a little cold outside 🧣', body: 'A short walk is still possible — just dress warmly.' },
      { title: 'A cool day 🧥', body: 'A warm layer will be enough if you head out.' },
    ],
    very_cold: [
      { title: 'It is quite cold today ❄️', body: 'If you do not need to go out, a short trip or moving at home will feel kinder.' },
      { title: 'It is truly cold outside ❄️', body: 'Skip a long walk unless you need to go.' },
    ],
    high_uv: [
      { title: 'The sun is strong today ☀️', body: 'If you will be out for a while, sun protection is a good idea.' },
      { title: 'Pleasant weather, but UV is high ☀️', body: 'Shade, covering clothes and sun protection will help if you go out.' },
    ],
    very_windy: [
      { title: 'The wind has opinions today 😄', body: 'You can still go out — it is just a windier day.' },
      { title: 'The wind is strong today.', body: 'Not an ideal stretch for a long walk.' },
    ],
    storm: [{ title: 'The weather is unsettled today ⛈️', body: 'Planning outdoor activity right now is not a good idea.' }],
    night: [
      { title: 'The day is already over 🌙', body: 'If you go out, it is calm — but resting is a good plan too.' },
      { title: 'It is night 🌙', body: 'If you are thinking of tomorrow, we can look at the window in the morning.' },
    ],
    evening: [
      { title: 'The evening weather is calm 🌙', body: 'If you want a little air, a short walk is not a bad idea.' },
      { title: 'A quiet evening 🌤️', body: 'A short outing is fine — then rest is fine too.' },
    ],
    morning: [
      { title: 'Good morning ☀️', body: 'The nicest window to go out looks a little later today.' },
      { title: 'The morning is starting well ☀️', body: 'If you plan to go out, the day’s window is below.' },
    ],
    poor_visibility: [
      { title: 'Visibility is low today 🌫️', body: 'If you go out, go slowly — a forced walk is not needed.' },
    ],
    mixed: [
      { title: 'A middling kind of day.', body: 'Going out is up to you — nobody is pushing.' },
      { title: 'I could not find a good window today.', body: 'Moving at home still counts.' },
    ],
    pain: [
      { title: 'Nice weather outside, but do not push yourself today 💚', body: 'If you want to move, only as much as feels comfortable.' },
      { title: 'The weather is good — your pace is still yours 💚', body: 'No need to force a walk today.' },
    ],
    steps_low: [
      { title: 'Beautiful weather outside ☀️', body: 'We have not gathered many steps yet — 10–15 minutes outside would pair well.' },
      { title: 'Fresh air is nearby 🚶', body: 'A short walk would sit calmly on the day, if you want one.' },
    ],
    steps_done: [
      { title: 'Today’s step goal is already done 🎉', body: 'So if you go outside, let it be only for pleasure.' },
      { title: 'You have already moved well today 🎉', body: 'If you go out, make it just for the joy of it.' },
    ],
    hydration: [
      { title: 'It is hot, so water could use a little extra care 💧', body: 'If you go out, take a sip with you — this is not a diagnosis.' },
      { title: 'It is hot today ☀️', body: 'Let’s give water a little more attention 💧' },
    ],
  },
  fr: {
    excellent_outdoor: [
      { title: 'Il fait très beau pour sortir ☀️', body: 'Si tu as envie de bouger un peu, une courte marche irait bien.' },
      { title: 'La météo est de ton côté aujourd’hui 😄', body: 'Un peu d’air frais n’est vraiment pas une mauvaise idée.' },
      { title: 'Une belle journée pour sortir.', body: 'Medi demande : on marche un peu ? 🚶' },
      { title: 'L’air dehors a l’air doux ☀️', body: 'Une petite marche irait bien, si tu en as envie.' },
    ],
    good_outdoor: [
      { title: 'Il fait agréable pour sortir.', body: 'Une courte marche irait tranquillement aujourd’hui.' },
      { title: 'Sortir a l’air d’une bonne idée ☀️', body: 'Garde-la courte si tu veux — cela suffit.' },
      { title: 'La météo est amicale 🌤️', body: 'Si tu veux un peu d’air, c’est un bon moment.' },
    ],
    okay_outdoor: [
      { title: 'On peut sortir — ce n’est juste pas parfait.', body: 'Une courte marche reste possible si tu veux.' },
      { title: 'Une journée moyenne 🌤️', body: 'Si tu sors, reste court et à l’aise.' },
    ],
    rainy: [
      { title: 'La pluie déplace un peu les plans ☔', body: 'Si tu sors, un parapluie sera un bon ami.' },
      { title: 'Un parapluie sera bonne compagnie ☔', body: 'Rester chez soi et bouger un peu compte aussi.' },
      { title: 'Une journée humide 🌧️', body: 'Tu peux sortir — prévois juste un peu d’eau.' },
    ],
    rain_soon: [
      { title: 'C’est un bon moment pour sortir maintenant 👀', body: 'La pluie semble plus probable dans quelques heures — plus tôt sera plus calme.' },
      { title: 'Encore calme — la pluie approche ☔', body: 'Si tu veux sortir, la fenêtre plus tranquille est maintenant.' },
    ],
    heavy_rain: [
      { title: 'Pas vraiment un jour pour une longue marche 🌧️', body: 'Si tu n’as pas besoin de sortir, ne te force pas — bouger à la maison compte.' },
      { title: 'La pluie est assez sérieuse 🌧️', body: 'Rester à l’intérieur est un plan tout à fait bien.' },
    ],
    hot: [
      { title: 'Il fait chaud aujourd’hui 🥵', body: 'Si tu sors, prends de l’eau et évite les heures les plus chaudes.' },
      { title: 'On sent la chaleur ☀️', body: 'Une sortie courte va — évite juste le milieu de journée.' },
    ],
    very_hot: [
      { title: 'Il fait très chaud aujourd’hui ☀️', body: 'Évite une activité intense dans la chaleur de midi. Le matin ou le soir est plus doux.' },
      { title: 'La chaleur est vive aujourd’hui ☀️', body: 'Si tu n’as pas besoin de sortir, midi sera plus confortable à l’intérieur.' },
    ],
    cold: [
      { title: 'Il fait un peu froid dehors 🧣', body: 'Une petite marche reste possible — habille-toi chaudement.' },
      { title: 'Une journée fraîche 🧥', body: 'Une couche chaude suffira si tu sors.' },
    ],
    very_cold: [
      { title: 'Il fait assez froid aujourd’hui ❄️', body: 'Si tu n’as pas besoin de sortir, une courte sortie ou bouger à la maison sera plus confortable.' },
      { title: 'Il fait vraiment froid dehors ❄️', body: 'Évite une longue marche si ce n’est pas nécessaire.' },
    ],
    high_uv: [
      { title: 'Le soleil est fort aujourd’hui ☀️', body: 'Si tu restes dehors longtemps, une protection solaire est une bonne idée.' },
      { title: 'Il fait agréable, mais l’UV est élevé ☀️', body: 'Ombre, vêtements adaptés et protection solaire t’aideront.' },
    ],
    very_windy: [
      { title: 'Le vent a son mot à dire 😄', body: 'Tu peux sortir — c’est juste une journée plus venteuse.' },
      { title: 'Le vent est fort aujourd’hui.', body: 'Pas idéal pour une longue promenade.' },
    ],
    storm: [{ title: 'Le temps est instable aujourd’hui ⛈️', body: 'Prévoir une activité dehors n’est pas une bonne idée maintenant.' }],
    night: [
      { title: 'La journée est déjà finie 🌙', body: 'Si tu sors, c’est calme — mais te reposer est aussi un bon plan.' },
      { title: 'C’est la nuit 🌙', body: 'Si tu penses à demain, on regardera la fenêtre le matin.' },
    ],
    evening: [
      { title: 'Le temps du soir est calme 🌙', body: 'Si tu veux un peu d’air, une courte marche n’est pas une mauvaise idée.' },
      { title: 'Une soirée tranquille 🌤️', body: 'Une petite sortie va — et se reposer aussi.' },
    ],
    morning: [
      { title: 'Bonjour ☀️', body: 'La plus belle fenêtre pour sortir arrive un peu plus tard.' },
      { title: 'La matinée commence bien ☀️', body: 'Si tu prévois de sortir, la fenêtre du jour est plus bas.' },
    ],
    poor_visibility: [{ title: 'La visibilité est faible 🌫️', body: 'Si tu sors, vas-y doucement — pas besoin de forcer une marche.' }],
    mixed: [
      { title: 'Une journée assez moyenne.', body: 'Sortir, c’est toi qui vois — personne n’insiste.' },
      { title: 'Je n’ai pas trouvé de bonne fenêtre aujourd’hui.', body: 'Bouger à la maison compte aussi.' },
    ],
    pain: [
      { title: 'Il fait beau, mais ne te force pas aujourd’hui 💚', body: 'Si tu veux bouger, seulement autant que c’est confortable.' },
      { title: 'Le temps est beau — ton rythme reste le tien 💚', body: 'Pas besoin de forcer une marche aujourd’hui.' },
    ],
    steps_low: [
      { title: 'Il fait très beau dehors ☀️', body: 'On n’a pas encore beaucoup marché — 10–15 minutes dehors iraient bien.' },
      { title: 'L’air frais n’est pas loin 🚶', body: 'Une courte marche irait tranquillement, si tu en as envie.' },
    ],
    steps_done: [
      { title: 'L’objectif de pas est déjà atteint 🎉', body: 'Alors si tu sors, que ce soit seulement pour le plaisir.' },
      { title: 'Tu as déjà bien bougé aujourd’hui 🎉', body: 'Si tu sors, que ce soit juste pour le plaisir.' },
    ],
    hydration: [
      { title: 'Il fait chaud, l’eau mérite un peu plus d’attention 💧', body: 'Si tu sors, emporte une gorgée — ce n’est pas un diagnostic.' },
      { title: 'Il fait chaud aujourd’hui ☀️', body: 'Accordons un peu plus d’attention à l’eau 💧' },
    ],
  },
  ru: {
    excellent_outdoor: [
      { title: 'На улице прекрасная погода ☀️', body: 'Если хочется чуть подвигаться, короткая прогулка сегодня к месту.' },
      { title: 'Погода сегодня на твоей стороне 😄', body: 'Немного свежего воздуха — точно не плохая идея.' },
      { title: 'Приятный день, чтобы выйти.', body: 'Medi спрашивает: прогуляемся чуть-чуть? 🚶' },
      { title: 'На улице дышится легко ☀️', body: 'Короткая прогулка подойдёт, если захочешь.' },
    ],
    good_outdoor: [
      { title: 'Приятная погода, чтобы выйти.', body: 'Короткая прогулка сегодня ляжет спокойно.' },
      { title: 'Выйти сегодня — хорошая идея ☀️', body: 'Можно коротко — этого достаточно.' },
      { title: 'Погода дружелюбная 🌤️', body: 'Если хочется воздуха, сейчас подходящее время.' },
    ],
    okay_outdoor: [
      { title: 'Выйти можно — просто день не идеальный.', body: 'Короткая прогулка всё равно нормальна, если хочешь.' },
      { title: 'День средний 🌤️', body: 'Если выходишь, держись коротко и комфортно.' },
    ],
    rainy: [
      { title: 'Дождь немного меняет планы ☔', body: 'Если выходишь, зонт сегодня хороший спутник.' },
      { title: 'Зонт сегодня будет добрым другом ☔', body: 'Если не хочется выходить, немного движения дома тоже считается.' },
      { title: 'Сырой день 🌧️', body: 'Выйти можно — просто жди дождя.' },
    ],
    rain_soon: [
      { title: 'Сейчас как раз хорошее время выйти 👀', body: 'Через пару часов дождь вероятнее, так что если планируешь прогулку, лучше раньше.' },
      { title: 'Пока спокойно — дождь ближе ☔', body: 'Если хочешь выйти, более тихое окно — сейчас.' },
    ],
    heavy_rain: [
      { title: 'День не очень для долгой прогулки 🌧️', body: 'Если выходить не нужно, не заставляй себя — движение дома тоже движение.' },
      { title: 'Дождь сегодня довольно серьёзный 🌧️', body: 'Остаться дома — совершенно нормальный план.' },
    ],
    hot: [
      { title: 'Сегодня жарко 🥵', body: 'Если выходишь, возьми воду и обойди самые жаркие часы.' },
      { title: 'Жара чувствуется ☀️', body: 'Короткий выход можно — только не перебарщивай в полдень.' },
    ],
    very_hot: [
      { title: 'Сегодня очень жарко ☀️', body: 'Не планируй интенсивную активность в полуденную жару. Утро или вечер мягче.' },
      { title: 'Жара сегодня жёсткая ☀️', body: 'Если выходить не нужно, полдень дома будет комфортнее.' },
    ],
    cold: [
      { title: 'На улице слегка холодно 🧣', body: 'Короткая прогулка всё ещё возможна — просто одевайся теплее.' },
      { title: 'Прохладный день 🧥', body: 'Тёплый слой будет достаточным, если выйдешь.' },
    ],
    very_cold: [
      { title: 'Сегодня довольно холодно ❄️', body: 'Если выходить не нужно, короткий выход или движение дома будет комфортнее.' },
      { title: 'На улице правда холодно ❄️', body: 'Долгую прогулку лучше не планировать, если нет нужды.' },
    ],
    high_uv: [
      { title: 'Солнце сегодня сильное ☀️', body: 'Если будешь долго на улице, защита от солнца — хорошая идея.' },
      { title: 'Погода приятная, но UV высокий ☀️', body: 'Тень, закрытая одежда и защита от солнца помогут, если выйдешь.' },
    ],
    very_windy: [
      { title: 'Ветер сегодня при своём мнении 😄', body: 'Выйти можно — просто день более ветреный.' },
      { title: 'Ветер сегодня сильный.', body: 'Для долгой прогулки время не идеальное.' },
    ],
    storm: [{ title: 'Погода сегодня неустойчивая ⛈️', body: 'Планировать активность на улице сейчас не лучшая идея.' }],
    night: [
      { title: 'День уже закончился 🌙', body: 'Если выходишь, на улице спокойно — но отдых тоже хороший план.' },
      { title: 'Уже ночь 🌙', body: 'Если думаешь о завтра, окно посмотрим утром.' },
    ],
    evening: [
      { title: 'Вечерняя погода спокойная 🌙', body: 'Если хочется чуть воздуха, короткая прогулка неплоха.' },
      { title: 'Тихий вечер 🌤️', body: 'Короткий выход можно — и отдых тоже.' },
    ],
    morning: [
      { title: 'Доброе утро ☀️', body: 'Самое приятное окно для выхода будет чуть позже.' },
      { title: 'Утро начинается хорошо ☀️', body: 'Если планируешь выход, окно дня ниже.' },
    ],
    poor_visibility: [{ title: 'Видимость сегодня слабая 🌫️', body: 'Если выходишь, иди спокойно — насильно гулять не нужно.' }],
    mixed: [
      { title: 'День средний.', body: 'Выходить или нет — на тебе. Никто не торопит.' },
      { title: 'Хорошее окно сегодня не нашлось.', body: 'Движение дома тоже считается.' },
    ],
    pain: [
      { title: 'На улице хорошая погода, но сегодня себя не заставляй 💚', body: 'Если хочется двигаться — только столько, сколько комфортно.' },
      { title: 'Погода хорошая — темп всё равно твой 💚', body: 'Сегодня не нужно заставлять себя гулять.' },
    ],
    steps_low: [
      { title: 'На улице прекрасная погода ☀️', body: 'Шагов пока немного — 10–15 минут на улице хорошо сочетаются.' },
      { title: 'Свежий воздух рядом 🚶', body: 'Короткая прогулка ляжет спокойно, если захочешь.' },
    ],
    steps_done: [
      { title: 'Цель по шагам на сегодня уже выполнена 🎉', body: 'Поэтому если выйдешь — только ради удовольствия.' },
      { title: 'Ты уже хорошо прошёл сегодня 🎉', body: 'Если выйдешь, пусть это будет просто в радость.' },
    ],
    hydration: [
      { title: 'Жарко, и воде стоит уделить чуть больше внимания 💧', body: 'Если выходишь, возьми глоток с собой — это не диагноз.' },
      { title: 'Сегодня жарко ☀️', body: 'Уделим воде чуть больше внимания 💧' },
    ],
  },
};

function dayHash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function pickWeatherCopyKeys(input: {
  category: WeatherCategory;
  flavor: Flavor;
  locale: WeatherLang;
  seed: string;
}): { titleKey: string; bodyKey: string } {
  const bucket =
    input.flavor !== 'default' && VARIANTS[input.locale][input.flavor]
      ? input.flavor
      : input.category;
  const list = VARIANTS[input.locale][bucket] ?? VARIANTS.ka[bucket] ?? VARIANTS.ka.mixed;
  const index = list.length ? dayHash(input.seed) % list.length : 0;
  return {
    titleKey: `weather.title.${bucket}.${index}`,
    bodyKey: `weather.body.${bucket}.${index}`,
  };
}

export function weatherCopyText(key: string, locale: WeatherLang = 'ka'): string {
  const match = key.match(/^weather\.(title|body)\.([a-z0-9_]+)\.(\d+)$/);
  if (!match) return '';
  const [, part, bucket, indexRaw] = match;
  const index = Number(indexRaw);
  const list = VARIANTS[locale][bucket] ?? VARIANTS.ka[bucket];
  const row = list?.[index] ?? list?.[0];
  if (!row) return '';
  return part === 'title' ? row.title : row.body;
}

export function weatherConditionLabel(condition: WeatherCondition, locale: WeatherLang = 'ka'): string {
  return CONDITION[locale][condition] ?? CONDITION.ka[condition];
}

const AIR_BAND: Record<WeatherLang, Record<AirQualityBand, string>> = {
  ka: {
    good: 'კარგი',
    fair: 'ნორმალური',
    moderate: 'საშუალო',
    poor: 'ცუდი',
    very_poor: 'ძალიან ცუდი',
    extremely_poor: 'უკიდურესად ცუდი',
  },
  en: {
    good: 'Good',
    fair: 'Fair',
    moderate: 'Moderate',
    poor: 'Poor',
    very_poor: 'Very poor',
    extremely_poor: 'Extremely poor',
  },
  fr: {
    good: 'Bon',
    fair: 'Correct',
    moderate: 'Modéré',
    poor: 'Mauvais',
    very_poor: 'Très mauvais',
    extremely_poor: 'Extrêmement mauvais',
  },
  ru: {
    good: 'Хороший',
    fair: 'Нормальный',
    moderate: 'Средний',
    poor: 'Плохой',
    very_poor: 'Очень плохой',
    extremely_poor: 'Крайне плохой',
  },
};

const AIR_HINT: Record<WeatherLang, Record<AirQualityBand, string>> = {
  ka: {
    good: 'ჰაერი დღეს სუფთაა.',
    fair: 'ჰაერი ნორმალურია — გარეთ ყოფნა კომფორტულია.',
    moderate: 'ჰაერი საშუალოა. თუ გინდა გარეთ, ნელა და მოკლედ.',
    poor: 'ჰაერი დღეს მძიმეა. გარეთ მოკლე გასეირნება უკეთესია.',
    very_poor: 'ჰაერი ძალიან მძიმეა. გარეთ დიდხანს ყოფნა დღეს არ ღირს.',
    extremely_poor: 'ჰაერი უკიდურესად მძიმეა. გარეთ დღეს უკეთესია არ დარჩე.',
  },
  en: {
    good: 'The air is clean today.',
    fair: 'The air is fine — being outside is comfortable.',
    moderate: 'The air is moderate. If you go out, keep it short and easy.',
    poor: 'The air is heavy today. A short outdoor stretch is better than a long one.',
    very_poor: 'The air is very heavy. A long time outside is not a good idea today.',
    extremely_poor: 'The air is extremely heavy. Better not stay outside today.',
  },
  fr: {
    good: 'L’air est propre aujourd’hui.',
    fair: 'L’air est correct — sortir est confortable.',
    moderate: 'L’air est moyen. Si tu sors, reste court et calme.',
    poor: 'L’air est lourd aujourd’hui. Une sortie courte vaut mieux qu’une longue.',
    very_poor: 'L’air est très lourd. Rester longtemps dehors n’est pas une bonne idée.',
    extremely_poor: 'L’air est extrêmement lourd. Mieux vaut ne pas rester dehors aujourd’hui.',
  },
  ru: {
    good: 'Воздух сегодня чистый.',
    fair: 'Воздух нормальный — на улице комфортно.',
    moderate: 'Воздух средний. Если выходить, лучше коротко и спокойно.',
    poor: 'Воздух сегодня тяжёлый. Короткая прогулка лучше длинной.',
    very_poor: 'Воздух очень тяжёлый. Долго быть на улице сегодня не стоит.',
    extremely_poor: 'Воздух крайне тяжёлый. Сегодня лучше не задерживаться на улице.',
  },
};

export const WEATHER_UI: Record<WeatherLang, {
  section: string;
  feelsLike: (n: number) => string;
  bestTime: string;
  goodTime: string;
  noWindow: string;
  tomorrowWindow: string;
  rain: (n: number) => string;
  wind: (n: number) => string;
  uv: (n: number) => string;
  sunset: string;
  high: string;
  low: string;
  updated: string;
  loading: string;
  unavailable: string;
  recommendation: string;
  nextHours: string;
  nextDays: string;
  today: string;
  detailTitle: string;
  airQuality: string;
  air: (band: AirQualityBand) => string;
  airHint: (band: AirQualityBand) => string;
  airIndex: string;
  pm25: string;
  pm10: string;
  no2: string;
  o3: string;
}> = {
  ka: {
    section: 'ამინდი და Medi',
    feelsLike: (n) => `შეგრძნებით ${Math.round(n)}°`,
    bestTime: 'საუკეთესო დრო',
    goodTime: 'კარგი დრო',
    noWindow: 'დღეს კარგი ფანჯარა ვერ ვიპოვე.',
    tomorrowWindow: 'ხვალის ფანჯარა',
    rain: (n) => `წვიმა ${Math.round(n)}%`,
    wind: (n) => `ქარი ${Math.round(n)} კმ/სთ`,
    uv: (n) => `UV ${Math.round(n)}`,
    sunset: 'მზის ჩასვლა',
    high: 'მაქს.',
    low: 'მინ.',
    updated: 'განახლებულია ცოტა ხნის წინ',
    loading: 'ამინდი იტვირთება…',
    unavailable: 'ამინდის მონაცემები დროებით მიუწვდომელია.',
    recommendation: 'Medi გირჩევს',
    nextHours: 'შემდეგი საათები',
    nextDays: 'შემდეგი დღეები',
    today: 'დღეს',
    detailTitle: 'ამინდი და Medi',
    airQuality: 'ჰაერის ხარისხი',
    air: (band) => `ჰაერი ${AIR_BAND.ka[band]}`,
    airHint: (band) => AIR_HINT.ka[band],
    airIndex: 'EAQI',
    pm25: 'PM2.5',
    pm10: 'PM10',
    no2: 'NO₂',
    o3: 'O₃',
  },
  en: {
    section: 'Weather & Medi',
    feelsLike: (n) => `Feels like ${Math.round(n)}°`,
    bestTime: 'Best time',
    goodTime: 'Good time',
    noWindow: 'I could not find a good window today.',
    tomorrowWindow: 'Tomorrow’s window',
    rain: (n) => `Rain ${Math.round(n)}%`,
    wind: (n) => `Wind ${Math.round(n)} km/h`,
    uv: (n) => `UV ${Math.round(n)}`,
    sunset: 'Sunset',
    high: 'High',
    low: 'Low',
    updated: 'Updated a little while ago',
    loading: 'Getting the weather…',
    unavailable: 'Weather is temporarily unavailable.',
    recommendation: 'Medi suggests',
    nextHours: 'Next hours',
    nextDays: 'Next days',
    today: 'Today',
    detailTitle: 'Weather & Medi',
    airQuality: 'Air quality',
    air: (band) => `Air ${AIR_BAND.en[band].toLowerCase()}`,
    airHint: (band) => AIR_HINT.en[band],
    airIndex: 'EAQI',
    pm25: 'PM2.5',
    pm10: 'PM10',
    no2: 'NO₂',
    o3: 'O₃',
  },
  fr: {
    section: 'Météo & Medi',
    feelsLike: (n) => `Ressenti ${Math.round(n)}°`,
    bestTime: 'Meilleur moment',
    goodTime: 'Bon moment',
    noWindow: 'Je n’ai pas trouvé de bonne fenêtre aujourd’hui.',
    tomorrowWindow: 'Fenêtre de demain',
    rain: (n) => `Pluie ${Math.round(n)} %`,
    wind: (n) => `Vent ${Math.round(n)} km/h`,
    uv: (n) => `UV ${Math.round(n)}`,
    sunset: 'Coucher du soleil',
    high: 'Max.',
    low: 'Min.',
    updated: 'Mis à jour il y a un moment',
    loading: 'Météo en cours…',
    unavailable: 'La météo est temporairement indisponible.',
    recommendation: 'Medi suggère',
    nextHours: 'Prochaines heures',
    nextDays: 'Prochains jours',
    today: 'Aujourd’hui',
    detailTitle: 'Météo & Medi',
    airQuality: 'Qualité de l’air',
    air: (band) => `Air ${AIR_BAND.fr[band].toLowerCase()}`,
    airHint: (band) => AIR_HINT.fr[band],
    airIndex: 'EAQI',
    pm25: 'PM2.5',
    pm10: 'PM10',
    no2: 'NO₂',
    o3: 'O₃',
  },
  ru: {
    section: 'Погода и Medi',
    feelsLike: (n) => `Ощущается как ${Math.round(n)}°`,
    bestTime: 'Лучшее время',
    goodTime: 'Хорошее время',
    noWindow: 'Хорошее окно сегодня не нашлось.',
    tomorrowWindow: 'Окно на завтра',
    rain: (n) => `Дождь ${Math.round(n)}%`,
    wind: (n) => `Ветер ${Math.round(n)} км/ч`,
    uv: (n) => `UV ${Math.round(n)}`,
    sunset: 'Закат',
    high: 'Макс.',
    low: 'Мин.',
    updated: 'Обновлено недавно',
    loading: 'Загружаем погоду…',
    unavailable: 'Данные о погоде временно недоступны.',
    recommendation: 'Medi советует',
    nextHours: 'Ближайшие часы',
    nextDays: 'Ближайшие дни',
    today: 'Сегодня',
    detailTitle: 'Погода и Medi',
    airQuality: 'Качество воздуха',
    air: (band) => `Воздух ${AIR_BAND.ru[band].toLowerCase()}`,
    airHint: (band) => AIR_HINT.ru[band],
    airIndex: 'EAQI',
    pm25: 'PM2.5',
    pm10: 'PM10',
    no2: 'NO₂',
    o3: 'O₃',
  },
};

export function weekdayShort(ymd: string, locale: WeatherLang): string {
  const date = new Date(`${ymd}T12:00:00Z`);
  const tag = locale === 'ka' ? 'ka-GE' : locale === 'fr' ? 'fr-FR' : locale === 'ru' ? 'ru-RU' : 'en-US';
  return date.toLocaleDateString(tag, { weekday: 'short', timeZone: 'UTC' });
}
