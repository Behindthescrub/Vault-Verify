// Built-in healthcare skills checklist templates.
// Rating scale 1–5 (see SCALE_LEGEND) — modelled on the standard
// healthcare traveler skills checklist format (e.g. healthcareskillschecklist.com).

export type TemplateItem = { category: string; skills: string[] }

export type ChecklistTemplate = {
  key: string
  label: string
  description: string
  items: TemplateItem[]
}

export const SCALE_LEGEND: { value: number; label: string }[] = [
  { value: 1, label: 'No experience — have not performed this skill' },
  { value: 2, label: 'Needs supervision — performed only with direct oversight' },
  { value: 3, label: 'Capable — performed independently with occasional guidance' },
  { value: 4, label: 'Proficient — independent, comfortable in routine and complex cases' },
  { value: 5, label: 'Expert — can perform under pressure and teach others' },
]

const rn: ChecklistTemplate = {
  key: 'rn',
  label: 'RN — Registered Nurse',
  description: 'General med-surg / acute care skills checklist for Registered Nurses',
  items: [
    { category: 'Cardiac / Circulatory', skills: [
      'Cardiac monitoring / telemetry interpretation',
      '12-lead ECG placement and basic interpretation',
      'Peripheral IV insertion',
      'Central line care and dressing changes',
      'Arterial line monitoring',
      'Blood and blood product administration',
      'VASLINE / midline / PICC line care',
      'Wound care — simple and complex',
      'Negative pressure wound therapy (wound VAC)',
    ]},
    { category: 'Respiratory / Vent Management', skills: [
      'Oxygen therapy (nasal cannula, non-rebreather)',
      'BiPAP / CPAP management',
      'Ventilator-assisted patient care',
      'Suctioning — oral / nasopharyngeal',
      'Tracheostomy care',
      'Chest tube management',
      'Nebulizer and inhaler treatments',
      'ABG specimen collection',
    ]},
    { category: 'Neurological', skills: [
      'Neurological vital signs / GCS assessment',
      'Stroke protocol awareness (NIHSS)',
      'Seizure precautions and management',
      'Intracranial pressure monitoring awareness',
    ]},
    { category: 'GI / GU', skills: [
      'NG tube insertion and verification',
      'Feeding pump / enteral nutrition management',
      'Ostomy care',
      'Foley catheter insertion and care',
      'Bladder scan / straight catheterization',
      'Peritoneal dialysis awareness',
    ]},
    { category: 'IV / Infusion / Phlebotomy', skills: [
      'IV pump programming and management',
      'Medication administration — oral, IM, SQ, IV push, IV piggyback',
      'Chemotherapy administration',
      'TPN administration',
      'Insulin drip / heparin drip titration',
      'Phlebotomy / venipuncture',
      'Blood glucose monitoring',
      'Moderate sedation monitoring',
    ]},
    { category: 'Documentation / Legal', skills: [
      'Computer charting (EHR)',
      'Reassessment and shift documentation',
      'Pain assessment and management',
      'Restraint application and monitoring',
      'Falls precautions',
    ]},
    { category: 'Emergency / Critical Care', skills: [
      'Code Blue response / BLS',
      'ACLS algorithms',
      'Defibrillation / cardioversion',
      'Emergency drug administration',
      'Trauma patient care awareness',
    ]},
    { category: 'Patient / Family Education', skills: [
      'New diagnosis education',
      'Medication teaching',
      'Discharge planning and teaching',
      'Cultural sensitivity in care',
    ]},
  ],
}

