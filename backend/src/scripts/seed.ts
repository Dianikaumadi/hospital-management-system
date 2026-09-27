import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { sequelize } from '../config/database';
import { Appointment, Doctor, Invoice, LabTest, MedicalRecord, Medicine, Patient, Staff, User } from '../models';
import { Role } from '../types/auth';

// Fills the database with fictitious demo data (patients, doctors, appointments, billing, ...).
// Every person, phone number and email here is invented; emails use the reserved .test domain.
// All seeded identifiers carry the DEMO- prefix so the data is easy to spot and remove.
// Usage: npm run seed --workspace backend            (SEED_PASSWORD sets the demo users' password)
//        SEED_RESET=true npm run seed --workspace backend   (removes previous demo data first)

const PREFIX = 'DEMO-';
const EMAIL_DOMAIN = 'carepoint.test';
const PATIENT_COUNT = 40;
const APPOINTMENT_COUNT = 90;

// Deterministic PRNG so every run produces the same data set.
let state = 20260927;
const random = (): number => {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (min: number, max: number): number => Math.floor(random() * (max - min + 1)) + min;
const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)];
const pad = (value: number, size = 4): string => String(value).padStart(size, '0');
const daysFromNow = (days: number, hour = 9, minute = 0): Date => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date;
};
const dateOnly = (date: Date): string => date.toISOString().slice(0, 10);
const money = (value: number): number => Math.round(value * 100) / 100;

