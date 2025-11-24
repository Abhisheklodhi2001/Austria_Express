import Joi from 'joi';
import { getRepository } from 'typeorm';
import { Role } from '../../entities/Role';
import { Request, Response } from 'express';
import { handleError, handleSuccess, joiErrorHandle } from '../../utils/responseHandler';


export class RolesController {

    static async createRole(req: Request, res: Response) {
        const roleSchema = Joi.object({
            name: Joi.string().required().messages({
                'string.empty': 'Role name is required.',
            }),
            description: Joi.string().optional().allow(''),
        });

        const { error, value } = roleSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { name, description } = value;

        try {
            const roleRepo = getRepository(Role);
            const newRole = roleRepo.create({ name, description });
            await roleRepo.save(newRole);
            return handleSuccess(res, 201, 'Role created successfully!');
        } catch (error: any) {
            return handleError(res, 400, error.message);
        }
    }

    static async getAllRoles(req: Request, res: Response) {
        try {
            const roleRepo = getRepository(Role);
            const roles = await roleRepo.find();
            return handleSuccess(res, 200, 'Roles fetched successfully!', roles);
        } catch (error: any) {
            return handleError(res, 500, error.message);
        }
    }

    static async updateRole(req: Request, res: Response) {
        const roleIdSchema = Joi.object({
            role_id: Joi.number().required(),
        });

        const { error, value } = roleIdSchema.validate(req.params);
        if (error) return joiErrorHandle(res, error);

        const { role_id } = value;
        const { name, description } = req.body;

        try {
            const roleRepo = getRepository(Role);
            const role = await roleRepo.findOneBy({ id: role_id });

            if (!role) return handleError(res, 404, 'Role not found');

            role.name = name || role.name;
            role.description = description || role.description;

            await roleRepo.save(role);

            return handleSuccess(res, 200, 'Role updated successfully!', role);
        } catch (error: any) {
            return handleError(res, 400, 'Error updating role');
        }
    }

    static async deleteRole(req: Request, res: Response) {
        const roleIdSchema = Joi.object({
            role_id: Joi.number().required(),
        });

        const { error, value } = roleIdSchema.validate(req.params);
        if (error) return joiErrorHandle(res, error);

        const { role_id } = value;

        try {
            const roleRepo = getRepository(Role);
            const role = await roleRepo.findOneBy({ id: role_id });
            if (!role) return handleError(res, 404, 'Role not found');
            await roleRepo.remove(role);
            return handleSuccess(res, 200, 'Role deleted successfully!');
        } catch (error: any) {
            return handleError(res, 500, 'Error deleting role');
        }
    }
}