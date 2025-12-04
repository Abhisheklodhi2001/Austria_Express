import { Request, Response } from "express";
import Joi from "joi";
import { getRepository } from "typeorm";
import { TicketDescription } from "../../entities/TicketDescription";
import { handleSuccess, handleError, joiErrorHandle } from "../../utils/responseHandler";


export const createTicketDescription = async (req: Request, res: Response) => {
    try {
        const schema = Joi.object({
            description: Joi.string().required()
        });

        const { error, value } = schema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const repo = getRepository(TicketDescription);
        const data = repo.create(value);
        await repo.save(data);

        return handleSuccess(res, 201, "Ticket created successfully");
    } catch {
        return handleError(res, 500, "Error creating ticket");
    }
};


export const getTicketDescription = async (req: Request, res: Response) => {
    try {

        const repo = getRepository(TicketDescription);
        const list = await repo.find({
            order: { created_at: "DESC" }
        });

        return handleSuccess(res, 200, "Ticket Description Fetched Successfully.", list);
    } catch {
        return handleError(res, 500, "Error fetching tickets");
    }
};

export const updateTicketDescription = async (req: Request, res: Response) => {
    try {
        const schema = Joi.object({
            description: Joi.string().optional()
        });

        const { error, value } = schema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const repo = getRepository(TicketDescription);

        const id = Number(req.params.id);
        if (isNaN(id)) return handleError(res, 400, "Invalid ticket id");

        const existing = await repo.findOne({
            where: { id }
        });

        if (!existing) return handleError(res, 404, "Ticket not found");

        await repo.update(id, value);

        return handleSuccess(res, 200, "Ticket Description updated successfully");
    } catch (error) {
        console.log("Update Ticket Error:", error);
        return handleError(res, 500, "Error updating ticket");
    }
};


