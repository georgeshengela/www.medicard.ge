import type { LabParameter } from '@/types/lab';
import { slugLabKey } from './labExtract.ts';
import { isEn } from '../i18n/locale.js';

export type LabExplain = {
  title: string;
  alsoKnown: string;
  what: string;
  why: string;
  typicalNorm: string;
  high: string;
  low: string;
  note: string;
};

const CATALOG: Record<string, LabExplain> = {
  "crp": {
    "title": "C-რეაქტიული ცილა",
    "alsoKnown": "CRP",
    "what": "CRP არის ცილა, რომელსაც ღვიძლი გამოყოფს, როცა ორგანიზმში ანთება იწყება. ის ანთების სწრაფი მაჩვენებელია და არა კონკრეტული დაავადების სახელი.",
    "why": "ექიმი მას იყენებს ინფექციის, ტრავმის და ქრონიკული ანთების შესაფასებლად. მარტო CRP დიაგნოზს არ სვამს.",
    "typicalNorm": "ხშირად 5 მგ/ლ-ზე ნაკლები ითვლება ნორმად.",
    "high": "მაღალი CRP შეიძლება ნიშნავდეს ინფექციას, ტრავმას ან ქრონიკულ ანთებას.",
    "low": "დაბალი CRP ჩვეულებრივ კარგი ნიშანია — აქტიური ანთება არ ჩანს.",
    "note": "ერთი მაღალი CRP პანიკის მიზეზი არ არის. შეადარე წინა ანალიზებს და აჩვენე ექიმს."
  },
  "hemoglobin": {
    "title": "ჰემოგლობინი",
    "alsoKnown": "Hgb, Hb",
    "what": "ჰემოგლობინი არის ცილა წითელ უჯრედებში, რომელიც ჟანგბადს ფილტვებიდან ქსოვილებამდე მიჰყავს.",
    "why": "აჩვენებს, საკმარისად ატარებს თუ არა სისხლი ჟანგბადს. ანემიის მთავარი ციფრია.",
    "typicalNorm": "ქალებში ხშირად 12-15 გ/დლ, მამაკაცებში 13-17 გ/დლ.",
    "high": "მაღალი მაჩვენებელი შეიძლება იყოს გაუწყლოების, მწეველობის ან მაღალმთიანობის დროს.",
    "low": "დაბალი ჰემოგლობინი ხშირად ანემიაზე მიანიშნებს — რკინის ნაკლებობა, სისხლდენა ან ქრონიკული დაავადება.",
    "note": "მიზეზს მხოლოდ ექიმი ადგენს სხვა ანალიზებთან ერთად."
  },
  "wbc": {
    "title": "ლეიკოციტები",
    "alsoKnown": "WBC",
    "what": "თეთრი უჯრედები იმუნურ სისტემას ეკუთვნის და ინფექციას, ანთებას და უცხო უჯრედებს ებრძვიან.",
    "why": "აჩვენებს, რამდენად აქტიურია ორგანიზმის დაცვა ამ მომენტში.",
    "typicalNorm": "ხშირად 4-10 x10^9/ლ.",
    "high": "მატება ხშირია ბაქტერიული ინფექციის, ანთების, სტრესის ან სტეროიდების დროს.",
    "low": "კლება შეიძლება ვირუსის, ზოგი წამლის ან ძვლის ტვინის პრობლემის ნიშანი იყოს.",
    "note": "ერთი გადახრა სურათს სრულად არ ხატავს. ექიმი ხშირად ფორმულასაც უყურებს."
  },
  "glucose": {
    "title": "გლუკოზა",
    "alsoKnown": "Glucose",
    "what": "სისხლში შაქრის რაოდენობა. უჯრედების მთავარი საწვავია.",
    "why": "დიაბეტის, პრედიაბეტის და შაქრის რყევის შესაფასებლად იზომება.",
    "typicalNorm": "უზმოზე ხშირად 3.9-5.6 მმოლ/ლ. ჭამის შემდეგ უფრო მაღალია.",
    "high": "მაღალი შაქარი შეიძლება დიაბეტს, სტრესს, სტეროიდებს ან ახლახან ჭამას უკავშირდებოდეს.",
    "low": "დაბალი შაქარი თავბრუს, ოფლიანობას, კანკალს იწვევს და სწრაფ რეაგირებას საჭიროებს.",
    "note": "ერთი ციფრი დიაბეტს არ სვამს. ხშირად HbA1c-საც უყურებენ."
  },
  "creatinine": {
    "title": "კრეატინინი",
    "alsoKnown": "Creatinine",
    "what": "კუნთების ცვლის ნარჩენი, რომელსაც თირკმელი სისხლიდან აცლის.",
    "why": "თირკმლის ფილტრის მუშაობის მთავარი მაჩვენებელია.",
    "typicalNorm": "ხშირად 0.6-1.2 მგ/დლ, თუმცა კუნთოვან მასაზეა დამოკიდებული.",
    "high": "მატება შეიძლება თირკმლის დატვირთვას, გაუწყლოებას ან ზოგ წამალს ნიშნავდეს.",
    "low": "დაბალი ციფრი ხშირად დაბალ კუნთოვან მასას უკავშირდება და იშვიათად არის პრობლემა.",
    "note": "ექიმი ხშირად eGFR-საც უყურებს."
  },
  "cholesterol": {
    "title": "საერთო ქოლესტერინი",
    "alsoKnown": "Total cholesterol, TC",
    "what": "საერთო ქოლესტერინი არის ცხიმოვანი ნივთიერება სისხლში. ორგანიზმს სჭირდება უჯრედებისა და ჰორმონებისთვის, მაგრამ სიჭარბე სისხლძარღვებს ტვირთავს.",
    "why": "ექიმი მას გულ-სისხლძარღვთა რისკის შესაფასებლად უყურებს — LDL, HDL და ტრიგლიცერიდებთან ერთად.",
    "typicalNorm": "ხშირად 5.2 მმოლ/ლ-ზე ნაკლები ითვლება სასურველად. ზღვარი ასაკისა და რისკის მიხედვით იცვლება.",
    "high": "მაღალი საერთო ქოლესტერინი შეიძლება ზრდიდეს ათეროსკლეროზის და გულის დაავადების რისკს.",
    "low": "ძალიან დაბალი იშვიათია და ხშირად კვებას, ღვიძლის პრობლემას ან სხვა დაავადებას უკავშირდება.",
    "note": "ერთი ციფრი საკმარისი არ არის. LDL და HDL უფრო ზუსტ სურათს იძლევა. აჩვენე ექიმს."
  },
  "ldl": {
    "title": "LDL ქოლესტერინი",
    "alsoKnown": "LDL-C",
    "what": "LDL ქოლესტერინს ღვიძლიდან ქსოვილებში მიჰყავს. სიჭარბისას ის სისხლძარღვის კედელზე შეიძლება დაგროვდეს.",
    "why": "ეს არის გულის და ინსულტის რისკის ერთ-ერთი მთავარი ლაბორატორიული ციფრი.",
    "typicalNorm": "დაბალი რისკისას ხშირად 3.0 მმოლ/ლ-ზე ნაკლებია სასურველი. მაღალი რისკისას ზღვარი უფრო დაბალია.",
    "high": "მაღალი LDL ზრდის ათეროსკლეროზის რისკს. კვება, გენეტიკა და ნაკლები მოძრაობა ხშირი მიზეზია.",
    "low": "დაბალი LDL ჩვეულებრივ კარგია. ძალიან დაბალი იშვიათად სხვა დაავადებას უკავშირდება.",
    "note": "სამიზნე ციფრი შენს რისკზეა დამოკიდებული. ექიმი წყვეტს, სჭირდება თუ არა მკურნალობა."
  },
  "hdl": {
    "title": "HDL ქოლესტერინი",
    "alsoKnown": "HDL-C",
    "what": "HDL ქოლესტერინს სისხლძარღვებიდან ღვიძლში აბრუნებს, სადაც ის გამოიყოფა. ამიტომ მას ხშირად კარგს ეძახიან.",
    "why": "უფრო მაღალი HDL ჩვეულებრივ გულისთვის უკეთეს სურათს ხატავს.",
    "typicalNorm": "მამაკაცებში ხშირად 1.0 მმოლ/ლ-ზე მეტი, ქალებში 1.2 მმოლ/ლ-ზე მეტი ითვლება სასურველად.",
    "high": "მაღალი HDL ჩვეულებრივ კარგი ნიშანია. იშვიათად ძალიან მაღალი ციფრი სხვა მიზეზს მალავს.",
    "low": "დაბალი HDL ზრდის გულის რისკს, განსაკუთრებით თუ LDL ან ტრიგლიცერიდებიც მაღალია.",
    "note": "მოძრაობა და არაწევა HDL-ს ხშირად აუმჯობესებს. ერთი ციფრი საკმარისი არ არის."
  },
  "triglycerides": {
    "title": "ტრიგლიცერიდები",
    "alsoKnown": "TG, Triglycerides",
    "what": "ტრიგლიცერიდები არის ცხიმები სისხლში, რომლებსაც ორგანიზმი ენერგიის სათადარიგოდ ინახავს. ჭამის შემდეგ იმატებენ.",
    "why": "მაღალი ტრიგლიცერიდები გულის რისკს და პანკრეასის დატვირთვას უკავშირდება.",
    "typicalNorm": "უზმოზე ხშირად 1.7 მმოლ/ლ-ზე ნაკლები ითვლება სასურველად.",
    "high": "მატება ხშირია ტკბილის, ალკოჰოლის, ჭარბი წონის, დიაბეტის ან ჰიპოთირეოზის დროს.",
    "low": "დაბალი ტრიგლიცერიდები ჩვეულებრივ პრობლემა არ არის.",
    "note": "ანალიზი უზმოზე უფრო ზუსტია. ექიმი მას ქოლესტერინის პანელთან ერთად კითხულობს."
  },
  "rbc": {
    "title": "ერითროციტები",
    "alsoKnown": "RBC",
    "what": "წითელი უჯრედები ჰემოგლობინს ატარებენ და ჟანგბადს სხეულში ანაწილებენ.",
    "why": "ანემიის, გაუწყლოების და სისხლის წარმოების შესაფასებლად იზომება.",
    "typicalNorm": "ქალებში ხშირად 3.8-5.2 x10^12/ლ, მამაკაცებში 4.5-5.9 x10^12/ლ.",
    "high": "მატება შეიძლება გაუწყლოებას, მწეველობას ან ჟანგბადის ნაკლებობას ნიშნავდეს.",
    "low": "კლება ანემიაზე ან სისხლის დაკარგვაზე მიანიშნებს.",
    "note": "ექიმი ჰემოგლობინს და ჰემატოკრიტსაც ერთად უყურებს."
  },
  "hct": {
    "title": "ჰემატოკრიტი",
    "alsoKnown": "Hct",
    "what": "ჰემატოკრიტი აჩვენებს, სისხლის რა წილი უჭირავს წითელ უჯრედებს.",
    "why": "ანემიის და გაუწყლოების სწრაფი სურათია, ჰემოგლობინთან ერთად.",
    "typicalNorm": "ქალებში ხშირად 36-46%, მამაკაცებში 41-53%.",
    "high": "მაღალი ჰემატოკრიტი ხშირად გაუწყლოებას ან სისხლის გასქელებას ნიშნავს.",
    "low": "დაბალი ჰემატოკრიტი ანემიას ან სისხლდენას უკავშირდება.",
    "note": "ერთი ციფრი საკმარისი არ არის — ჰემოგლობინიც უნდა შეადარო."
  },
  "plt": {
    "title": "თრომბოციტები",
    "alsoKnown": "PLT, Platelets",
    "what": "თრომბოციტები პატარა უჯრედებია, რომლებიც სისხლდენისას თრომბს აწყობენ.",
    "why": "აჩვენებს, როგორ იცავს ორგანიზმი თავს სისხლდენისგან.",
    "typicalNorm": "ხშირად 150-400 x10^9/ლ.",
    "high": "მატება შეიძლება ანთებას, რკინის ნაკლებობას ან იშვიათ ძვლის ტვინის პრობლემას ნიშნავდეს.",
    "low": "კლება ზრდის სისხლდენის რისკს. მიზეზი შეიძლება იყოს ვირუსი, წამალი ან იმუნური რეაქცია.",
    "note": "ძალიან დაბალი ან ძალიან მაღალი ციფრი ექიმს უნდა აჩვენო."
  },
  "mcv": {
    "title": "საშუალო ერითროციტული მოცულობა",
    "alsoKnown": "MCV",
    "what": "MCV აჩვენებს წითელი უჯრედის საშუალო ზომას.",
    "why": "ეხმარება ანემიის ტიპის გარჩევაში — რკინის ნაკლებობა თუ B12 ან ფოლატი.",
    "typicalNorm": "ხშირად 80-96 ფლ.",
    "high": "დიდი უჯრედები ხშირად B12 ან ფოლატის ნაკლებობას, ალკოჰოლს ან ღვიძლის დატვირთვას უკავშირდება.",
    "low": "პატარა უჯრედები ხშირად რკინის ნაკლებობის ან თალასემიის ნიშანია.",
    "note": "MCV მარტო დიაგნოზს არ სვამს. ჰემოგლობინი და ფერიტინი ერთად იკითხება."
  },
  "urea": {
    "title": "შარდოვანა",
    "alsoKnown": "Urea, BUN",
    "what": "შარდოვანა არის ცილის ცვლის ნარჩენი, რომელსაც თირკმელი შარდით აცლის.",
    "why": "თირკმლის მუშაობის, გაუწყლოების და ცილოვანი კვების შესაფასებლად იზომება.",
    "typicalNorm": "ხშირად 2.5-7.5 მმოლ/ლ.",
    "high": "მატება შეიძლება გაუწყლოებას, თირკმლის დატვირთვას ან ცილით მდიდარ კვებას ნიშნავდეს.",
    "low": "დაბალი ციფრი ხშირად ღვიძლის პრობლემას ან დაბალ ცილოვან კვებას უკავშირდება.",
    "note": "ექიმი მას კრეატინინთან ერთად კითხულობს."
  },
  "uric_acid": {
    "title": "შარდმჟავა",
    "alsoKnown": "Uric acid",
    "what": "შარდმჟავა არის პურინების ცვლის ნარჩენი. სიჭარბისას კრისტალებად შეიძლება დაგროვდეს.",
    "why": "პოდაგრის, თირკმლის ქვების და მეტაბოლური რისკის შესაფასებლად იზომება.",
    "typicalNorm": "ხშირად 180-420 მკმოლ/ლ, ლაბორატორიის მიხედვით.",
    "high": "მაღალი შარდმჟავა შეიძლება პოდაგრას, გაუწყლოებას ან ცილით და ალკოჰოლით მდიდარ კვებას უკავშირდებოდეს.",
    "low": "დაბალი იშვიათად არის პრობლემა.",
    "note": "მაღალი ციფრი ყოველთვის არ ნიშნავს პოდაგრას. ექიმი სიმპტომებსაც უყურებს."
  },
  "alt": {
    "title": "ალანინამინოტრანსფერაზა",
    "alsoKnown": "ALT, ALAT, GPT",
    "what": "ALT არის ფერმენტი, რომელიც ძირითადად ღვიძლის უჯრედებშია. უჯრედების დაზიანებისას სისხლში იმატებს.",
    "why": "ღვიძლის ანთების და დაზიანების ერთ-ერთი მთავარი მაჩვენებელია.",
    "typicalNorm": "ხშირად 10-40 ერთ/ლ. ზღვარი ლაბორატორიით იცვლება.",
    "high": "მატება შეიძლება ვირუსულ ჰეპატიტს, ცხიმოვან ღვიძლს, ალკოჰოლს ან ზოგ წამალს უკავშირდებოდეს.",
    "low": "დაბალი ALT ჩვეულებრივ პრობლემა არ არის.",
    "note": "ექიმი AST-საც ადარებს. ერთი მაღალი ALT პანიკის მიზეზი არ არის."
  },
  "ast": {
    "title": "ასპარტატამინოტრანსფერაზა",
    "alsoKnown": "AST, ASAT, GOT",
    "what": "AST არის ფერმენტი ღვიძლში, გულსა და კუნთებში. დაზიანებისას სისხლში იმატებს.",
    "why": "ღვიძლის და ზოგჯერ კუნთის ან გულის დატვირთვის შესაფასებლად იზომება.",
    "typicalNorm": "ხშირად 10-40 ერთ/ლ.",
    "high": "მატება შეიძლება ღვიძლის ანთებას, ალკოჰოლს, ინტენსიურ ვარჯიშს ან კუნთის დაზიანებას ნიშნავდეს.",
    "low": "დაბალი AST ჩვეულებრივ პრობლემა არ არის.",
    "note": "ALT-თან შედარება ეხმარება წყაროს გარჩევაში. აჩვენე ექიმს."
  },
  "ggt": {
    "title": "გამა-გლუტამილტრანსფერაზა",
    "alsoKnown": "GGT, Gamma-GT",
    "what": "GGT არის ფერმენტი ღვიძლში და ნაღვლის გზებში. მათი დატვირთვისას სისხლში იმატებს.",
    "why": "ღვიძლის, ნაღვლის და ალკოჰოლის გავლენის შესაფასებლად იზომება.",
    "typicalNorm": "ხშირად 10-50 ერთ/ლ, სქესის მიხედვით.",
    "high": "მატება ხშირია ალკოჰოლის, ზოგი წამლის, ნაღვლის გზის პრობლემის ან ცხიმოვანი ღვიძლის დროს.",
    "low": "დაბალი GGT ჩვეულებრივ კარგია.",
    "note": "მარტო GGT დიაგნოზს არ სვამს. ALT და ALP ერთად იკითხება."
  },
  "alp": {
    "title": "ტუტე ფოსფატაზა",
    "alsoKnown": "ALP",
    "what": "ALP არის ფერმენტი ღვიძლში, ძვლებში და ნაღვლის გზებში.",
    "why": "ნაღვლის გზის, ღვიძლის და ძვლის ცვლის შესაფასებლად იზომება.",
    "typicalNorm": "მოზრდილებში ხშირად 40-130 ერთ/ლ. ბავშვებში უფრო მაღალია, რადგან ძვალი იზრდება.",
    "high": "მატება შეიძლება ნაღვლის გზის დაბრკოლებას, ღვიძლის ანთებას ან ძვლის აქტიურ ცვლას ნიშნავდეს.",
    "low": "დაბალი ALP იშვიათია და ხშირად კვებას უკავშირდება.",
    "note": "ექიმი GGT-საც უყურებს, რომ ღვიძლი და ძვალი გაარჩიოს."
  },
  "bilirubin": {
    "title": "ბილირუბინი",
    "alsoKnown": "Bilirubin",
    "what": "ბილირუბინი არის ჰემოგლობინის ცვლის ყვითელი პიგმენტი, რომელსაც ღვიძლი ამუშავებს.",
    "why": "ღვიძლის, ნაღვლის გზის და სისხლის რღვევის შესაფასებლად იზომება.",
    "typicalNorm": "საერთო ბილირუბინი ხშირად 20 მკმოლ/ლ-ზე ნაკლებია.",
    "high": "მატება შეიძლება სიყვითლეს, ჰეპატიტს, ნაღვლის ქვას ან უვნებელ ჟილბერის სინდრომს უკავშირდებოდეს.",
    "low": "დაბალი ბილირუბინი ჩვეულებრივ პრობლემა არ არის.",
    "note": "სიყვითლე ან ძალიან მაღალი ციფრი ექიმთან მისვლის მიზეზია."
  },
  "tsh": {
    "title": "თირეოტროპინი",
    "alsoKnown": "TSH",
    "what": "TSH არის ჰიპოფიზის ჰორმონი, რომელიც ფარისებრ ჯირკვალს ეუბნება, რამდენი ჰორმონი აწარმოოს.",
    "why": "ფარისებრი ჯირკვლის ჰიპო- და ჰიპერფუნქციის მთავარი სკრინინგია.",
    "typicalNorm": "ხშირად 0.4-4.0 მერთ/ლ. ორსულობაში ზღვარი იცვლება.",
    "high": "მაღალი TSH ხშირად ნიშნავს, რომ ფარისებრი ჯირკვალი ნაკლებად მუშაობს.",
    "low": "დაბალი TSH შეიძლება ჰიპერთირეოზს ან ზედმეტ ჩანაცვლებას ნიშნავდეს.",
    "note": "ექიმი ხშირად FT4-საც უყურებს. ერთი TSH მკურნალობას არ ნიშნავს."
  },
  "ft4": {
    "title": "თავისუფალი T4",
    "alsoKnown": "FT4",
    "what": "T4 არის ფარისებრი ჯირკვლის მთავარი ჰორმონი. თავისუფალი ფრაქცია აქტიურია.",
    "why": "TSH-თან ერთად აჩვენებს, რეალურად საკმარისი ჰორმონი არის თუ არა.",
    "typicalNorm": "ხშირად 10-22 პმოლ/ლ, ლაბორატორიის მიხედვით.",
    "high": "მაღალი FT4 ჰიპერთირეოზზე ან ზედმეტ ჩანაცვლებაზე მიანიშნებს.",
    "low": "დაბალი FT4 ჰიპოთირეოზზე მიანიშნებს.",
    "note": "TSH-ის გარეშე სურათი არასრულია."
  },
  "ferritin": {
    "title": "ფერიტინი",
    "alsoKnown": "Ferritin",
    "what": "ფერიტინი არის ცილა, რომელშიც ორგანიზმი რკინას ინახავს. აჩვენებს რკინის მარაგს.",
    "why": "რკინის ნაკლებობის და ზოგჯერ ანთების შესაფასებლად იზომება.",
    "typicalNorm": "ქალებში ხშირად 15-150 ნგ/მლ, მამაკაცებში 30-400 ნგ/მლ.",
    "high": "მაღალი ფერიტინი შეიძლება ანთებას, ღვიძლის დატვირთვას ან რკინის სიჭარბეს ნიშნავდეს.",
    "low": "დაბალი ფერიტინი რკინის ნაკლებობის ყველაზე ადრეული ნიშანია.",
    "note": "ანთების დროს ფერიტინი ხელოვნურად იმატებს. ექიმი რკინასაც უყურებს."
  },
  "iron": {
    "title": "რკინა",
    "alsoKnown": "Serum iron, Fe",
    "what": "სისხლის შრატში არსებული რკინა, რომელიც ჰემოგლობინისთვის არის საჭირო.",
    "why": "ანემიის და რკინის მარაგის შესაფასებლად იზომება, ფერიტინთან ერთად.",
    "typicalNorm": "ხშირად 10-30 მკმოლ/ლ. დღის განმავლობაში იცვლება.",
    "high": "მაღალი რკინა შეიძლება ჰემოქრომატოზს, ღვიძლის დაზიანებას ან ზედმეტ დანამატს ნიშნავდეს.",
    "low": "დაბალი რკინა ხშირად ნაკლებ მიღებას, სისხლდენას ან ცუდ შეწოვას უკავშირდება.",
    "note": "მარტო რკინა არასტაბილურია. ფერიტინი უფრო საიმედო მარაგია."
  },
  "vitamin_d": {
    "title": "ვიტამინი D",
    "alsoKnown": "25-OH D",
    "what": "ვიტამინი D ეხმარება კალციუმის შეწოვას, ძვლებს და იმუნურ სისტემას. ძირითადად მზით იწარმოება.",
    "why": "ნაკლებობა ხშირია და ძვლების სისუსტეს, დაღლილობას უკავშირდება.",
    "typicalNorm": "ხშირად 30-50 ნგ/მლ ითვლება საკმარისად.",
    "high": "ძალიან მაღალი თითქმის ყოველთვის ზედმეტი დანამატისგანაა.",
    "low": "დაბალი ვიტამინი D ხშირია ნაკლები მზის ან ცუდი შეწოვის დროს.",
    "note": "დანამატის დოზას ექიმი გირჩევს. თვითნებურად დიდი დოზა არ მიიღო."
  },
  "vitamin_b12": {
    "title": "ვიტამინი B12",
    "alsoKnown": "Cobalamin, B12",
    "what": "B12 სჭირდება ნერვებს და წითელი უჯრედების წარმოებას. ძირითადად ცხოველურ საკვებშია.",
    "why": "ანემიის, ჩხვლეტის და ვეგეტარიანული კვების შეფასებისას იზომება.",
    "typicalNorm": "ხშირად 200-900 პგ/მლ.",
    "high": "მაღალი B12 ხშირად დანამატისგანაა და იშვიათად არის პრობლემა.",
    "low": "დაბალი B12 იწვევს ანემიას, დაღლილობას, ჩხვლეტას.",
    "note": "ნაკლებობა წლებით გროვდება. მკურნალობას ექიმი ნიშნავს."
  },
  "hba1c": {
    "title": "გლიკირებული ჰემოგლობინი",
    "alsoKnown": "HbA1c",
    "what": "HbA1c აჩვენებს, ბოლო 2-3 თვეში საშუალოდ რამდენი შაქარი ჰქონდა სისხლს.",
    "why": "დიაბეტის დიაგნოზისა და კონტროლის მთავარი გრძელვადიანი ციფრია.",
    "typicalNorm": "ხშირად 5.7%-ზე ნაკლები ნორმაა, 5.7-6.4% პრედიაბეტი, 6.5%-დან დიაბეტის ზღვარი.",
    "high": "მაღალი HbA1c ნიშნავს, რომ შაქარი დიდი ხანია აწეულია.",
    "low": "ძალიან დაბალი შეიძლება ხშირ ჰიპოგლიკემიას ან ანემიას უკავშირდებოდეს.",
    "note": "გეგმას ექიმი ადგენს. ერთი ციფრი საკმარისი არ არის მკურნალობის შესაცვლელად."
  },
  "sodium": {
    "title": "ნატრიუმი",
    "alsoKnown": "Na",
    "what": "ნატრიუმი არის მარილის მთავარი იონი სისხლში. წყალს და ნერვულ სიგნალს არეგულირებს.",
    "why": "გაუწყლოების, შეშუპების და ზოგი წამლის გავლენის შესაფასებლად იზომება.",
    "typicalNorm": "ხშირად 135-145 მმოლ/ლ.",
    "high": "მაღალი ნატრიუმი ხშირად წყლის ნაკლებობას ნიშნავს.",
    "low": "დაბალი ნატრიუმი თავბრუს და სისუსტეს იწვევს.",
    "note": "ძლიერი გადახრა სასწრაფო შეფასებას საჭიროებს."
  },
  "potassium": {
    "title": "კალიუმი",
    "alsoKnown": "K",
    "what": "კალიუმი ნერვებს, კუნთებს და გულის რიტმს არეგულირებს.",
    "why": "გულის და თირკმლის მდგომარეობის, აგრეთვე შარდმდენების კონტროლისთვის იზომება.",
    "typicalNorm": "ხშირად 3.5-5.1 მმოლ/ლ.",
    "high": "მაღალი კალიუმი გულის რიტმისთვის საშიშია.",
    "low": "დაბალი კალიუმი სისუსტეს და არითმიას იწვევს.",
    "note": "ძლიერ გადახრას ნუ გადადებ — აჩვენე ექიმს."
  },
  "calcium": {
    "title": "კალციუმი",
    "alsoKnown": "Ca",
    "what": "კალციუმი ძვლებს, კუნთებს და ნერვულ სიგნალს სჭირდება.",
    "why": "ფარისებრი გვერდითა ჯირკვლების, ძვლის და ვიტამინ D-ის შესაფასებლად იზომება.",
    "typicalNorm": "ხშირად 2.15-2.55 მმოლ/ლ.",
    "high": "მაღალი კალციუმი შეიძლება პარათირეოიდულ პრობლემას ან დანამატს ნიშნავდეს.",
    "low": "დაბალი კალციუმი ჩხვლეტას და კუნთის სპაზმს იწვევს.",
    "note": "ექიმი ხშირად ალბუმინსაც ადარებს."
  },
  "albumin": {
    "title": "ალბუმინი",
    "alsoKnown": "Albumin",
    "what": "ალბუმინი არის ღვიძლის მთავარი ცილა სისხლში. წყალს სისხლძარღვში ინახავს.",
    "why": "კვების, ღვიძლის და თირკმლის მდგომარეობის შესაფასებლად იზომება.",
    "typicalNorm": "ხშირად 35-50 გ/ლ.",
    "high": "მაღალი ალბუმინი ხშირად გაუწყლოებას ნიშნავს.",
    "low": "დაბალი ალბუმინი შეიძლება ღვიძლის სისუსტეს ან ცუდ კვებას ნიშნავდეს.",
    "note": "ნელა იცვლება. ერთი ციფრი მწვავე სურათს სრულად არ ხატავს."
  },
  "esr": {
    "title": "ერითროციტების დალექვა",
    "alsoKnown": "ESR, SOE",
    "what": "ESR აჩვენებს, რამდენად სწრაფად ილექებიან წითელი უჯრედები სინჯარაში. ანთებისას უფრო სწრაფად ილექებიან.",
    "why": "ანთების ძველი, მაგრამ ჯერ კიდევ სასარგებლო მაჩვენებელია.",
    "typicalNorm": "ხშირად 20 მმ/სთ-ზე ნაკლები, ასაკთან ერთად იმატებს.",
    "high": "მაღალი ESR ანთებას, ინფექციას ან ანემიას შეიძლება ნიშნავდეს.",
    "low": "დაბალი ESR ჩვეულებრივ პრობლემა არ არის.",
    "note": "არ არის კონკრეტული დაავადების სახელი. CRP უფრო სწრაფი ანთების ნიშანია."
  },
  "neutrophils": {
    "title": "ნეიტროფილები",
    "alsoKnown": "NEU",
    "what": "ნეიტროფილები თეთრი უჯრედების ყველაზე დიდი ჯგუფია და ძირითადად ბაქტერიებს ებრძვიან.",
    "why": "ინფექციის ტიპისა და ძვლის ტვინის პასუხის გასარჩევად იზომება.",
    "typicalNorm": "ხშირად 1.8-7.5 x10^9/ლ.",
    "high": "მატება ხშირია ბაქტერიული ინფექციის, სტრესის ან სტეროიდების დროს.",
    "low": "კლება ზრდის ინფექციის რისკს.",
    "note": "ექიმი საერთო WBC-საც უყურებს."
  },
  "lymphocytes": {
    "title": "ლიმფოციტები",
    "alsoKnown": "LYM",
    "what": "ლიმფოციტები ვირუსებს ებრძვიან და იმუნურ მეხსიერებას ქმნიან.",
    "why": "ვირუსული ინფექციის და იმუნური სტატუსის შესაფასებლად იზომება.",
    "typicalNorm": "ხშირად 1.0-3.5 x10^9/ლ.",
    "high": "მატება ხშირია ვირუსის დროს.",
    "low": "კლება შეიძლება სტრესს ან სტეროიდებს ნიშნავდეს.",
    "note": "ფორმულა მთლიანად იკითხება."
  },
  "psa": {
    "title": "PSA",
    "alsoKnown": "პროსტატის სპეციფიკური ანტიგენი",
    "what": "PSA არის ცილა, რომელსაც პროსტატა გამოყოფს. სისხლში მატება პროსტატის ცვლილებაზე მიანიშნებს.",
    "why": "პროსტატის გადიდების, ანთების და სიმსივნის რისკის შესაფასებლად იზომება.",
    "typicalNorm": "ხშირად 4 ნგ/მლ-ზე ნაკლები, ასაკთან ერთად იმატებს.",
    "high": "მაღალი PSA შეიძლება ანთებას, გადიდებას ან სიმსივნეს ნიშნავდეს — არა ავტომატურად კიბოს.",
    "low": "დაბალი PSA ჩვეულებრივ დამამშვიდებელია.",
    "note": "PSA დიაგნოზს არ სვამს. გადაწყვეტილებას უროლოგი იღებს."
  },
  "inr": {
    "title": "INR",
    "alsoKnown": "საერთაშორისო ნორმალიზებული თანაფარდობა",
    "what": "INR აჩვენებს, რამდენ ხანში შედედდება სისხლი. ვარფარინზე მყოფთათვის განსაკუთრებით მნიშვნელოვანია.",
    "why": "სისხლის განზავების კონტროლისა და სისხლდენის რისკის შესაფასებლად იზომება.",
    "typicalNorm": "წამლის გარეშე ხშირად 0.8-1.2. ვარფარინზე სამიზნე ხშირად 2-3-ია.",
    "high": "მაღალი INR ნიშნავს, რომ სისხლი ნელა შედედდება და სისხლდენის რისკი იზრდება.",
    "low": "დაბალი INR წამალზე მყოფთათვის თრომბის რისკს ზრდის.",
    "note": "დოზას მხოლოდ ექიმი ცვლის. თვითონ ნუ შეცვლი აბს."
  }
};

