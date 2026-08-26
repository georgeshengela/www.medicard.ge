export type SymptomMethod = 'manual' | 'anatomy';
export type AnatomyMode = 'muscle' | 'organ';
export type BodySide = 'front' | 'back';
export type SymptomGender = 'MALE' | 'FEMALE';
export type SymptomRisk = 'high' | 'medium' | 'low';
export type SymptomUrgency = 'emergency' | 'urgent' | 'routine';

export type BodyPartId =
  | 'head'
  | 'neck'
  | 'chest'
  | 'abs'
  | 'shoulder'
  | 'bicep'
  | 'forearm'
  | 'hand'
  | 'upper-leg'
  | 'lower-leg'
  | 'trap'
  | 'back'
  | 'tricep'
  | 'glute'
  | 'hamstring'
  | 'calf';

export type OrganId =
  | 'brain'
  | 'eye'
  | 'lung'
  | 'heart'
  | 'liver'
  | 'stomach'
  | 'kidney'
  | 'gallbladder'
  | 'pancreas'
  | 'small-intestine'
  | 'large-intestine'
  | 'bladder'
  | 'spine'
  | 'skin'
  | 'breast'
  | 'genital';

export type SymptomCondition = {
  id: string;
  nameKa: string;
  nameEn: string;
  likelihood: number;
  risk: SymptomRisk;
  needsTreatment: boolean;
  overviewKa: string;
  severityKa: string;
  severityLevel: number;
  symptomsKa: string[];
  causesKa: string[];
  treatmentsKa: string[];
  whenToSeeDoctorKa: string;
  selfCareKa: string[];
};

export type SymptomCheckResult = {
  urgency: SymptomUrgency;
  urgencyKa: string;
  summaryKa: string;
  findingScore: number;
  conditions: SymptomCondition[];
  redFlagsKa: string[];
  nextStepsKa: string[];
  engine?: string;
  model?: string | null;
};

export type SymptomCheckPayload = {
  symptoms: string[];
  method?: SymptomMethod;
  mode?: AnatomyMode | 'search';
  bodyPartId?: string;
  bodyPartKa?: string;
  organId?: string;
  organKa?: string;
  durationKa?: string;
  painLevel?: number;
  notes?: string;
};
