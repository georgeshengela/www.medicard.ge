import { tx } from '../i18n/locale.js';

const ENGAGE_FALLBACKS_KA: Record<string, { title: string; body: string }> = {
  "engage-checkin-morning": {
    "title": "დილა მშვიდობისა ☀️",
    "body": "როგორ გეძინა? როგორ იწყებ დღეს? 💚"
  },
  "engage-checkin-mid": {
    "title": "როგორ ხარ? 👀",
    "body": "დღეს ჯერ არ მინახიხარ. ყველაფერი კარგადაა? 💚"
  },
  "engage-checkin-evening": {
    "title": "დღე თითქმის გავიდა 🌙",
    "body": "სანამ დღეს დავემშვიდობებით — როგორ ჩაიარა შენმა დღემ?"
  },
  "engage-streak-week": {
    "title": "7 დღე ერთად 💚",
    "body": "უკვე 7 დღეა საკუთარ ჯანმრთელობას რეგულარულად აკვირდები. კარგი სერია გამოგვივიდა ✨"
  },
  "engage-streak-continue": {
    "title": "დღესაც გავაგრძელოთ? 👀",
    "body": "ბოლო 6 დღე ყოველდღე ინიშნავდი მონაცემებს. ერთი პატარა ჩანაწერი და სერია გრძელდება 💚"
  },
  "engage-weekly": {
    "title": "შენი კვირა მზადაა 📊",
    "body": "ამ კვირაში ბევრი რამ დაგვიგროვდა. Medi-მ შენთვის მოკლე შეჯამება მოამზადა 💚"
  },
  "engage-insight": {
    "title": "ერთი რამ შევამჩნიე 👀",
    "body": "ბოლო დღეების მონაცემებში რაღაც საინტერესო დავინახე. გინდა ერთად გადავხედოთ?"
  },
  "engage-insight-steps": {
    "title": "პატარა ცვლილება შევამჩნიე 💚",
    "body": "ამ კვირაში შენი ნაბიჯების საშუალო რაოდენობა გაიზარდა. კარგი მიმართულებაა 👏"
  },
  "engage-insight-cycle": {
    "title": "შენი ციკლიდან რაღაც შევამჩნიე 🌸",
    "body": "ბოლო რამდენიმე ციკლში ერთი განმეორებადი ტენდენცია ჩანს. გაჩვენო?"
  },
  "engage-achieve-steps": {
    "title": "პატარა გამარჯვება 🎉",
    "body": "ამ კვირაში უკვე {steps} ნაბიჯი დააგროვე. შენ შეიძლება არ დაგითვლია, Medi-მ კი დაითვალა 😄"
  },
  "engage-achieve-month": {
    "title": "ერთი თვე ერთად 💚",
    "body": "უკვე ერთი თვეა Medi შენს ჯანმრთელობაზე ზრუნვაში გეხმარება. მიხარია, რომ აქ ხარ."
  },
  "engage-achieve-meds": {
    "title": "კარგი კვირა იყო ✨",
    "body": "ამ კვირაში მედიკამენტების არცერთი დაგეგმილი მიღება არ გამოგრჩენია. 💚"
  },
  "engage-hydration": {
    "title": "წყალი ხომ არ დაგვავიწყდა? 💧",
    "body": "პატარა ყლუპიც ითვლება 😄 ცოტა წყალი დალიე და გავაგრძელოთ."
  },
  "engage-hydration-low": {
    "title": "Medi-ს წყლის პატრული მოვიდა 🚨💧",
    "body": "დღეს წყალი ცოტა გვაკლია. ერთი ჭიქით დავიწყოთ? 😄"
  },
  "engage-steps-quiet": {
    "title": "დღეს ცოტა მშვიდი დღე გვაქვს 👀",
    "body": "თუ თავს კარგად გრძნობ, პატარა გასეირნება რას იტყვი? 10 წუთიც მშვენიერი დასაწყისია 💚"
  },
  "engage-sleep": {
    "title": "ძილის დრო ახლოვდება 🌙",
    "body": "ტელეფონი ცოტა ხნით გვერდზე გადავდოთ? Medi ხვალაც აქ დაგხვდება 💚"
  },
  "engage-sleep-log": {
    "title": "დღეს აქ დავასრულოთ? 🌙",
    "body": "როგორი დღე იყო? ძილის წინ შეგიძლია 30 წამში ჩაინიშნო როგორ გრძნობ თავს."
  },
  "engage-reengage-2": {
    "title": "როგორ ხარ? 💚",
    "body": "ორი დღეა არ შემოგივლია. უბრალოდ მაინტერესებს, ყველაფერი რიგზეა?"
  },
  "engage-reengage-5": {
    "title": "Medi აქაა 👋",
    "body": "ცოტა ხანია არ გვილაპარაკია. როცა მოგინდება, შენი ჯანმრთელობის ამბები აქ დაგხვდება."
  },
  "engage-reengage-14": {
    "title": "დიდი ხანია არ მინახიხარ 👀",
    "body": "არანაირი საყვედური 😄 უბრალოდ შეგახსენებ — Medi ისევ აქაა, როცა დაგჭირდები. 💚"
  },
  "engage-reengage-30": {
    "title": "დავიწყოთ თავიდან? 🌱",
    "body": "დიდი პაუზა გამოვიდა და ეს სრულიად ნორმალურია. თუ გინდა, დღეს უბრალოდ ერთი პატარა ჩანაწერით დავიწყოთ."
  },
  "engage-feature": {
    "title": "Medi-მ ახალი რაღაც ისწავლა 👀",
    "body": "ახლა შენი კვირის მონაცემების შეჯამებაც შემიძლია. გინდა გაჩვენო? 💚"
  },
  "engage-morning": {
    "title": "დილა მშვიდობისა, {firstName} ☀️",
    "body": "ახალი დღე დაიწყო. როგორ ხარ დღეს? 💚"
  },
  "engage-morning-wish": {
    "title": "დილა მშვიდობისა ☀️",
    "body": "დღეს არაფერს გთხოვ — უბრალოდ კარგი დღე მინდოდა მესურვებინა 💚"
  },
  "engage-birthday": {
    "title": "გილოცავ დაბადების დღეს! 🎂💚",
    "body": "დღეს ჯანმრთელობის სტატისტიკებზე არ ვილაპარაკოთ 😄 უბრალოდ ძალიან კარგი დღე გქონდეს. — Medi"
  },
  "engage-question": {
    "title": "ერთი კითხვა მაქვს 👀",
    "body": "შენი ჯანმრთელობის პროფილში ერთი პატარა დეტალი გვაკლია. 10 წამში შევავსებთ?"
  },
  "engage-chat": {
    "title": "გუშინდელი ამბავი გამახსენდა 💚",
    "body": "როგორ ხარ დღეს? ის საკითხი, რაზეც გუშინ ვილაპარაკეთ, უკეთესადაა?"
  },
  "engage-masked": {
    "title": "Medi-სგან შეხსენება",
    "body": "როცა დრო გექნება, შემომიარე 💚"
  },
  "engage-unfinished": {
    "title": "ერთი საქმე დაგვრჩა 👀",
    "body": "{task} ბოლომდე ვერ მოვასწარით. როცა დრო გექნება, გავაგრძელოთ 💚"
  },
  "engage-unfinished-med": {
    "title": "ერთი საქმე დაგვრჩა 👀",
    "body": "მედიკამენტის დამატება ბოლომდე ვერ მოვასწარით. როცა დრო გექნება, გავაგრძელოთ 💚"
  },
  "engage-visit-followup": {
    "title": "როგორ ჩაიარა ვიზიტმა? 💚",
    "body": "როცა დრო გექნება, შეგიძლია Medi-ს მოუყვე როგორ ჩაიარა და რამე ახალი რეკომენდაცია ხომ არ მიიღე."
  },
  "engage-insight-meds": {
    "title": "ერთი რამ შევამჩნიე 💚",
    "body": "ბოლო დღეებში რამდენიმე მიღება გამოგვრჩა. თუ გინდა, შეხსენების დრო ერთად მოვარგოთ შენს რეჟიმს."
  },
  "engage-weather-walk": {
    "title": "კარგი ამინდია პატარა გასეირნებისთვის ☀️",
    "body": "თუ გინდა, ახლა სასიამოვნო ფანჯარა ჩანს. Medi უბრალოდ შეგახსენებს 💚"
  },
  "engage-weather-rain-soon": {
    "title": "ახლა გასასვლელად კარგი დროა 👀",
    "body": "ცოტა ხანში წვიმის შანსი იზრდება — თუ გეგმავ გასვლას, ადრე უფრო მშვიდია."
  },
  "engage-weather-hot": {
    "title": "დღეს ცხელა ☀️",
    "body": "წყალს ცოტა მეტი ყურადღება მივაქციოთ 💧"
  },
  "engage-weather-uv": {
    "title": "მზე დღეს ძლიერია ☀️",
    "body": "თუ გარეთ დიდხანს იქნები, მზისგან დაცვა კარგი იდეაა."
  },
  "engage-quest-near-complete": {
    "title": "ცოტა დაგვრჩა 💚",
    "body": "თუ მოგინდება, პატარა მოძრაობაც საკმარისი იქნება."
  },
  "engage-quest-weather-window": {
    "title": "სასიამოვნო დრო ჩანს გასასეირნებლად ☀️",
    "body": "თუ გარეთ გასვლა მოგინდება, {windowStart}–{windowEnd} კარგი ფანჯარა ჩანს."
  },
  "engage-quest-comeback": {
    "title": "დღეს მარტივად დავიწყოთ 💚",
    "body": "რეკორდები არ გვჭირდება — უბრალოდ რიტმს დავუბრუნდეთ."
  },
  "engage-quest-morning-plan": {
    "title": "დღის პატარა გეგმა მზადაა",
    "body": "დღევანდელი MEDIQUEST შენს რიტმს მოვარგე — როცა მოგინდება, იქ დაგხვდება."
  },
  "engage-quest-weekly-progress": {
    "title": "კვირის მისია კარგად მიდის 💚",
    "body": "ამ კვირის მიზანთან ახლოს ხარ — ცოტა დაგვრჩა."
  }
};

