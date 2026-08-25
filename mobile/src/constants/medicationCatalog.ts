export type MedicationEntry = {
  inn: string;
  ka: string;
  aliases?: readonly string[];
};

/** Common INNs in Georgia, with Georgian labels and frequent brand aliases. */
export const MEDICATION_CATALOG: MedicationEntry[] = [
  { inn: 'metformin', ka: 'მეტფორმინი', aliases: ['glucophage', 'სიოფორი', 'გლუკოფაგი'] },
  { inn: 'atorvastatin', ka: 'ატორვასტატინი', aliases: ['lipitor', 'ტორვაკარდი', 'ატორისი'] },
  { inn: 'salbutamol', ka: 'სალბუტამოლი', aliases: ['albuterol', 'ventolin', 'ვენტოლინი'] },
  { inn: 'amlodipine', ka: 'ამლოდიპინი', aliases: ['norvasc', 'ნორვასკი'] },
  { inn: 'losartan', ka: 'ლოზარტანი', aliases: ['cozaar', 'ლოზაპი'] },
  { inn: 'valsartan', ka: 'ვალსარტანი', aliases: ['diovan'] },
  { inn: 'ramipril', ka: 'რამიპრილი', aliases: ['tritace'] },
  { inn: 'enalapril', ka: 'ენალაპრილი', aliases: ['enap', 'ენაპი'] },
  { inn: 'perindopril', ka: 'პერინდოპრილი', aliases: ['coversyl', 'პრესტარიუმი'] },
  { inn: 'bisoprolol', ka: 'ბისოპროლოლი', aliases: ['concor', 'კონკორი'] },
  { inn: 'metoprolol', ka: 'მეტოპროლოლი', aliases: ['betaloc', 'ეგილოკი'] },
  { inn: 'nebivolol', ka: 'ნებივოლოლი', aliases: ['nebilet'] },
  { inn: 'carvedilol', ka: 'კარვედილოლი' },
  { inn: 'rosuvastatin', ka: 'როზუვასტატინი', aliases: ['crestor', 'კრესტორი'] },
  { inn: 'simvastatin', ka: 'სიმვასტატინი', aliases: ['zocor'] },
  { inn: 'ezetimibe', ka: 'ეზეტიმიბი' },
  { inn: 'furosemide', ka: 'ფუროსემიდი', aliases: ['lasix', 'ლაზიქსი'] },
  { inn: 'indapamide', ka: 'ინდაპამიდი', aliases: ['arifon'] },
  { inn: 'spironolactone', ka: 'სპირონოლაქტონი', aliases: ['verospiron', 'ვეროშპირონი'] },
  { inn: 'hydrochlorothiazide', ka: 'ჰიდროქლორთიაზიდი' },
  { inn: 'clopidogrel', ka: 'კლოპიდოგრელი', aliases: ['plavix', 'პლავიქსი'] },
  { inn: 'acetylsalicylic acid', ka: 'ასპირინი', aliases: ['aspirin', 'cardioaspirin', 'ასპირინი კარდიო'] },
  { inn: 'warfarin', ka: 'ვარფარინი' },
  { inn: 'rivaroxaban', ka: 'რივაროქსაბანი', aliases: ['xarelto', 'ქსარელტო'] },
  { inn: 'apixaban', ka: 'აპიქსაბანი', aliases: ['eliquis'] },
  { inn: 'omeprazole', ka: 'ომეპრაზოლი', aliases: ['losek', 'ომეზი'] },
  { inn: 'pantoprazole', ka: 'პანტოპრაზოლი', aliases: ['controloc', 'ნოლპაზა'] },
  { inn: 'esomeprazole', ka: 'ესომეპრაზოლი', aliases: ['nexium'] },
  { inn: 'levothyroxine', ka: 'ლევოთიროქსინი', aliases: ['euthyrox', 'eutirox', 'ეუიროქსი'] },
  { inn: 'insulin', ka: 'ინსულინი', aliases: ['lantus', 'novorapid', 'humalog'] },
  { inn: 'gliclazide', ka: 'გლიკლაზიდი', aliases: ['diaprel'] },
  { inn: 'empagliflozin', ka: 'ემპაგლიფლოზინი', aliases: ['jardiance'] },
  { inn: 'dapagliflozin', ka: 'დაპაგლიფლოზინი', aliases: ['forxiga'] },
  { inn: 'sitagliptin', ka: 'სიტაგლიპტინი', aliases: ['januvia'] },
  { inn: 'semaglutide', ka: 'სემაგლუტიდი', aliases: ['ozempic', 'ozempic', 'ოზემპიკი', 'wegovy'] },
  { inn: 'amoxicillin', ka: 'ამოქსიცილინი', aliases: ['amoxil', 'ოსპამოქსი'] },
  { inn: 'amoxicillin/clavulanate', ka: 'ამოქსიკლავი', aliases: ['augmentin', 'აუგმენტინი', 'amoxiclav'] },
  { inn: 'azithromycin', ka: 'აზითრომიცინი', aliases: ['sumamed', 'სუმამედი'] },
  { inn: 'ciprofloxacin', ka: 'ციპროფლოქსაცინი' },
  { inn: 'levofloxacin', ka: 'ლევოფლოქსაცინი' },
  { inn: 'doxycycline', ka: 'დოქსიციკლინი' },
  { inn: 'metronidazole', ka: 'მეტრონიდაზოლი', aliases: ['flagyl', 'ტრიქოპოლი'] },
  { inn: 'fluconazole', ka: 'ფლუკონაზოლი', aliases: ['diflucan'] },
  { inn: 'ceftriaxone', ka: 'ცეფტრიაქსონი' },
  { inn: 'clarithromycin', ka: 'კლარითრომიცინი', aliases: ['klacid'] },
  { inn: 'ibuprofen', ka: 'იბუპროფენი', aliases: ['nurofen', 'ნუროფენი'] },
  { inn: 'paracetamol', ka: 'პარაცეტამოლი', aliases: ['acetaminophen', 'panadol', 'პანადოლი'] },
  { inn: 'diclofenac', ka: 'დიკლოფენაკი', aliases: ['voltaren', 'ვოლტარენი'] },
  { inn: 'nimesulide', ka: 'ნიმესულიდი', aliases: ['nimesil', 'ნიმესილი'] },
  { inn: 'ketorolac', ka: 'კეტოროლაკი', aliases: ['ketanov', 'კეტანოვი'] },
  { inn: 'tramadol', ka: 'ტრამადოლი' },
  { inn: 'prednisolone', ka: 'პრედნიზოლონი' },
  { inn: 'dexamethasone', ka: 'დექსამეტაზონი' },
  { inn: 'budesonide', ka: 'ბუდესონიდი', aliases: ['pulmicort'] },
  { inn: 'fluticasone', ka: 'ფლუტიკაზონი' },
  { inn: 'montelukast', ka: 'მონტელუკასტი', aliases: ['singulair'] },
  { inn: 'cetirizine', ka: 'ცეტირიზინი', aliases: ['zyrtec', 'ცეტრინი'] },
  { inn: 'loratadine', ka: 'ლორატადინი', aliases: ['claritin', 'კლარიტინი'] },
  { inn: 'desloratadine', ka: 'დესლორატადინი', aliases: ['aerius'] },
  { inn: 'fexofenadine', ka: 'ფექსოფენადინი', aliases: ['telfast'] },
  { inn: 'sertraline', ka: 'სერტრალინი', aliases: ['zoloft'] },
  { inn: 'escitalopram', ka: 'ესციტალოპრამი', aliases: ['cipralex'] },
  { inn: 'fluoxetine', ka: 'ფლუოქსეტინი', aliases: ['prozac'] },
  { inn: 'alprazolam', ka: 'ალპრაზოლამი', aliases: ['xanax'] },
  { inn: 'diazepam', ka: 'დიაზეპამი', aliases: ['valium', 'სედუქსენი'] },
  { inn: 'gabapentin', ka: 'გაბაპენტინი' },
  { inn: 'pregabalin', ka: 'პრეგაბალინი', aliases: ['lyrica'] },
  { inn: 'carbamazepine', ka: 'კარბამაზეპინი', aliases: ['finlepsin', 'ტეგრეტოლი'] },
  { inn: 'valproate', ka: 'ვალპროატი', aliases: ['depakine', 'დეპაკინი'] },
  { inn: 'levetiracetam', ka: 'ლევეტირაცეტამი', aliases: ['keppra'] },
  { inn: 'tamsulosin', ka: 'ტამსულოზინი', aliases: ['omnic', 'ომნიკი'] },
  { inn: 'finasteride', ka: 'ფინასტერიდი', aliases: ['proscar'] },
  { inn: 'sildenafil', ka: 'სილდენაფილი', aliases: ['viagra', 'ვიაგრა'] },
  { inn: 'estradiol', ka: 'ესტრადიოლი' },
  { inn: 'progesterone', ka: 'პროგესტერონი', aliases: ['utrogestan', 'უტროჟესტანი'] },
  { inn: 'ferrous sulfate', ka: 'რკინა', aliases: ['sorbifer', 'სორბიფერი', 'iron'] },
  { inn: 'folic acid', ka: 'ფოლიუმის მჟავა', aliases: ['folacin'] },
  { inn: 'cholecalciferol', ka: 'ვიტამინი D3', aliases: ['vitamin d', 'ვიტამინი დ'] },
  { inn: 'cyanocobalamin', ka: 'ვიტამინი B12', aliases: ['b12'] },
  { inn: 'magnesium', ka: 'მაგნიუმი', aliases: ['magne b6', 'მაგნე'] },
  { inn: 'potassium chloride', ka: 'კალიუმი', aliases: ['panangin', 'პანანგინი', 'asparkam'] },
  { inn: 'allopurinol', ka: 'ალოპურინოლი' },
  { inn: 'colchicine', ka: 'კოლხიცინი' },
  { inn: 'methotrexate', ka: 'მეტოტრექსატი' },
  { inn: 'tamoxifen', ka: 'ტამოქსიფენი' },
  { inn: 'letrozole', ka: 'ლეტროზოლი' },
  { inn: 'anastrozole', ka: 'ანასტროზოლი' },
  { inn: 'isosorbide mononitrate', ka: 'იზოსორბიდი', aliases: ['monocinque'] },
  { inn: 'nitroglycerin', ka: 'ნიტროგლიცერინი' },
  { inn: 'digoxin', ka: 'დიგოქსინი' },
  { inn: 'amiodarone', ka: 'ამიოდარონი', aliases: ['cordarone'] },
  { inn: 'diltiazem', ka: 'დილთიაზემი' },
  { inn: 'verapamil', ka: 'ვერაპამილი' },
  { inn: 'lisinopril', ka: 'ლიზინოპრილი' },
  { inn: 'candesartan', ka: 'კანდესარტანი' },
  { inn: 'telmisartan', ka: 'ტელმისარტანი', aliases: ['micardis'] },
  { inn: 'doxazosin', ka: 'დოქსაზოსინი', aliases: ['cardura'] },
  { inn: 'moxonidine', ka: 'მოქსონიდინი', aliases: ['physiotens'] },
  { inn: 'melatonin', ka: 'მელატონინი' },
  { inn: 'zolpidem', ka: 'ზოლპიდემი', aliases: ['ivadal'] },
  { inn: 'mirtazapine', ka: 'მირტაზაპინი' },
  { inn: 'venlafaxine', ka: 'ვენლაფაქსინი' },
  { inn: 'duloxetine', ka: 'დულოქსეტინი', aliases: ['cymbalta'] },
  { inn: 'quetiapine', ka: 'ქვეტიაპინი', aliases: ['seroquel'] },
  { inn: 'olanzapine', ka: 'ოლანზაპინი' },
  { inn: 'risperidone', ka: 'რისპერიდონი' },
  { inn: 'loperamide', ka: 'ლოპერამიდი', aliases: ['imodium', 'იმოდიუმი'] },
  { inn: 'diosmectite', ka: 'სმექტა', aliases: ['smecta'] },
  { inn: 'domperidone', ka: 'დომპერიდონი', aliases: ['motilium'] },
  { inn: 'ondansetron', ka: 'ონდანსეტრონი' },
  { inn: 'mebeverine', ka: 'მებევერინი', aliases: ['duspatalin'] },
  { inn: 'ursodeoxycholic acid', ka: 'ურსოდეოქსიქოლის მჟავა', aliases: ['ursosan', 'ურსოსანი'] },
  { inn: 'lactulose', ka: 'ლაქტულოზა', aliases: ['duphalac', 'დუფალაკი'] },
  { inn: 'tizanidine', ka: 'ტიზანიდინი', aliases: ['sirdalud'] },
  { inn: 'baclofen', ka: 'ბაკლოფენი' },
];