type EnExplain = [title: string, alsoKnown: string, what: string, why: string, typicalNorm: string, high: string, low: string, note: string];

/** English copy for the same catalog (same keys, same caution level). */
const CATALOG_EN_ROWS: Record<string, EnExplain> = {
  crp: ['C-reactive protein', 'CRP',
    'CRP is a protein your liver releases when inflammation starts in the body. It is a fast marker of inflammation, not the name of a specific disease.',
    'Doctors use it to assess infection, injury and chronic inflammation. CRP alone does not make a diagnosis.',
    'Often under 5 mg/L is considered normal.',
    'High CRP can mean an infection, an injury or chronic inflammation.',
    'Low CRP is usually a good sign — no active inflammation is visible.',
    'One high CRP is no reason to panic. Compare it with earlier results and show it to your doctor.'],
  hemoglobin: ['Hemoglobin', 'Hgb, Hb',
    'Hemoglobin is the protein in red blood cells that carries oxygen from your lungs to your tissues.',
    'It shows whether your blood carries enough oxygen. It is the main number for anemia.',
    'Often 12–15 g/dL in women and 13–17 g/dL in men.',
    'A high value can happen with dehydration, smoking or living at high altitude.',
    'Low hemoglobin often points to anemia — iron deficiency, bleeding or a chronic illness.',
    'Only a doctor can find the cause, together with other tests.'],
  wbc: ['White blood cells', 'WBC',
    'White blood cells are part of the immune system and fight infection, inflammation and foreign cells.',
    'It shows how active your body’s defenses are right now.',
    'Often 4–10 x10^9/L.',
    'A rise is common with bacterial infection, inflammation, stress or steroids.',
    'A drop can be a sign of a virus, some medicines or a bone marrow problem.',
    'One out-of-range value doesn’t tell the whole story. Doctors often look at the differential too.'],
  glucose: ['Glucose', 'Blood sugar',
    'The amount of sugar in your blood. It is the main fuel for your cells.',
    'It is measured to assess diabetes, prediabetes and swings in blood sugar.',
    'Fasting, often 3.9–5.6 mmol/L. It is higher after eating.',
    'High sugar can be linked to diabetes, stress, steroids or a recent meal.',
    'Low sugar causes dizziness, sweating and shaking and needs a quick response.',
    'One number does not diagnose diabetes. HbA1c is often checked too.'],
  creatinine: ['Creatinine', 'Creatinine',
    'A waste product of muscle metabolism that your kidneys clear from the blood.',
    'It is the main marker of how well your kidneys filter.',
    'Often 0.6–1.2 mg/dL, though it depends on muscle mass.',
    'A rise can mean strain on the kidneys, dehydration or some medicines.',
    'A low number is often linked to low muscle mass and is rarely a problem.',
    'Doctors often look at eGFR too.'],
  cholesterol: ['Total cholesterol', 'Total cholesterol, TC',
    'Total cholesterol is a fatty substance in your blood. Your body needs it for cells and hormones, but too much puts strain on blood vessels.',
    'Doctors use it to assess heart and blood vessel risk — together with LDL, HDL and triglycerides.',
    'Often under 5.2 mmol/L is considered desirable. The cut-off changes with age and risk.',
    'High total cholesterol can raise the risk of atherosclerosis and heart disease.',
    'Very low is rare and is often linked to diet, a liver problem or another illness.',
    'One number isn’t enough. LDL and HDL give a clearer picture. Show it to your doctor.'],
  ldl: ['LDL cholesterol', 'LDL-C',
    'LDL carries cholesterol from the liver to your tissues. When there is too much, it can build up in the walls of blood vessels.',
    'It is one of the main lab numbers for heart attack and stroke risk.',
    'At low risk, under 3.0 mmol/L is often desirable. At high risk the target is lower.',
    'High LDL raises the risk of atherosclerosis. Diet, genetics and too little movement are common causes.',
    'Low LDL is usually good. Very low is rarely linked to another illness.',
    'Your target depends on your risk. Your doctor decides whether you need treatment.'],
  hdl: ['HDL cholesterol', 'HDL-C',
    'HDL carries cholesterol from your blood vessels back to the liver, where it is removed. That is why it is often called the good cholesterol.',
    'Higher HDL usually means a better picture for your heart.',
    'Often above 1.0 mmol/L in men and above 1.2 mmol/L in women is considered desirable.',
    'High HDL is usually a good sign. Rarely, a very high number hides another cause.',
    'Low HDL raises heart risk, especially if LDL or triglycerides are also high.',
    'Exercise and not smoking often improve HDL. One number isn’t enough.'],
  triglycerides: ['Triglycerides', 'TG, Triglycerides',
    'Triglycerides are fats in your blood that your body stores as an energy reserve. They rise after eating.',
    'High triglycerides are linked to heart risk and strain on the pancreas.',
    'Fasting, often under 1.7 mmol/L is considered desirable.',
    'A rise is common with sweets, alcohol, excess weight, diabetes or an underactive thyroid.',
    'Low triglycerides are usually not a problem.',
    'The test is more accurate when fasting. Doctors read it together with the cholesterol panel.'],
  rbc: ['Red blood cells', 'RBC',
    'Red blood cells carry hemoglobin and deliver oxygen around your body.',
    'It is measured to assess anemia, dehydration and blood production.',
    'Often 3.8–5.2 x10^12/L in women and 4.5–5.9 x10^12/L in men.',
    'A rise can mean dehydration, smoking or a lack of oxygen.',
    'A drop points to anemia or blood loss.',
    'Doctors look at hemoglobin and hematocrit together with it.'],
  hct: ['Hematocrit', 'Hct',
    'Hematocrit shows what share of your blood is made up of red blood cells.',
    'Together with hemoglobin, it is a quick picture of anemia and dehydration.',
    'Often 36–46% in women and 41–53% in men.',
    'High hematocrit often means dehydration or thickened blood.',
    'Low hematocrit is linked to anemia or bleeding.',
    'One number isn’t enough — compare it with hemoglobin too.'],
  plt: ['Platelets', 'PLT, Platelets',
    'Platelets are small cells that form clots when you bleed.',
    'It shows how well your body protects itself from bleeding.',
    'Often 150–400 x10^9/L.',
    'A rise can mean inflammation, iron deficiency or a rare bone marrow problem.',
    'A drop raises the risk of bleeding. The cause can be a virus, a medicine or an immune reaction.',
    'A very low or very high number should be shown to a doctor.'],
  mcv: ['Mean corpuscular volume', 'MCV',
    'MCV shows the average size of your red blood cells.',
    'It helps tell types of anemia apart — iron deficiency versus B12 or folate.',
    'Often 80–96 fL.',
    'Large cells are often linked to B12 or folate deficiency, alcohol or strain on the liver.',
    'Small cells are often a sign of iron deficiency or thalassemia.',
    'MCV alone does not make a diagnosis. Hemoglobin and ferritin are read together with it.'],
  urea: ['Urea', 'Urea, BUN',
    'Urea is a waste product of protein metabolism that your kidneys clear through urine.',
    'It is measured to assess kidney function, dehydration and protein intake.',
    'Often 2.5–7.5 mmol/L.',
    'A rise can mean dehydration, strain on the kidneys or a high-protein diet.',
    'A low number is often linked to a liver problem or a low-protein diet.',
    'Doctors read it together with creatinine.'],
  uric_acid: ['Uric acid', 'Uric acid',
    'Uric acid is a waste product of purine metabolism. When there is too much, it can build up as crystals.',
    'It is measured to assess gout, kidney stones and metabolic risk.',
    'Often 180–420 µmol/L, depending on the lab.',
    'High uric acid can be linked to gout, dehydration or a diet rich in protein and alcohol.',
    'Low is rarely a problem.',
    'A high number doesn’t always mean gout. Doctors look at symptoms too.'],
  alt: ['ALT', 'Alanine aminotransferase, ALAT, GPT',
    'ALT is an enzyme found mainly in liver cells. It rises in the blood when those cells are damaged.',
    'It is one of the main markers of liver inflammation and damage.',
    'Often 10–40 U/L. The cut-off varies by lab.',
    'A rise can be linked to viral hepatitis, fatty liver, alcohol or some medicines.',
    'Low ALT is usually not a problem.',
    'Doctors compare it with AST. One high ALT is no reason to panic.'],
  ast: ['AST', 'Aspartate aminotransferase, ASAT, GOT',
    'AST is an enzyme in the liver, heart and muscles. It rises in the blood when they are damaged.',
    'It is measured to assess the liver and sometimes strain on muscles or the heart.',
    'Often 10–40 U/L.',
    'A rise can mean liver inflammation, alcohol, intense exercise or muscle damage.',
    'Low AST is usually not a problem.',
    'Comparing it with ALT helps tell where it comes from. Show it to your doctor.'],
  ggt: ['GGT', 'Gamma-glutamyl transferase, Gamma-GT',
    'GGT is an enzyme in the liver and bile ducts. It rises in the blood when they are under strain.',
    'It is measured to assess the liver, the bile ducts and the effect of alcohol.',
    'Often 10–50 U/L, depending on sex.',
    'A rise is common with alcohol, some medicines, a bile duct problem or fatty liver.',
    'Low GGT is usually good.',
    'GGT alone does not make a diagnosis. ALT and ALP are read together with it.'],
  alp: ['Alkaline phosphatase', 'ALP',
    'ALP is an enzyme in the liver, bones and bile ducts.',
    'It is measured to assess the bile ducts, the liver and bone turnover.',
    'Often 40–130 U/L in adults. It is higher in children because their bones are growing.',
    'A rise can mean a bile duct blockage, liver inflammation or active bone turnover.',
    'Low ALP is rare and is often linked to diet.',
    'Doctors look at GGT too, to tell the liver and bone apart.'],
  bilirubin: ['Bilirubin', 'Bilirubin',
    'Bilirubin is a yellow pigment from the breakdown of hemoglobin, which your liver processes.',
    'It is measured to assess the liver, the bile ducts and the breakdown of blood cells.',
    'Total bilirubin is often under 20 µmol/L.',
    'A rise can be linked to jaundice, hepatitis, gallstones or harmless Gilbert’s syndrome.',
    'Low bilirubin is usually not a problem.',
    'Yellowing of the skin or eyes, or a very high number, is a reason to see a doctor.'],
  tsh: ['TSH', 'Thyroid-stimulating hormone',
    'TSH is a pituitary hormone that tells your thyroid how much hormone to make.',
    'It is the main screening test for an underactive or overactive thyroid.',
    'Often 0.4–4.0 mIU/L. The range changes in pregnancy.',
    'High TSH often means your thyroid is working less.',
    'Low TSH can mean an overactive thyroid or too much replacement hormone.',
    'Doctors often look at FT4 too. One TSH result doesn’t mean treatment.'],
  ft4: ['Free T4', 'FT4',
    'T4 is the main thyroid hormone. The free fraction is the active one.',
    'Together with TSH, it shows whether you really have enough hormone.',
    'Often 10–22 pmol/L, depending on the lab.',
    'High FT4 points to an overactive thyroid or too much replacement hormone.',
    'Low FT4 points to an underactive thyroid.',
    'Without TSH the picture is incomplete.'],
  ferritin: ['Ferritin', 'Ferritin',
    'Ferritin is the protein your body stores iron in. It shows your iron reserves.',
    'It is measured to assess iron deficiency and sometimes inflammation.',
    'Often 15–150 ng/mL in women and 30–400 ng/mL in men.',
    'High ferritin can mean inflammation, strain on the liver or iron overload.',
    'Low ferritin is the earliest sign of iron deficiency.',
    'Inflammation can push ferritin up artificially. Doctors look at iron too.'],
  iron: ['Serum iron', 'Serum iron, Fe',
    'The iron in your blood serum, which your body needs to make hemoglobin.',
    'It is measured with ferritin to assess anemia and iron reserves.',
    'Often 10–30 µmol/L. It changes over the day.',
    'High iron can mean hemochromatosis, liver damage or too many supplements.',
    'Low iron is often linked to low intake, bleeding or poor absorption.',
    'Iron alone is unstable. Ferritin is a more reliable measure of reserves.'],
  vitamin_d: ['Vitamin D', '25-OH D',
    'Vitamin D helps you absorb calcium and supports your bones and immune system. Your body makes it mostly from sunlight.',
    'Deficiency is common and is linked to weak bones and tiredness.',
    'Often 30–50 ng/mL is considered sufficient.',
    'Very high levels almost always come from too many supplements.',
    'Low vitamin D is common with little sun or poor absorption.',
    'Your doctor will recommend a supplement dose. Don’t take large doses on your own.'],
  vitamin_b12: ['Vitamin B12', 'Cobalamin, B12',
    'B12 is needed for your nerves and to make red blood cells. It is found mainly in animal foods.',
    'It is measured when assessing anemia, tingling or a vegetarian diet.',
    'Often 200–900 pg/mL.',
    'High B12 usually comes from supplements and is rarely a problem.',
    'Low B12 causes anemia, tiredness and tingling.',
    'Deficiency builds up over years. Treatment is prescribed by a doctor.'],
  hba1c: ['HbA1c', 'Glycated hemoglobin',
    'HbA1c shows your average blood sugar over the last 2–3 months.',
    'It is the main long-term number for diagnosing and managing diabetes.',
    'Often under 5.7% is normal, 5.7–6.4% is prediabetes, and 6.5% and above is the diabetes threshold.',
    'High HbA1c means your blood sugar has been raised for a long time.',
    'Very low can be linked to frequent low blood sugar or anemia.',
    'Your doctor sets the plan. One number isn’t enough to change treatment.'],
  sodium: ['Sodium', 'Na',
    'Sodium is the main salt ion in your blood. It regulates water balance and nerve signals.',
    'It is measured to assess dehydration, swelling and the effect of some medicines.',
    'Often 135–145 mmol/L.',
    'High sodium often means a lack of water.',
    'Low sodium causes dizziness and weakness.',
    'A large deviation needs urgent assessment.'],
  potassium: ['Potassium', 'K',
    'Potassium regulates your nerves, muscles and heart rhythm.',
    'It is measured to check the heart and kidneys and to monitor diuretics.',
    'Often 3.5–5.1 mmol/L.',
    'High potassium is dangerous for your heart rhythm.',
    'Low potassium causes weakness and arrhythmia.',
    'Don’t put off a large deviation — show it to your doctor.'],
  calcium: ['Calcium', 'Ca',
    'Calcium is needed for your bones, muscles and nerve signals.',
    'It is measured to assess the parathyroid glands, bones and vitamin D.',
    'Often 2.15–2.55 mmol/L.',
    'High calcium can mean a parathyroid problem or supplements.',
    'Low calcium causes tingling and muscle spasms.',
    'Doctors often compare it with albumin.'],
  albumin: ['Albumin', 'Albumin',
    'Albumin is the main protein your liver makes for the blood. It keeps water inside the blood vessels.',
    'It is measured to assess nutrition, the liver and the kidneys.',
    'Often 35–50 g/L.',
    'High albumin often means dehydration.',
    'Low albumin can mean a weak liver or poor nutrition.',
    'It changes slowly. One number doesn’t fully show an acute picture.'],
  esr: ['Erythrocyte sedimentation rate', 'ESR, SOE',
    'ESR shows how fast red blood cells settle in a test tube. They settle faster when there is inflammation.',
    'It is an old but still useful marker of inflammation.',
    'Often under 20 mm/h, and it rises with age.',
    'High ESR can mean inflammation, infection or anemia.',
    'Low ESR is usually not a problem.',
    'It isn’t the name of a specific disease. CRP is a faster sign of inflammation.'],
  neutrophils: ['Neutrophils', 'NEU',
    'Neutrophils are the largest group of white blood cells and mainly fight bacteria.',
    'It is measured to tell the type of infection and the bone marrow’s response.',
    'Often 1.8–7.5 x10^9/L.',
    'A rise is common with bacterial infection, stress or steroids.',
    'A drop raises the risk of infection.',
    'Doctors look at the total WBC too.'],
  lymphocytes: ['Lymphocytes', 'LYM',
    'Lymphocytes fight viruses and build immune memory.',
    'It is measured to assess viral infection and immune status.',
    'Often 1.0–3.5 x10^9/L.',
    'A rise is common with a virus.',
    'A drop can mean stress or steroids.',
    'The differential is read as a whole.'],
  psa: ['PSA', 'Prostate-specific antigen',
    'PSA is a protein made by the prostate. A rise in the blood points to a change in the prostate.',
    'It is measured to assess prostate enlargement, inflammation and cancer risk.',
    'Often under 4 ng/mL, and it rises with age.',
    'High PSA can mean inflammation, enlargement or a tumor — not automatically cancer.',
    'Low PSA is usually reassuring.',
    'PSA does not make a diagnosis. A urologist makes the decision.'],
  inr: ['INR', 'International normalized ratio',
    'INR shows how long it takes your blood to clot. It is especially important for people on warfarin.',
    'It is measured to control blood thinning and assess bleeding risk.',
    'Without medicine, often 0.8–1.2. On warfarin the target is often 2–3.',
    'High INR means your blood clots slowly and the risk of bleeding goes up.',
    'Low INR raises the risk of a clot for people on medicine.',
    'Only a doctor changes the dose. Don’t change your pills yourself.'],
};

