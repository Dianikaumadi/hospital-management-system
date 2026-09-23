import { NextFunction, Request, Response } from 'express';
import { Model, ModelStatic, Op, WhereOptions } from 'sequelize';
import { AppError } from '../middleware/error';

export const resourceController = (model: ModelStatic<Model<any, any>>, searchable: string[] = []) => ({
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const where: WhereOptions = {};
      if (req.query.search && searchable.length) {
        // Case-insensitive substring match on any searchable column (LIKE wildcards in the input are escaped).
        const search = String(req.query.search).replace(/[\\%_]/g, '\\$&');
        Object.assign(where, { [Op.or]: searchable.map((column) => ({ [column]: { [Op.iLike]: `%${search}%` } })) });
      }
      const result = await model.findAndCountAll({ where, limit: Math.min(Number(req.query.limit) || 50, 100), order: [['createdAt', 'DESC']] });
      res.json({ success: true, data: result.rows, meta: { total: result.count } });
    } catch (error) { next(error); }
  },
  get: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await model.findByPk(String(req.params.id));
      if (!item) throw new AppError(404, 'Resource not found');
      res.json({ success: true, data: item });
    } catch (error) { next(error); }
  },
  create: async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(201).json({ success: true, data: await model.create(req.body) }); } catch (error) { next(error); }
  },
  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await model.findByPk(String(req.params.id));
      if (!item) throw new AppError(404, 'Resource not found');
      res.json({ success: true, data: await item.update(req.body) });
    } catch (error) { next(error); }
  }
});