const lpn: ChecklistTemplate = {
  key: 'lpn',
  label: 'LPN / LVN — Licensed Practical Nurse',
  description: 'Practical nurse skills checklist (clinic, LTC, and med-surg settings)',
  items: [
    { category: 'Basic Care', skills: [
      'Vital signs and intake/output monitoring',
      'Height / weight / BMI measurement',
      'ADL assistance and mobility training',
      'Specimen collection (urine, stool, sputum)',
      'Blood glucose monitoring',
      'Ostomy care',
      'Wound care — simple and complex',
    ]},
    { category: 'Medication Administration', skills: [
      'Oral medications',
      'Topical / transdermal medications',
      'IM / SQ injections',
      'Inhaled medications (nebulizer, inhaler)',
      'Medication reconciliation',
      'Insulin administration',
    ]},
    { category: 'Treatments / Procedures', skills: [
      'Foley catheter insertion and care',
      'Enemas and suppositories',
      'Wet-to-dry dressings',
      'Heat / cold application therapy',
      'Non-sterile and sterile technique',
    ]},
    { category: 'Cardiac / Circulatory', skills: [
      'Peripheral IV insertion',
      'IV pump management and rate verification',
      'Blood product administration awareness',
      'Cardiac monitoring basics',
    ]},
    { category: 'Documentation / Legal', skills: [
      'Computer charting (EHR)',
      'Shift assessment documentation',
      'Incident reporting',
      'Patient rights and confidentiality',
    ]},
    { category: 'Patient / Family Education', skills: [
      'Medication teaching',
      'Health maintenance education',
      'Care plan participation',
    ]},
  ],
}

const cna: ChecklistTemplate = {
  key: 'cna',
  label: 'CNA — Certified Nursing Assistant',
  description: 'Nurse aide skills checklist (hospital and long-term care)',
  items: [
    { category: 'Daily Care', skills: [
      'Bathing — bed, shower, tub',
      'Oral hygiene and denture care',
      'Hair, nail, and skin care',
      'Dressing and grooming assistance',
      'Toileting and incontinence care',
      'Feeding assistance and monitoring',
    ]},
    { category: 'Mobility', skills: [
      'Ambulation assistance',
      'Mechanical lift transfers',
      'Gait belt use',
      'Range-of-motion exercises',
      'Positioning and turning every 2 hours',
      'Fall prevention protocols',
    ]},
    { category: 'Vital Signs / Observations', skills: [
      'Temperature, pulse, respiration measurement',
      'Blood pressure measurement',
      'Height / weight measurement',
      'Intake and output recording',
      'Recognizing and reporting changes in condition',
    ]},
    { category: 'Safety / Infection Control', skills: [
      'Hand hygiene and standard precautions',
      'PPE use',
      'Isolation procedures',
      'Restraint monitoring under nurse direction',
      'Emergency call system use',
    ]},
    { category: 'Comfort / Communication', skills: [
      'Patient dignity and privacy',
      'Basic emotional support',
      'Post-mortem care',
    ]},
  ],
}

const pt: ChecklistTemplate = {
  key: 'pt',
  label: 'PT — Physical Therapist',
  description: 'Physical therapy skills checklist (acute, outpatient, and rehab)',
  items: [
    { category: 'Evaluation', skills: [
      'Initial evaluation and plan of care',
      'Gross motor / functional assessment',
      'Range-of-motion measurement',
      'Manual muscle testing',
      'Gait and balance analysis',
      'Wound / integument assessment',
    ]},
    { category: 'Treatment Interventions', skills: [
      'Therapeutic exercise programs',
      'Gait training (including assistive devices)',
      'Transfer training',
      'Manual therapy / joint mobilization',
      'Soft tissue mobilization',
      'Neuromuscular re-education',
      'Cryotherapy / thermotherapy',
      'Electrical stimulation',
      'Ultrasound therapy',
      'Traction (cervical / lumbar)',
      'Wound debridement — sharp and conservative',
    ]},
    { category: 'Modalities / Equipment', skills: [
      'Prosthetic training',
      'Orthotic assessment and fitting',
      'Wheelchair assessment and training',
      'Upper / lower extremity amputee training',
    ]},
    { category: 'Documentation / Program Management', skills: [
      'Computer charting (EHR)',
      'Progress note documentation',
      'Discharge planning',
      'Patient and family education',
      'Medicare / reimbursement documentation awareness',
    ]},
    { category: 'Special Populations', skills: [
      'Geriatric patient treatment',
      'Pediatric patient treatment',
      'Neurological rehabilitation (stroke, SCI, TBI)',
      'Orthopedic / post-surgical rehabilitation',
      'Cardiopulmonary rehabilitation',
    ]},
  ],
}