function englishExplain(key: string): LabExplain | null {
  const row = CATALOG_EN_ROWS[key];
  if (!row) return null;
  const [title, alsoKnown, what, why, typicalNorm, high, low, note] = row;
  return { title, alsoKnown, what, why, typicalNorm, high, low, note };
}

const HINTS: Array<[RegExp, string]> = [
  [/\bldl\b|ldl-c|ldl_c/, 'ldl'],
  [/\bhdl\b|hdl-c|hdl_c/, 'hdl'],
  [/triglycerid|triglyc|ტრიგლიცერიდ/, 'triglycerides'],
  [/cholesterol|ქოლესტერინ/, 'cholesterol'],
  [/hba1c|glycated|\ba1c\b|გლიკირებ/, 'hba1c'],
  [/vitamin.?d|25.?oh|ვიტამინ.?d/, 'vitamin_d'],
  [/vitamin.?b12|cobalamin|ვიტამინ.?b/, 'vitamin_b12'],
  [/uric.?acid|შარდმჟავ/, 'uric_acid'],
  [/ferritin|ფერიტინ/, 'ferritin'],
  [/creatinine|კრეატინინ/, 'creatinine'],
  [/hemoglobin|ჰემოგლობინ/, 'hemoglobin'],
  [/\bwbc\b|leukocyte|ლეიკოციტ/, 'wbc'],
  [/\bcrp\b|c-reactive|რეაქტიულ/, 'crp'],
  [/\btsh\b|თირეოტროპ/, 'tsh'],
  [/glucose|გლუკოზ/, 'glucose'],
];

