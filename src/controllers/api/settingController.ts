import Joi from "joi";
import { Request, Response } from "express";
import { getRepository, ILike, IsNull, Like, Not } from "typeorm";
import { handleSuccess, handleError, joiErrorHandle } from "../../utils/responseHandler";
import { ImportantUpdates } from "../../entities/ImportantUpdates";
import { ScheduleChanges } from "../../entities/ScheduleChanges";
import { ServiceAlerts } from "../../entities/ServiceAlerts";

export const getAllImportantUpdates = async (req: Request, res: Response) => {
    try {
        const repo = getRepository(ImportantUpdates);
        const list = await repo.find({ where: { is_deleted: false } });

        return handleSuccess(res, 200, "Important Update Fetched Successfully.", list);

    } catch {
        return handleError(res, 500, "Error fetching updates");
    }
};


export const getAllScheduleChanges = async (req: Request, res: Response) => {
    try {
        const repo = getRepository(ScheduleChanges);
        const list = await repo.find({
            where: { is_deleted: false },
            order: { created_at: "DESC" }
        });

        return handleSuccess(res, 200, "schedule Fetched Successfully.", list);
    } catch (error) {
        return handleError(res, 500, "Error fetching schedule changes");
    }
};


export const getAllServiceAlerts = async (req: Request, res: Response) => {
    try {
        const repo = getRepository(ServiceAlerts);
        const list = await repo.find({
            where: { is_deleted: false },
            order: { created_at: "DESC" }
        });

        return handleSuccess(res, 200, "services Fetched Successfully.", list);
    } catch (error) {
        return handleError(res, 500, "Error fetching service alerts");
    }
};