const ot: ChecklistTemplate = {
  key: 'ot',
  label: 'OT — Occupational Therapist',
  description: 'Occupational therapy skills checklist (acute, outpatient, and rehab)',
  items: [
    { category: 'Evaluation', skills: [
      'Initial evaluation and plan of care',
      'ADL assessment',
      'Functional / cognitive assessment',
      'Fine motor coordination assessment',
      'Visual-perceptual assessment',
      'Home and work (vocational) assessment',
    ]},
    { category: 'Treatment Interventions', skills: [
      'ADL retraining (feeding, dressing, bathing)',
      'IADL training (cooking, shopping, budgeting)',
      'Fine motor / hand therapy',
      'Cognitive retraining',
      'Splint fabrication and fitting',
      'Sensory integration techniques',
      'Energy conservation and joint protection training',
      'Neuromuscular re-education',
      'Adaptive equipment training',
      'Contracture management',
      'Wound care — conservative',
    ]},
    { category: 'Special Populations / Settings', skills: [
      'Pediatric treatment',
      'Geriatric treatment',
      'Hand and upper-extremity rehabilitation',
      'Neurological rehabilitation (stroke, SCI, TBI)',
      'Psychiatric / behavioral health settings',
      'School-based therapy awareness',
    ]},
    { category: 'Documentation / Program Management', skills: [
      'Computer charting (EHR)',
      'Progress note documentation',
      'Discharge planning and equipment ordering',
      'Patient and family education',
      'Reimbursement documentation awareness',
    ]},
  ],
}

const rrt: ChecklistTemplate = {
  key: 'rrt',
  label: 'RT / RRT — Respiratory Therapist',
  description: 'Respiratory therapy skills checklist (acute care)',
  items: [
    { category: 'Assessment', skills: [
      'Patient assessment and chart review',
      'ABG collection and interpretation',
      'Pulmonary function testing awareness',
      'Pulse oximetry and CO2 monitoring',
    ]},
    { category: 'Oxygen Delivery', skills: [
      'Nasal cannula titration',
      'Oxygen masks / non-rebreathers',
      'High-flow nasal cannula',
      'BiPAP / CPAP setup and management',
      'Heliox therapy awareness',
    ]},
    { category: 'Ventilator Management', skills: [
      'Ventilator setup and circuit management',
      'Ventilator mode changes and weaning',
      'Extubation assistance',
      'Ventilator alarm troubleshooting',
      'Lung protective strategy awareness',
    ]},
    { category: 'Airway Management', skills: [
      'Intubation assistance',
      'Tracheostomy care and tube changes',
      'Suctioning — oral / trach / endotracheal',
      'Chest physiotherapy',
      'Manual resuscitation (BVM / Ambu bag)',
    ]},
    { category: 'Medications / Treatments', skills: [
      'Nebulizer treatments',
      'MDI / DPI administration',
      'Inhaled antibiotic and steroid therapy',
      'Pulmonary hygiene and incentive spirometry',
      'Epoprostenol / inhaled NO awareness',
    ]},
    { category: 'Critical Care', skills: [
      'Code Blue response / BLS / ACLS',
      'ECMO circuit awareness',
      'Transport of ventilated patients',
      'Modalities for asthma / COPD / pneumonia',
    ]},
    { category: 'Documentation / Education', skills: [
      'Computer charting (EHR)',
      'Patient and family education',
      'Equipment sterilization and maintenance',
    ]},
  ],
}

export const TEMPLATES: ChecklistTemplate[] = [rn, lpn, cna, pt, ot, rrt]

export function getTemplate(key: string): ChecklistTemplate | undefined {
  return TEMPLATES.find((t) => t.key === key)
}

export function templateSummary(): { key: string; label: string; description: string; categories: number; skills: number }[] {
  return TEMPLATES.map((t) => ({
    key: t.key,
    label: t.label,
    description: t.description,
    categories: t.items.length,
    skills: t.items.reduce((n, i) => n + i.skills.length, 0),
  }))
}
