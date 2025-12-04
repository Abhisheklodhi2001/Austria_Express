import Joi from "joi";
import { getRepository, Like, Not } from "typeorm";
import { Request, Response } from "express";
import { ImportantUpdates } from "../../entities/ImportantUpdates";
import { ScheduleChanges } from "../../entities/ScheduleChanges";
import { ServiceAlerts } from "../../entities/ServiceAlerts";
import { handleSuccess, handleError, joiErrorHandle } from "../../utils/responseHandler";

const APP_URL = process.env.APP_URL as string;

export const createImportantUpdate = async (req: Request, res: Response) => {
    try {
        const schema = Joi.object({
            title: Joi.string().required()
        });

        const { error, value } = schema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const repo = getRepository(ImportantUpdates);

        const data = repo.create(value);
        await repo.save(data);

        return handleSuccess(res, 201, "Important update created successfully");
    } catch (error) {
        return handleError(res, 500, "Error creating important update");
    }
};



export const updateImportantUpdate = async (req: Request, res: Response) => {
    try {
        const repo = getRepository(ImportantUpdates);

        await repo.update(req.params.id, req.body);

        return handleSuccess(res, 200, "Updated successfully");
    } catch {
        return handleError(res, 500, "Error updating update");
    }
};

export const deleteImportantUpdate = async (req: Request, res: Response) => {
    try {
        const repo = getRepository(ImportantUpdates);

        await repo.update(req.params.id, { is_deleted: true });

        return handleSuccess(res, 200, "Deleted successfully");
    } catch {
        return handleError(res, 500, "Error deleting");
    }
};


export const createScheduleChange = async (req: Request, res: Response) => {
    try {
        const schema = Joi.object({
            heading: Joi.string().required(),
            details: Joi.string().required()
        });

        const { error, value } = schema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const repo = getRepository(ScheduleChanges);
        const data = repo.create(value);

        await repo.save(data);
        return handleSuccess(res, 201, "Schedule change created");
    } catch {
        return handleError(res, 500, "Error creating schedule change");
    }
};


export const updateScheduleChange = async (req: Request, res: Response) => {
    try {
        const schema = Joi.object({
            heading: Joi.string().optional(),
            details: Joi.string().optional()
        });

        const { error, value } = schema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const id = Number(req.params.id);
        if (isNaN(id)) return handleError(res, 400, "Invalid ID");

        const repo = getRepository(ScheduleChanges);

        const existing = await repo.findOne({ where: { id, is_deleted: false } });
        if (!existing) return handleError(res, 404, "Schedule change not found");

        await repo.update(id, value);

        return handleSuccess(res, 200, "Schedule change updated successfully");
    } catch {
        return handleError(res, 500, "Error updating schedule change");
    }
};



export const deleteScheduleChange = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) return handleError(res, 400, "Invalid ID");

        const repo = getRepository(ScheduleChanges);

        const existing = await repo.findOne({ where: { id, is_deleted: false } });
        if (!existing) return handleError(res, 404, "Schedule change not found");

        await repo.update(id, { is_deleted: true });

        return handleSuccess(res, 200, "Schedule change deleted successfully");
    } catch {
        return handleError(res, 500, "Error deleting schedule change");
    }
};


export const createServiceAlert = async (req: Request, res: Response) => {
    try {
        const schema = Joi.object({
            title: Joi.string().required(),
            description: Joi.string().required(),
        });

        const { error, value } = schema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const repo = getRepository(ServiceAlerts);
        const data = repo.create(value);

        await repo.save(data);
        return handleSuccess(res, 201, "Service alert added");
    } catch {
        return handleError(res, 500, "Error creating service alert");
    }
};

export const updateServiceAlert = async (req: Request, res: Response) => {
    try {
        const schema = Joi.object({
            title: Joi.string().optional(),
            description: Joi.string().optional(),
            alert_type: Joi.string().valid("info", "warning", "critical").optional()
        });

        const { error, value } = schema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const id = Number(req.params.id);
        if (isNaN(id)) return handleError(res, 400, "Invalid ID");

        const repo = getRepository(ServiceAlerts);

        const existing = await repo.findOne({ where: { id, is_deleted: false } });
        if (!existing) return handleError(res, 404, "Service alert not found");

        await repo.update(id, value);

        return handleSuccess(res, 200, "Service alert updated successfully");
    } catch (error) {
        return handleError(res, 500, "Error updating service alert");
    }
};


export const deleteServiceAlert = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) return handleError(res, 400, "Invalid ID");

        const repo = getRepository(ServiceAlerts);

        const existing = await repo.findOne({ where: { id, is_deleted: false } });
        if (!existing) return handleError(res, 404, "Service alert not found");

        await repo.update(id, { is_deleted: true });

        return handleSuccess(res, 200, "Service alert deleted successfully");
    } catch (error) {
        return handleError(res, 500, "Error deleting service alert");
    }
};
