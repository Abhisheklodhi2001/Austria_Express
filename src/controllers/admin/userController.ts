import Joi from "joi";
import dotenv from "dotenv";
import { Request, Response } from "express";
import { User } from "../../entities/User";
import { Between, getRepository, Like, Not } from "typeorm";
import { handleError, handleSuccess, joiErrorHandle } from "../../utils/responseHandler";
import { crudHandler } from "../../utils/crudHandler";
import moment from "moment";

dotenv.config();

const APP_URL = process.env.APP_URL as string;
const image_logo = process.env.LOGO_URL as string;

export const get_all_user_list = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 10, search = '', filter = '', startDate = '', endDate = '' } = req.query;

        const pageNumber = parseInt(page as string, 10);
        const pageLimit = parseInt(limit as string, 10);
        const offset = (pageNumber - 1) * pageLimit;

        const userRepository = getRepository(User);

        const baseConditions: any = {
            is_verified: true
        };

        if (filter) {
            if (filter === 'Guest User') {
                baseConditions.signup_method = 'Guest';
            } else {
                baseConditions.signup_method = Not('Guest');
            }
        }

        if (startDate && endDate) {
            const start = moment.utc(startDate as string).startOf("day").toDate();
            const end = moment.utc(endDate as string).endOf("day").toDate();
            baseConditions.created_at = Between(start, end);
        }

        let whereClause: any = baseConditions;

        if (search) {
            const searchConditions = [
                { ...baseConditions, first_name: Like(`%${search}%`) },
                { ...baseConditions, last_name: Like(`%${search}%`) },
                { ...baseConditions, email: Like(`%${search}%`) },
                { ...baseConditions, mobile_number: Like(`%${search}%`) },
            ];
            whereClause = searchConditions;
        }

        const [users, total] = await userRepository.findAndCount({
            where: whereClause,
            order: { id: 'DESC' },
            take: pageLimit,
            skip: offset,
        });

        const totalPages = Math.ceil(total / pageLimit);

        users.map((user) => {
            if (user.profile_image) {
                user.profile_image = user.profile_image.startsWith('https')
                    ? user.profile_image
                    : APP_URL + user.profile_image;
            }
        });

        return handleSuccess(res, 200, `Users Fetched Successfully.`, {
            users,
            pagination: {
                total,
                totalPages,
                currentPage: pageNumber,
                pageSize: pageLimit,
            },
        });
    } catch (error: any) {
        console.error('Error in get_all_user_list:', error);
        return handleError(res, 500, error.message);
    }
};

export const change_user_status = async (req: Request, res: Response) => {
    try {
        let response_message = null;
        const changeStatusSchema = Joi.object({
            user_id: Joi.number().required(),
            is_active: Joi.boolean().required()
        })
        const { error, value } = changeStatusSchema.validate(req.body)
        if (error) return joiErrorHandle(res, error);
        const { user_id, is_active } = value
        const userRepository = getRepository(User)
        const user = await userRepository.findOneBy({ id: user_id })
        if (!user) {
            return handleError(res, 404, "User Not Found")
        }
        user.is_active = is_active
        if (!is_active) {
            response_message = "User Deactivated Successfully";
        } else {
            response_message = "User Activated Successfully";
        }

        await userRepository.save(user)
        return handleSuccess(res, 200, response_message);
    } catch (error: any) {
        console.error('Error in register:', error);
        return handleError(res, 500, error.message);
    }
};

//================================== Crud Handler ======================

export const getAllUsers = async (req: Request, res: Response) => {
    try {
        const result = await crudHandler({
            model: User,
            action: "read",
            order: { created_at: "DESC" },
        });
        if (Array.isArray(result)) {
            if (result.length === 0) {
                return handleError(res, 404, "No users found");
            }
            return handleSuccess(res, 200, "Users fetched successfully", result);
        }
        return handleError(res, 500, "Unknown error occurred");
    } catch (error: any) {
        return handleError(res, 500, error.message);
    }
};