export function resolveLabExplainKey(param: Pick<LabParameter, 'key' | 'nameEn' | 'nameKa'>): string | null {
  const blobs = [param.key, param.nameEn, param.nameKa].filter(Boolean);
  for (const raw of blobs) {
    const key = slugLabKey(raw);
    if (CATALOG[key]) return key;
    for (const part of key.split('_')) {
      if (CATALOG[part]) return part;
    }
  }
  const hay = blobs.join(' ').toLowerCase();
  for (const [re, key] of HINTS) {
    if (CATALOG[key] && re.test(hay)) return key;
  }
  return null;
}

function generic(param: LabParameter): LabExplain {
  const name = isEn() ? param.nameEn || param.nameKa || param.key : param.nameKa || param.nameEn || param.key;
  const unit = param.unit ? ` ${param.unit}` : '';
  if (isEn()) {
    return {
      title: name,
      alsoKnown: param.nameKa && param.nameKa !== name && !/[Ⴀ-ჿ]/.test(param.nameKa) ? param.nameKa : param.key.toUpperCase(),
      what: `${name} is a lab value. The number${unit ? ` (in${unit})` : ''} shows how much of this substance is in your sample.`,
      why: 'Your doctor reads it together with other tests and your symptoms. One number does not make a diagnosis.',
      typicalNorm: 'Reference ranges vary from lab to lab. The most accurate one is the range printed on your report.',
      high: 'A high result means the number is above the lab’s upper limit.',
      low: 'A low result means the number is below the lower limit. For some values that’s good, for others it needs attention.',
      note: 'Compare it with earlier results and show it to your doctor. Medicard only explains the number — it doesn’t prescribe treatment.',
    };
  }
  return {
    title: name,
    alsoKnown: param.nameEn && param.nameEn !== name ? param.nameEn : param.key.toUpperCase(),
    what: `${name} ლაბორატორიული მაჩვენებელია. ციფრი${unit} აჩვენებს, რა რაოდენობით არის ეს ნივთიერება შენს ნიმუშში.`,
    why: 'ექიმი მას სხვა ანალიზებთან და სიმპტომებთან ერთად კითხულობს. ერთი ციფრი დიაგნოზს არ სვამს.',
    typicalNorm: 'ნორმის ზღვარი ლაბორატორიიდან ლაბორატორიამდე იცვლება. ყველაზე ზუსტი არის შენი ფურცლის დიაპაზონი.',
    high: 'მაღალი შედეგი ნიშნავს, რომ ციფრი ლაბორატორიის ზედა ზღვარს სცდება.',
    low: 'დაბალი შედეგი ნიშნავს, რომ ციფრი ქვედა ზღვარზე დაბალია. ზოგ მაჩვენებელზე ეს კარგია, ზოგზე — საყურადღებო.',
    note: 'შეადარე წინა ანალიზებს და აჩვენე ექიმს. Medicard მხოლოდ ხსნის ციფრს — მკურნალობას არ ნიშნავს.',
  };
}

export function explainLabParam(param: LabParameter): LabExplain {
  const key = resolveLabExplainKey(param);
  if (key && isEn()) return englishExplain(key) || generic(param);
  return (key && CATALOG[key]) || generic(param);
}

export function formatPrintedNorm(param: LabParameter): string | null {
  if (param.refLow != null && param.refHigh != null) {
    return `${param.refLow} – ${param.refHigh}${param.unit ? ` ${param.unit}` : ''}`;
  }
  if (param.refHigh != null) return `≤ ${param.refHigh}${param.unit ? ` ${param.unit}` : ''}`;
  if (param.refLow != null) return `≥ ${param.refLow}${param.unit ? ` ${param.unit}` : ''}`;
  return null;
}
