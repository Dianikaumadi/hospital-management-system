import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import { Role } from '../types/auth';

export interface UserAttributes { id: number; firstName: string; lastName: string; email: string; passwordHash: string; role: Role; isActive: boolean; }
type UserCreation = Optional<UserAttributes, 'id' | 'isActive'>;
export class User extends Model<UserAttributes, UserCreation> implements UserAttributes {
  declare id: number; declare firstName: string; declare lastName: string; declare email: string; declare passwordHash: string; declare role: Role; declare isActive: boolean;
}
User.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  firstName: { type: DataTypes.STRING(80), allowNull: false }, lastName: { type: DataTypes.STRING(80), allowNull: false },
  email: { type: DataTypes.STRING(160), allowNull: false, unique: true, validate: { isEmail: true } },
  passwordHash: { type: DataTypes.STRING(255), allowNull: false }, role: { type: DataTypes.ENUM('Admin', 'Doctor', 'Nurse', 'Receptionist', 'Laboratory Staff', 'Pharmacist', 'Accountant'), allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, { sequelize, tableName: 'users', underscored: true, timestamps: true });

export interface InvitationAttributes {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}
type InvitationCreation = Optional<InvitationAttributes, 'id' | 'usedAt'>;
export class Invitation extends Model<InvitationAttributes, InvitationCreation> implements InvitationAttributes {
  declare id: number;
  declare firstName: string;
  declare lastName: string;
  declare email: string;
  declare role: Role;
  declare tokenHash: string;
  declare expiresAt: Date;
  declare usedAt: Date | null;
}
Invitation.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  firstName: { type: DataTypes.STRING(80), allowNull: false },
  lastName: { type: DataTypes.STRING(80), allowNull: false },
  email: { type: DataTypes.STRING(160), allowNull: false, validate: { isEmail: true } },
  role: { type: DataTypes.ENUM('Admin', 'Doctor', 'Nurse', 'Receptionist', 'Laboratory Staff', 'Pharmacist', 'Accountant'), allowNull: false },
  tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  usedAt: { type: DataTypes.DATE, allowNull: true }
}, { sequelize, tableName: 'invitations', underscored: true, timestamps: true });

export const Patient = sequelize.define('Patient', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true }, medicalRecordNumber: { type: DataTypes.STRING(40), unique: true, allowNull: false },
  firstName: { type: DataTypes.STRING(80), allowNull: false }, lastName: { type: DataTypes.STRING(80), allowNull: false }, dateOfBirth: { type: DataTypes.DATEONLY, allowNull: false },
  gender: { type: DataTypes.ENUM('Male', 'Female', 'Other'), allowNull: false }, phone: { type: DataTypes.STRING(30), allowNull: false }, email: DataTypes.STRING(160),
  address: DataTypes.TEXT, bloodGroup: DataTypes.STRING(5), emergencyContact: DataTypes.STRING(160), documents: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] }
}, { tableName: 'patients', underscored: true, timestamps: true });

export const Doctor = sequelize.define('Doctor', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true }, userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  specialization: { type: DataTypes.STRING(120), allowNull: false }, department: { type: DataTypes.STRING(120), allowNull: false }, licenseNumber: { type: DataTypes.STRING(80), unique: true, allowNull: false },
  consultationFee: { type: DataTypes.DECIMAL(10, 2), allowNull: false }, schedule: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
}, { tableName: 'doctors', underscored: true, timestamps: true });

export const Appointment = sequelize.define('Appointment', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true }, patientId: { type: DataTypes.INTEGER, allowNull: false }, doctorId: { type: DataTypes.INTEGER, allowNull: false },
  startsAt: { type: DataTypes.DATE, allowNull: false }, reason: { type: DataTypes.TEXT, allowNull: false }, status: { type: DataTypes.ENUM('Scheduled', 'Completed', 'Cancelled', 'No-show'), defaultValue: 'Scheduled' }
}, { tableName: 'appointments', underscored: true, timestamps: true });

export const MedicalRecord = sequelize.define('MedicalRecord', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true }, patientId: { type: DataTypes.INTEGER, allowNull: false }, doctorId: DataTypes.INTEGER,
  diagnosis: { type: DataTypes.TEXT, allowNull: false }, treatment: DataTypes.TEXT, prescription: DataTypes.JSONB, reportUrl: DataTypes.STRING(500)
}, { tableName: 'medical_records', underscored: true, timestamps: true });

export const LabTest = sequelize.define('LabTest', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true }, patientId: { type: DataTypes.INTEGER, allowNull: false }, requestedBy: DataTypes.INTEGER,
  testName: { type: DataTypes.STRING(160), allowNull: false }, status: { type: DataTypes.ENUM('Requested', 'Collected', 'Processing', 'Completed'), defaultValue: 'Requested' }, result: DataTypes.TEXT, reportUrl: DataTypes.STRING(500)
}, { tableName: 'lab_tests', underscored: true, timestamps: true });

export const Medicine = sequelize.define('Medicine', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true }, name: { type: DataTypes.STRING(160), allowNull: false }, sku: { type: DataTypes.STRING(80), unique: true, allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, reorderLevel: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 }, unitPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false }, expiryDate: DataTypes.DATEONLY
}, { tableName: 'medicines', underscored: true, timestamps: true });

export const Invoice = sequelize.define('Invoice', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true }, patientId: { type: DataTypes.INTEGER, allowNull: false }, invoiceNumber: { type: DataTypes.STRING(40), unique: true, allowNull: false },
  items: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] }, total: { type: DataTypes.DECIMAL(10, 2), allowNull: false }, status: { type: DataTypes.ENUM('Pending', 'Partially Paid', 'Paid'), defaultValue: 'Pending' }, paidAt: DataTypes.DATE
}, { tableName: 'invoices', underscored: true, timestamps: true });

export const Staff = sequelize.define('Staff', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true }, userId: { type: DataTypes.INTEGER, allowNull: false, unique: true }, employeeNumber: { type: DataTypes.STRING(40), unique: true, allowNull: false },
  department: { type: DataTypes.STRING(120), allowNull: false }, hireDate: { type: DataTypes.DATEONLY, allowNull: false }, attendance: { type: DataTypes.JSONB, defaultValue: [] }, leaveRecords: { type: DataTypes.JSONB, defaultValue: [] }
}, { tableName: 'staff', underscored: true, timestamps: true });

Doctor.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Appointment.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' }); Appointment.belongsTo(Doctor, { foreignKey: 'doctorId', as: 'doctor' });
MedicalRecord.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' }); LabTest.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });
Invoice.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' }); Staff.belongsTo(User, { foreignKey: 'userId', as: 'user' });
