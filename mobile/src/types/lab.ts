export type LabFlag = 'N' | 'H' | 'L' | 'U';

export type LabParameter = {
  key: string;
  nameKa: string;
  nameEn: string;
  value: number;
  display: string;
  unit: string;
  refLow: number | null;
  refHigh: number | null;
  flag: LabFlag;
};

export type LabPanel = {
  id: string;
  date: string;
  createdAt: string;
  recordIds: string[];
  analysis: string;
  visionNotes?: string;
  parameters: LabParameter[];
  /** Made by the server (extract-lab or rebuilt from a record), not saved by the app. */
  auto?: boolean;
};

export type LabExtract = {
  date: string | null;
  parameters: LabParameter[];
};
