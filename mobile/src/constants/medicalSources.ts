/**
 * Authoritative sources for MEDICARD calculations and curated medical facts.
 * Each entry must support the number, band, or statement shown next to it.
 */
export type MedicalSource = {
  id: string;
  organization: string;
  title: string;
  titleKa: string;
  description: string;
  descriptionKa: string;
  url: string | null;
};

export const medicalSources = {
  bmi: {
    id: 'bmi',
    organization: 'World Health Organization',
    title: 'A healthy lifestyle — BMI classification',
    titleKa: 'ჯანსაღი ცხოვრების წესი — BMI კლასიფიკაცია',
    description:
      'Adult BMI below 18.5 is underweight, 18.5–24.9 is a healthy weight, 25–29.9 is overweight, and 30 or above is obesity. MEDICARD uses these cut-offs for the gauge, category, and healthy weight range.',
    descriptionKa:
      'ზრდასრულებში BMI 18.5-ზე ნაკლები დაბალი წონაა, 18.5–24.9 ჯანსაღი წონა, 25–29.9 ჭარბი წონა, 30 და ზემოთ სიმსუქნე. MEDICARD ამ ზღვრებს იყენებს სკალაზე, კატეგორიასა და ჯანსაღი წონის დიაპაზონში.',
    url: 'https://www.who.int/europe/news-room/fact-sheets/item/a-healthy-lifestyle---who-recommendations',
  },
  weightPace: {
    id: 'weightPace',
    organization: 'Centers for Disease Control and Prevention',
    title: 'Losing weight',
    titleKa: 'წონის კლება',
    description:
      'CDC describes a gradual loss of about 1–2 pounds (roughly 0.5–0.9 kg) per week. MEDICARD offers 0.25, 0.5, and 0.75 kg per week, which stays at or below that range.',
    descriptionKa:
      'CDC თანდათანობით კლებად დაახლოებით 1–2 ფუნტს (დაახლოებით 0.5–0.9 კგ) კვირაში ასახელებს. MEDICARD გთავაზობს 0.25, 0.5 და 0.75 კგ-ს კვირაში — ამ დიაპაზონში ან მის ქვემოთ.',
    url: 'https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html',
  },
  menstrualCycle: {
    id: 'menstrualCycle',
    organization: 'American College of Obstetricians and Gynecologists',
    title: 'Fertility awareness-based methods of family planning',
    titleKa: 'ნაყოფიერების ცნობიერებაზე დაფუძნებული მეთოდები',
    description:
      'Calendar estimates place ovulation about 14 days before the next period. MEDICARD estimates ovulation as cycle length minus 14 days and marks a fertile window from 5 days before that date through the day after. This is an estimate, not contraception or confirmed ovulation.',
    descriptionKa:
      'კალენდარული შეფასება ოვულაციას შემდეგ პერიოდამდე დაახლოებით 14 დღით ადრე დებს. MEDICARD ოვულაციას ითვლის როგორც ციკლის სიგრძე მინუს 14 დღე და ნაყოფიერ ფანჯარას აჩვენებს ამ თარიღამდე 5 დღიდან მომდევნო დღემდე. ეს შეფასებაა, არა კონტრაცეფცია ან დადასტურებული ოვულაცია.',
    url: 'https://www.acog.org/womens-health/faqs/fertility-awareness-based-methods-of-family-planning',
  },
  pregnancyDueDate: {
    id: 'pregnancyDueDate',
    organization: 'American College of Obstetricians and Gynecologists',
    title: 'Methods for estimating the due date',
    titleKa: 'მშობიარობის სავარაუდო თარიღის შეფასება',
    description:
      'An estimated due date from the last menstrual period is 280 days (40 weeks) after that date. MEDICARD labels this date as an estimate.',
    descriptionKa:
      'ბოლო მენსტრუაციიდან სავარაუდო თარიღი 280 დღეა (40 კვირა). MEDICARD ამ თარიღს შეფასებად აჩვენებს.',
    url: 'https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2017/05/methods-for-estimating-the-due-date',
  },
  fetalGrowth: {
    id: 'fetalGrowth',
    organization: 'World Health Organization',
    title: 'WHO fetal growth charts',
    titleKa: 'WHO-ს ნაყოფის ზრდის ცხრილები',
    description:
      'Displayed weight from week 14 is the WHO 2017 estimated fetal weight 50th percentile, sexes combined, in grams. It is a population average, not this pregnancy’s measurement.',
    descriptionKa:
      'მე-14 კვირიდან ნაჩვენები წონა WHO-ს 2017 წლის ნაყოფის სავარაუდო წონის მე-50 პროცენტილია, სქესების გაერთიანებით, გრამებში. ეს პოპულაციის საშუალოა, არა ამ ორსულობის გაზომვა.',
    url: 'https://journals.plos.org/plosmedicine/article?id=10.1371/journal.pmed.1002220',
  },
  fetalLength: {
    id: 'fetalLength',
    organization: 'Radiological Society of North America',
    title: 'Fetal crown-rump length (Hadlock et al., 1992)',
    titleKa: 'ნაყოფის თავ-კუდუსუნის სიგრძე (Hadlock და სხვ., 1992)',
    description:
      'Length in weeks 5–18 uses crown-rump length by completed week from Hadlock 1992, rounded for display. Week 19 is omitted because the measurement switches from crown-rump to crown-heel.',
    descriptionKa:
      'მე-5–18 კვირის სიგრძე Hadlock 1992-ის თავ-კუდუსუნის სიგრძეა დასრულებული კვირის მიხედვით, ჩვენებისთვის დამრგვალებული. მე-19 კვირა არ ჩანს, რადგან გაზომვა თავ-კუდუსუნიდან სრულ სიგრძეზე გადადის.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/1732970/',
  },
  fetalDevelopment: {
    id: 'fetalDevelopment',
    organization: 'American College of Obstetricians and Gynecologists',
    title: 'How your fetus grows during pregnancy',
    titleKa: 'როგორ იზრდება ნაყოფი ორსულობისას',
    description:
      'Week-by-week development notes follow published educational descriptions of fetal growth. Illustrations are generic and are not an image of this pregnancy.',
    descriptionKa:
      'კვირების განვითარების ტექსტი ნაყოფის ზრდის გამოქვეყნებულ საგანმანათლებლო აღწერას ეყრდნობა. ილუსტრაციები ზოგადია და ამ ორსულობის სურათი არ არის.',
    url: 'https://www.acog.org/womens-health/faqs/how-your-fetus-grows-during-pregnancy',
  },
  pregnancyWeeks: {
    id: 'pregnancyWeeks',
    organization: 'National Health Service',
    title: 'Pregnancy week by week',
    titleKa: 'ორსულობა კვირების მიხედვით',
    description:
      'Trimester bands and general pregnancy-week education follow NHS week-by-week guidance. They are not a personal care schedule.',
    descriptionKa:
      'ტრიმესტრების ზოლები და ორსულობის კვირების ზოგადი განათლება NHS-ის კვირების გზამკვლევს ეყრდნობა. ეს პირადი მოვლის განრიგი არ არის.',
    url: 'https://www.nhs.uk/pregnancy/week-by-week/',
  },
} as const satisfies Record<string, MedicalSource>;

export type MedicalSourceId = keyof typeof medicalSources;

export function sourcesFor(ids: readonly MedicalSourceId[]): MedicalSource[] {
  return ids.map((id) => medicalSources[id]);
}