export const COMMON_MEDICATION_INNS = ['atorvastatin', 'metformin', 'salbutamol'] as const;

function fold(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u10A0-\u10FF]+/gi, '');
}

function haystack(entry: MedicationEntry) {
  return [entry.ka, entry.inn, ...(entry.aliases ?? [])].map(fold).filter(Boolean);
}

export function medicationLabel(entry: MedicationEntry) {
  return entry.ka;
}

export function findMedication(query: string) {
  const q = fold(query);
  if (!q) return undefined;
  return MEDICATION_CATALOG.find((entry) => haystack(entry).includes(q));
}

export function searchMedications(query: string, limit = 8): MedicationEntry[] {
  const q = fold(query);
  if (!q) return MEDICATION_CATALOG.slice(0, limit);

  const ranked = MEDICATION_CATALOG.map((entry) => {
    const fields = haystack(entry);
    let score = 0;
    for (const field of fields) {
      if (field === q) score = Math.max(score, 100);
      else if (field.startsWith(q)) score = Math.max(score, 80 - Math.min(20, field.length - q.length));
      else if (field.includes(q)) score = Math.max(score, 40);
    }
    return { entry, score };
  })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.ka.localeCompare(b.entry.ka, 'ka'));

  return ranked.slice(0, limit).map((row) => row.entry);
}

export function commonMedications() {
  return COMMON_MEDICATION_INNS.map((inn) => MEDICATION_CATALOG.find((entry) => entry.inn === inn)).filter(
    (entry): entry is MedicationEntry => Boolean(entry),
  );
}

export function hasMedication(list: string[], name: string) {
  const needle = fold(name);
  return list.some((item) => fold(item) === needle);
}