// Sri Lankan demo data: Sinhala, Tamil, Muslim and Burgher names, local towns and +94 phone numbers.
const FIRST_NAMES_MALE = ['Kasun', 'Nuwan', 'Chaminda', 'Tharindu', 'Dinesh', 'Ruwan', 'Sampath', 'Lahiru', 'Rizwan', 'Kumaran', 'Pradeep', 'Janaka', 'Dilshan', 'Arun', 'Sahan'];
const FIRST_NAMES_FEMALE = ['Nadeesha', 'Dilini', 'Sanduni', 'Chathurika', 'Ishara', 'Tharushi', 'Kavindi', 'Fathima', 'Shalini', 'Nirosha', 'Hiruni', 'Malsha', 'Rukshana', 'Gayani', 'Thilini'];
const LAST_NAMES = ['Perera', 'Fernando', 'Silva', 'Jayasinghe', 'Wickramasinghe', 'Bandara', 'Rathnayake', 'Dissanayake', 'Gunawardena', 'Herath', 'Weerasinghe', 'Kumara', 'Mendis', 'Sivakumar', 'Rajendran', 'Nawaz', 'Samarakoon', 'Ekanayake'];
const CITIES = ['Colombo', 'Kandy', 'Galle', 'Jaffna', 'Negombo', 'Kurunegala', 'Matara', 'Batticaloa'];
const STREETS = ['Galle Road', 'Kandy Road', 'Temple Road', 'Station Road', 'Lake Road', 'Hill Street', 'Church Road', 'Main Street'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

// All fees and prices in this seed are Sri Lankan Rupees (LKR).
const DOCTORS = [
  { firstName: 'Nilmini', lastName: 'Jayawardena', specialization: 'Interventional Cardiology', department: 'Cardiology', fee: 4500 },
  { firstName: 'Ravindra', lastName: 'Senanayake', specialization: 'Neurology', department: 'Neurology', fee: 4000 },
  { firstName: 'Shanthi', lastName: 'Rajaratnam', specialization: 'Pediatrics', department: 'Pediatrics', fee: 3000 },
  { firstName: 'Chamara', lastName: 'Wijesekara', specialization: 'Orthopedic Surgery', department: 'Orthopedics', fee: 3500 },
  { firstName: 'Fathima', lastName: 'Cassim', specialization: 'Obstetrics & Gynecology', department: 'Gynecology', fee: 3500 },
  { firstName: 'Roshan', lastName: 'Fernando', specialization: 'General Medicine', department: 'Internal Medicine', fee: 2500 },
  { firstName: 'Dulani', lastName: 'Abeysekara', specialization: 'Dermatology', department: 'Dermatology', fee: 3000 },
  { firstName: 'Priyanthi', lastName: 'Kanagaratnam', specialization: 'ENT', department: 'ENT', fee: 3000 }
];

const STAFF: { firstName: string; lastName: string; role: Role; department: string }[] = [
  { firstName: 'Chandrika', lastName: 'Herath', role: 'Nurse', department: 'Nursing' },
  { firstName: 'Grace', lastName: 'Ondaatjie', role: 'Nurse', department: 'Nursing' },
  { firstName: 'Saman', lastName: 'Kumara', role: 'Nurse', department: 'Emergency' },
  { firstName: 'Nadeeka', lastName: 'Perera', role: 'Receptionist', department: 'Front Office' },
  { firstName: 'Asanka', lastName: 'Silva', role: 'Receptionist', department: 'Front Office' },
  { firstName: 'Thushara', lastName: 'Bandara', role: 'Laboratory Staff', department: 'Laboratory' },
  { firstName: 'Vasuki', lastName: 'Sivakumar', role: 'Laboratory Staff', department: 'Laboratory' },
  { firstName: 'Imtiaz', lastName: 'Marikar', role: 'Pharmacist', department: 'Pharmacy' },
  { firstName: 'Sewwandi', lastName: 'Gunasekara', role: 'Accountant', department: 'Finance' }
];

const REASONS = ['Chest pain on exertion', 'Recurring headaches', 'Child fever and cough', 'Knee pain after fall', 'Routine antenatal check-up', 'Follow-up for hypertension', 'Skin rash', 'Ear pain and reduced hearing', 'Annual health check-up', 'Lower back pain', 'Follow-up for diabetes', 'Seasonal allergies'];

const DIAGNOSES = [
  { diagnosis: 'Essential hypertension', treatment: 'Low-salt diet, daily walking, review in 4 weeks', prescription: [{ medicine: 'Amlodipine 5mg', dosage: '1 tablet', frequency: 'Once daily', durationDays: 30 }] },
  { diagnosis: 'Type 2 diabetes mellitus', treatment: 'Diet counselling, monitor fasting glucose', prescription: [{ medicine: 'Metformin 500mg', dosage: '1 tablet', frequency: 'Twice daily after meals', durationDays: 30 }] },
  { diagnosis: 'Acute bronchitis', treatment: 'Rest, fluids and steam inhalation', prescription: [{ medicine: 'Amoxicillin 500mg', dosage: '1 capsule', frequency: 'Three times daily', durationDays: 5 }, { medicine: 'Paracetamol 650mg', dosage: '1 tablet', frequency: 'When required', durationDays: 3 }] },
  { diagnosis: 'Migraine without aura', treatment: 'Headache diary, avoid triggers', prescription: [{ medicine: 'Naproxen 250mg', dosage: '1 tablet', frequency: 'At onset of headache', durationDays: 10 }] },
  { diagnosis: 'Allergic rhinitis', treatment: 'Avoid allergens, saline nasal rinse', prescription: [{ medicine: 'Cetirizine 10mg', dosage: '1 tablet', frequency: 'Once daily at night', durationDays: 14 }] },
  { diagnosis: 'Lumbar muscle strain', treatment: 'Physiotherapy, hot compress, posture correction', prescription: [{ medicine: 'Ibuprofen 400mg', dosage: '1 tablet', frequency: 'Twice daily after meals', durationDays: 5 }] },
  { diagnosis: 'Atopic dermatitis', treatment: 'Moisturise twice daily, avoid harsh soaps', prescription: [{ medicine: 'Hydrocortisone cream 1%', dosage: 'Thin layer', frequency: 'Twice daily', durationDays: 7 }] },
  { diagnosis: 'Acute otitis media', treatment: 'Keep ear dry, review if not improving in 3 days', prescription: [{ medicine: 'Amoxicillin 500mg', dosage: '1 capsule', frequency: 'Three times daily', durationDays: 7 }] },
  { diagnosis: 'Viral fever', treatment: 'Rest, oral fluids, monitor temperature', prescription: [{ medicine: 'Paracetamol 650mg', dosage: '1 tablet', frequency: 'Every 6 hours if fever', durationDays: 3 }] }
];

const LAB_TESTS: { name: string; price: number; result: string }[] = [
  { name: 'Complete Blood Count', price: 900, result: 'Hb 13.4 g/dL, WBC 7,200/µL, Platelets 260,000/µL — within normal limits' },
  { name: 'Lipid Profile', price: 2200, result: 'Total cholesterol 212 mg/dL (borderline high), LDL 138 mg/dL, HDL 44 mg/dL' },
  { name: 'HbA1c', price: 1800, result: 'HbA1c 7.1% — above target range' },
  { name: 'Fasting Blood Sugar', price: 350, result: '104 mg/dL — impaired fasting glucose' },
  { name: 'Thyroid Profile (T3, T4, TSH)', price: 4500, result: 'TSH 2.8 mIU/L — euthyroid' },
  { name: 'Liver Function Test', price: 2800, result: 'ALT 32 U/L, AST 28 U/L — within normal limits' },
  { name: 'Kidney Function Test', price: 2500, result: 'Creatinine 0.9 mg/dL, Urea 26 mg/dL — within normal limits' },
  { name: 'Urine Routine', price: 400, result: 'No abnormality detected' },
  { name: 'Chest X-Ray', price: 2000, result: 'Lung fields clear, no active lesion' },
  { name: 'ECG', price: 1000, result: 'Normal sinus rhythm, rate 76 bpm' }
];

const MEDICINES: { name: string; price: number }[] = [
  { name: 'Paracetamol 650mg', price: 5 }, { name: 'Amoxicillin 500mg', price: 25 }, { name: 'Azithromycin 500mg', price: 90 },
  { name: 'Ibuprofen 400mg', price: 8 }, { name: 'Naproxen 250mg', price: 15 }, { name: 'Cetirizine 10mg', price: 6 },
  { name: 'Metformin 500mg', price: 7 }, { name: 'Amlodipine 5mg', price: 10 }, { name: 'Atorvastatin 10mg', price: 20 },
  { name: 'Omeprazole 20mg', price: 12 }, { name: 'Pantoprazole 40mg', price: 18 }, { name: 'Losartan 50mg', price: 18 },
  { name: 'Salbutamol Inhaler 100mcg', price: 950 }, { name: 'Insulin Glargine 100IU/mL', price: 4800 }, { name: 'ORS Sachet', price: 60 },
  { name: 'Hydrocortisone cream 1%', price: 450 }, { name: 'Clopidogrel 75mg', price: 25 }, { name: 'Levothyroxine 50mcg', price: 6 },
  { name: 'Ondansetron 4mg', price: 15 }, { name: 'Vitamin D3 60000IU', price: 120 }, { name: 'Ferrous Sulfate 200mg', price: 4 },
  { name: 'Ceftriaxone Injection 1g', price: 450 }, { name: 'Normal Saline 500mL', price: 250 }, { name: 'Paracetamol Syrup 120mg/5mL', price: 280 },
  { name: 'Montelukast 10mg', price: 30 }
];

const WEEKDAY_SCHEDULE = (start: string, end: string) => ({
  monday: [`${start}-${end}`], tuesday: [`${start}-${end}`], wednesday: [`${start}-${end}`],
  thursday: [`${start}-${end}`], friday: [`${start}-${end}`], saturday: ['09:00-13:00'], sunday: []
});

const idOf = (row: { get: (key: string) => unknown }): number => row.get('id') as number;

const reset = async (): Promise<void> => {
  const patientIds = (await Patient.findAll({ where: { medicalRecordNumber: { [Op.startsWith]: PREFIX } }, attributes: ['id'] })).map(idOf);
  const userIds = (await User.findAll({ where: { email: { [Op.endsWith]: `@${EMAIL_DOMAIN}` } }, attributes: ['id'] })).map((u) => u.id);
  const doctorIds = (await Doctor.findAll({ where: { userId: userIds }, attributes: ['id'] })).map(idOf);
  await sequelize.transaction(async (transaction) => {
    await Appointment.destroy({ where: { [Op.or]: [{ patientId: patientIds }, { doctorId: doctorIds }] }, transaction });
    await MedicalRecord.destroy({ where: { patientId: patientIds }, transaction });
    await LabTest.destroy({ where: { patientId: patientIds }, transaction });
    await Invoice.destroy({ where: { invoiceNumber: { [Op.startsWith]: PREFIX } }, transaction });
    await Medicine.destroy({ where: { sku: { [Op.startsWith]: PREFIX } }, transaction });
    await Staff.destroy({ where: { userId: userIds }, transaction });
    await Doctor.destroy({ where: { userId: userIds }, transaction });
    await Patient.destroy({ where: { id: patientIds }, transaction });
    await User.destroy({ where: { id: userIds }, transaction });
  });
  console.log('Removed previous demo data.');
};

const run = async (): Promise<void> => {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW_PRODUCTION !== 'true') {
    throw new Error('Refusing to seed demo data with NODE_ENV=production (set SEED_ALLOW_PRODUCTION=true to override)');
  }
  const password = process.env.SEED_PASSWORD || 'Demo@12345';
  if (password.length < 8) throw new Error('SEED_PASSWORD must be at least 8 characters');

  await sequelize.authenticate();
  await sequelize.sync();
  if (process.env.SEED_RESET === 'true') await reset();
  if (await Patient.count({ where: { medicalRecordNumber: { [Op.startsWith]: PREFIX } } })) {
    console.log('Demo data already present; nothing to do. Use SEED_RESET=true to recreate it.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const email = (first: string, last: string): string => `${first}.${last}@${EMAIL_DOMAIN}`.toLowerCase();

  await sequelize.transaction(async (transaction) => {
    // Login accounts: doctors and other staff.
    const doctorUsers = await User.bulkCreate(DOCTORS.map((d) => ({
      firstName: d.firstName, lastName: d.lastName, email: email(d.firstName, d.lastName), passwordHash, role: 'Doctor' as Role, isActive: true
    })), { transaction, returning: true });
    const staffUsers = await User.bulkCreate(STAFF.map((s) => ({
      firstName: s.firstName, lastName: s.lastName, email: email(s.firstName, s.lastName), passwordHash, role: s.role, isActive: true
    })), { transaction, returning: true });

    const doctors = await Doctor.bulkCreate(DOCTORS.map((d, i) => ({
      userId: doctorUsers[i].id, specialization: d.specialization, department: d.department,
      licenseNumber: `${PREFIX}SLMC-${pad(10231 + i * 37, 6)}`, consultationFee: d.fee,
      schedule: i % 2 === 0 ? WEEKDAY_SCHEDULE('09:00', '14:00') : WEEKDAY_SCHEDULE('13:00', '18:00')
    })), { transaction, returning: true });

    await Staff.bulkCreate([...doctorUsers.map((u, i) => ({ user: u, department: DOCTORS[i].department })), ...staffUsers.map((u, i) => ({ user: u, department: STAFF[i].department }))]
      .map(({ user, department }, i) => ({
        userId: user.id, employeeNumber: `${PREFIX}EMP-${pad(i + 1)}`, department, hireDate: dateOnly(daysFromNow(-int(120, 2400))),
        attendance: Array.from({ length: 5 }, (_, d) => ({ date: dateOnly(daysFromNow(-(d + 1))), status: random() < 0.9 ? 'Present' : 'Absent' })),
        leaveRecords: random() < 0.4 ? [{ from: dateOnly(daysFromNow(int(5, 20))), to: dateOnly(daysFromNow(int(21, 25))), type: pick(['Casual', 'Sick', 'Earned']), status: pick(['Approved', 'Pending']) }] : []
      })), { transaction });

    // Patients.
    const patients = await Patient.bulkCreate(Array.from({ length: PATIENT_COUNT }, (_, i) => {
      const gender = i % 13 === 12 ? 'Other' : random() < 0.5 ? 'Male' : 'Female';
      const firstName = gender === 'Female' ? pick(FIRST_NAMES_FEMALE) : pick(FIRST_NAMES_MALE);
      const lastName = pick(LAST_NAMES);
      return {
        medicalRecordNumber: `${PREFIX}MRN-${pad(i + 1, 5)}`, firstName, lastName,
        dateOfBirth: dateOnly(daysFromNow(-int(365, 365 * 85))), gender,
        phone: `+94 77 0${pad(10 + i, 2)} ${pad(1000 + i * 173, 4)}`,
        email: random() < 0.7 ? `${firstName}.${lastName}${i + 1}@${EMAIL_DOMAIN}`.toLowerCase() : null,
        address: `${int(1, 250)}, ${pick(STREETS)}, ${pick(CITIES)}`, bloodGroup: pick(BLOOD_GROUPS),
        emergencyContact: `${pick([...FIRST_NAMES_MALE, ...FIRST_NAMES_FEMALE])} ${lastName} (+94 71 1${pad(10 + i, 2)} ${pad(2000 + i * 97, 4)})`,
        documents: []
      };
    }), { transaction, returning: true });

    // Appointments from 60 days ago to 14 days ahead; past ones are mostly completed.
    const appointmentRows = Array.from({ length: APPOINTMENT_COUNT }, () => {
      const offset = int(-60, 14);
      const startsAt = daysFromNow(offset, int(9, 17), pick([0, 15, 30, 45]));
      const past = startsAt.getTime() < Date.now();
      const roll = random();
      return {
        patientIndex: int(0, patients.length - 1), doctorIndex: int(0, doctors.length - 1), startsAt,
        reason: pick(REASONS), status: !past ? (roll < 0.08 ? 'Cancelled' : 'Scheduled') : roll < 0.78 ? 'Completed' : roll < 0.9 ? 'Cancelled' : 'No-show'
      };
    }).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    await Appointment.bulkCreate(appointmentRows.map((a) => ({
      patientId: idOf(patients[a.patientIndex]), doctorId: idOf(doctors[a.doctorIndex]), startsAt: a.startsAt, reason: a.reason, status: a.status
    })), { transaction });

    // Each completed visit gets a medical record, often a lab test, and an invoice.
    const completed = appointmentRows.filter((a) => a.status === 'Completed');
    const labRows: Record<string, unknown>[] = [];
    const invoiceRows: Record<string, unknown>[] = [];
    const recordRows = completed.map((visit, i) => {
      const patientId = idOf(patients[visit.patientIndex]);
      const doctorId = idOf(doctors[visit.doctorIndex]);
      const clinical = pick(DIAGNOSES);
      const items: { description: string; quantity: number; unitPrice: number }[] = [
        { description: 'Consultation', quantity: 1, unitPrice: DOCTORS[visit.doctorIndex].fee }
      ];
      if (random() < 0.55) {
        const test = pick(LAB_TESTS);
        const daysAgo = Math.floor((Date.now() - visit.startsAt.getTime()) / 86_400_000);
        const status = daysAgo > 3 ? 'Completed' : pick(['Requested', 'Collected', 'Processing'] as const);
        labRows.push({ patientId, requestedBy: doctorId, testName: test.name, status, result: status === 'Completed' ? test.result : null });
        items.push({ description: test.name, quantity: 1, unitPrice: test.price });
      }
      for (const line of clinical.prescription) {
        const medicine = MEDICINES.find((m) => m.name === line.medicine);
        if (medicine && random() < 0.6) items.push({ description: line.medicine, quantity: int(5, 30), unitPrice: medicine.price });
      }
      const total = money(items.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
      const roll = random();
      const status = roll < 0.65 ? 'Paid' : roll < 0.8 ? 'Partially Paid' : 'Pending';
      invoiceRows.push({
        patientId, invoiceNumber: `${PREFIX}INV-${visit.startsAt.getFullYear()}-${pad(i + 1, 5)}`, items, total, status,
        paidAt: status === 'Paid' ? daysFromNow(Math.min(0, Math.round((visit.startsAt.getTime() - Date.now()) / 86_400_000) + int(0, 3))) : null
      });
      return { patientId, doctorId, diagnosis: clinical.diagnosis, treatment: clinical.treatment, prescription: clinical.prescription };
    });
    await MedicalRecord.bulkCreate(recordRows, { transaction });
    await LabTest.bulkCreate(labRows, { transaction });
    await Invoice.bulkCreate(invoiceRows, { transaction });

    // Pharmacy stock, including some low-stock and soon-to-expire items.
    await Medicine.bulkCreate(MEDICINES.map((m, i) => ({
      name: m.name, sku: `${PREFIX}MED-${pad(i + 1, 3)}`, unitPrice: m.price,
      quantity: i % 6 === 0 ? int(0, 8) : int(40, 600), reorderLevel: m.price > 500 ? 5 : 25,
      expiryDate: dateOnly(daysFromNow(i % 8 === 0 ? int(10, 45) : int(120, 900)))
    })), { transaction });

    console.log(`Seeded ${doctorUsers.length + staffUsers.length} users, ${doctors.length} doctors, ${patients.length} patients, ` +
      `${appointmentRows.length} appointments, ${recordRows.length} medical records, ${labRows.length} lab tests, ` +
      `${invoiceRows.length} invoices and ${MEDICINES.length} medicines.`);
  });
  console.log(`Demo logins use @${EMAIL_DOMAIN} emails (e.g. ${email(DOCTORS[0].firstName, DOCTORS[0].lastName)}) with the SEED_PASSWORD.`);
};

run()
  .catch((error) => {
    console.error('Unable to seed demo data:', error.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