const ENGAGE_FALLBACKS_EN: Record<string, { title: string; body: string }> = {
  "engage-checkin-morning": {
    "title": "Good morning ☀️",
    "body": "How did you sleep? How are you starting your day? 💚"
  },
  "engage-checkin-mid": {
    "title": "How are you? 👀",
    "body": "I haven't seen you today yet. Is everything okay? 💚"
  },
  "engage-checkin-evening": {
    "title": "The day is almost over 🌙",
    "body": "Before we say goodbye to today — how did your day go?"
  },
  "engage-streak-week": {
    "title": "7 days together 💚",
    "body": "You've been keeping an eye on your health every day for 7 days now. That's a great streak ✨"
  },
  "engage-streak-continue": {
    "title": "Keep it going today? 👀",
    "body": "You've logged something every day for the last 6 days. One small entry keeps the streak going 💚"
  },
  "engage-weekly": {
    "title": "Your week is ready 📊",
    "body": "A lot came together this week. Medi has put together a short summary for you 💚"
  },
  "engage-insight": {
    "title": "I noticed something 👀",
    "body": "I spotted something interesting in your recent data. Want to take a look together?"
  },
  "engage-insight-steps": {
    "title": "I noticed a small change 💚",
    "body": "Your average steps went up this week. That's a good direction 👏"
  },
  "engage-insight-cycle": {
    "title": "I noticed something in your cycle 🌸",
    "body": "A repeating pattern shows up across your last few cycles. Want me to show you?"
  },
  "engage-achieve-steps": {
    "title": "A small win 🎉",
    "body": "You've already collected {steps} steps this week. You may not have counted, but Medi did 😄"
  },
  "engage-achieve-month": {
    "title": "One month together 💚",
    "body": "Medi has been helping you look after your health for a month now. I'm glad you're here."
  },
  "engage-achieve-meds": {
    "title": "That was a good week ✨",
    "body": "You didn't miss a single planned medication dose this week. 💚"
  },
  "engage-hydration": {
    "title": "Did we forget about water? 💧",
    "body": "Even a small sip counts 😄 Have a little water and let's keep going."
  },
  "engage-hydration-low": {
    "title": "Medi's water patrol is here 🚨💧",
    "body": "We're a little short on water today. Start with one glass? 😄"
  },
  "engage-steps-quiet": {
    "title": "It's a quiet day so far 👀",
    "body": "If you feel well, how about a short walk? Even 10 minutes is a lovely start 💚"
  },
  "engage-sleep": {
    "title": "Bedtime is getting close 🌙",
    "body": "Shall we put the phone aside for a while? Medi will be here tomorrow too 💚"
  },
  "engage-sleep-log": {
    "title": "Wrap up the day here? 🌙",
    "body": "How was your day? Before bed, you can note how you feel in 30 seconds."
  },
  "engage-reengage-2": {
    "title": "How are you? 💚",
    "body": "You haven't stopped by in two days. Just wondering — is everything okay?"
  },
  "engage-reengage-5": {
    "title": "Medi is here 👋",
    "body": "We haven't talked in a while. Whenever you feel like it, your health updates are waiting here."
  },
  "engage-reengage-14": {
    "title": "Haven't seen you in a while 👀",
    "body": "No guilt trip 😄 Just a reminder — Medi is still here whenever you need it. 💚"
  },
  "engage-reengage-30": {
    "title": "Start fresh? 🌱",
    "body": "It's been a long break, and that's completely normal. If you like, let's start today with one small entry."
  },
  "engage-feature": {
    "title": "Medi learned something new 👀",
    "body": "I can now summarize your week too. Want me to show you? 💚"
  },
  "engage-morning": {
    "title": "Good morning, {firstName} ☀️",
    "body": "A new day has started. How are you today? 💚"
  },
  "engage-morning-wish": {
    "title": "Good morning ☀️",
    "body": "I'm not asking for anything today — I just wanted to wish you a good day 💚"
  },
  "engage-birthday": {
    "title": "Happy birthday! 🎂💚",
    "body": "Let's skip the health stats today 😄 Just have a wonderful day. — Medi"
  },
  "engage-question": {
    "title": "I have one question 👀",
    "body": "One small detail is missing from your health profile. Shall we fill it in? It takes 10 seconds."
  },
  "engage-chat": {
    "title": "I was thinking about yesterday 💚",
    "body": "How are you today? Is the thing we talked about yesterday any better?"
  },
  "engage-masked": {
    "title": "A reminder from Medi",
    "body": "Stop by when you have a moment 💚"
  },
  "engage-unfinished": {
    "title": "We left something unfinished 👀",
    "body": "We didn't get to finish {task}. Let's pick it up when you have time 💚"
  },
  "engage-unfinished-med": {
    "title": "We left something unfinished 👀",
    "body": "We didn't get to finish adding your medication. Let's pick it up when you have time 💚"
  },
  "engage-visit-followup": {
    "title": "How did your visit go? 💚",
    "body": "When you have a moment, you can tell Medi how it went and whether you got any new recommendations."
  },
  "engage-insight-meds": {
    "title": "I noticed something 💚",
    "body": "A few doses were missed over the last few days. If you like, we can adjust the reminder times to fit your routine."
  },
  "engage-weather-walk": {
    "title": "Nice weather for a short walk ☀️",
    "body": "If you feel like it, there's a pleasant window right now. Medi is just reminding you 💚"
  },
  "engage-weather-rain-soon": {
    "title": "Now is a good time to head out 👀",
    "body": "The chance of rain goes up soon — if you're planning to go out, earlier will be calmer."
  },
  "engage-weather-hot": {
    "title": "It's hot today ☀️",
    "body": "Let's pay a little more attention to water 💧"
  },
  "engage-weather-uv": {
    "title": "The sun is strong today ☀️",
    "body": "If you'll be outside for a long time, sun protection is a good idea."
  },
  "engage-quest-near-complete": {
    "title": "Almost there 💚",
    "body": "If you feel like it, even a little movement will do."
  },
  "engage-quest-weather-window": {
    "title": "Looks like a nice time for a walk ☀️",
    "body": "If you feel like heading out, {windowStart}–{windowEnd} looks like a good window."
  },
  "engage-quest-comeback": {
    "title": "Let's keep it simple today 💚",
    "body": "No records needed — let's just get back into the rhythm."
  },
  "engage-quest-morning-plan": {
    "title": "Today's small plan is ready",
    "body": "I've fitted today's MEDIQUEST to your rhythm — it's there whenever you want it."
  },
  "engage-quest-weekly-progress": {
    "title": "Your weekly mission is going well 💚",
    "body": "You're close to this week's goal — just a little more to go."
  }
};

export const ENGAGE_FALLBACKS: Record<string, { title: string; body: string }> = tx(ENGAGE_FALLBACKS_KA, ENGAGE_FALLBACKS_EN);
