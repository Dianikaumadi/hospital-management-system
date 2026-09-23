import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Invitation, User } from '../models';
import { env } from '../config/env';
import { AppError } from '../middleware/error';
import { AuthenticatedRequest } from '../types/auth';
import crypto from 'crypto';
import { sequelize } from '../config/database';
import { sendInvitationEmail } from '../services/email';

const publicUser = (user: User) => ({ id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role });
const tokenFor = (user: User) => jwt.sign(publicUser(user), env.jwtSecret, { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] });

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { firstName, lastName, email, password, role = 'Receptionist' } = req.body;
    if (await User.findOne({ where: { email: String(email).toLowerCase() } })) throw new AppError(409, 'An account with this email already exists');
    const user = await User.create({ firstName, lastName, email: String(email).toLowerCase(), passwordHash: await bcrypt.hash(password, 12), role, isActive: true });
    res.status(201).json({ success: true, data: { user: publicUser(user), token: tokenFor(user) } });
  } catch (error) { next(error); }
};

const hashInvitationToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');
const activationUrl = (token: string): string => `${env.clientUrl.replace(/\/$/, '')}/activate/${token}`;

export const listUsers = async (_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const users = await User.findAll({ attributes: { exclude: ['passwordHash'] }, order: [['createdAt', 'DESC']] });
    res.json({ success: true, data: { users } });
  } catch (error) { next(error); }
};

export const createInvitation = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const firstName = String(req.body.firstName).trim();
    const lastName = String(req.body.lastName).trim();
    const email = String(req.body.email).trim().toLowerCase();
    const role = req.body.role || 'Receptionist';
    if (await User.findOne({ where: { email } })) throw new AppError(409, 'An account with this email already exists');
    await Invitation.update({ usedAt: new Date() }, { where: { email, usedAt: null } });
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const invitation = await Invitation.create({
      firstName, lastName, email, role, tokenHash: hashInvitationToken(rawToken),
      expiresAt: new Date(Date.now() + env.invitationExpiresHours * 60 * 60 * 1000)
    });
    const emailDelivery = await sendInvitationEmail({
      to: email,
      firstName,
      lastName,
      role,
      activationUrl: activationUrl(rawToken),
      expiresAt: invitation.expiresAt
    });
    // The raw token is still returned once so the administrator has a fallback delivery path.
    res.status(201).json({ success: true, data: { invitationId: invitation.id, email, expiresAt: invitation.expiresAt, token: rawToken, emailSent: emailDelivery.sent, emailDeliveryReason: emailDelivery.reason } });
  } catch (error) { next(error); }
};

export const updateUserStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findByPk(String(req.params.id));
    if (!user) throw new AppError(404, 'User not found');
    if (user.id === req.user?.id) throw new AppError(400, 'You cannot deactivate your own account');
    await user.update({ isActive: req.body.isActive === true });
    res.json({ success: true, data: { user: publicUser(user), isActive: user.isActive } });
  } catch (error) { next(error); }
};

export const inspectInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const invitation = await Invitation.findOne({ where: { tokenHash: hashInvitationToken(String(req.params.token)), usedAt: null } });
    if (!invitation || invitation.expiresAt.getTime() <= Date.now()) throw new AppError(400, 'Invitation is invalid or expired');
    res.json({ success: true, data: { email: invitation.email, firstName: invitation.firstName, lastName: invitation.lastName, role: invitation.role, expiresAt: invitation.expiresAt } });
  } catch (error) { next(error); }
};

export const activateInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await sequelize.transaction(async (transaction) => {
      const invitation = await Invitation.findOne({
        where: { tokenHash: hashInvitationToken(String(req.params.token)), usedAt: null },
        transaction, lock: transaction.LOCK.UPDATE
      });
      if (!invitation || invitation.expiresAt.getTime() <= Date.now()) throw new AppError(400, 'Invitation is invalid or expired');
      if (await User.findOne({ where: { email: invitation.email }, transaction })) throw new AppError(409, 'An account with this email already exists');
      const activatedUser = await User.create({
        firstName: invitation.firstName, lastName: invitation.lastName, email: invitation.email,
        passwordHash: await bcrypt.hash(req.body.password, 12), role: invitation.role, isActive: true
      }, { transaction });
      await invitation.update({ usedAt: new Date() }, { transaction });
      return activatedUser;
    });
    res.status(201).json({ success: true, data: { user: publicUser(user), token: tokenFor(user) } });
  } catch (error) { next(error); }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findOne({ where: { email: String(req.body.email).toLowerCase(), isActive: true } });
    if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) throw new AppError(401, 'Invalid email or password');
    res.json({ success: true, data: { user: publicUser(user), token: tokenFor(user) } });
  } catch (error) { next(error); }
};

export const me = (req: AuthenticatedRequest, res: Response): void => {
  res.json({ success: true, data: { user: req.user } });
};
