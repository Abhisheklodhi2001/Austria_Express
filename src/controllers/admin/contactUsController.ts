import Joi from "joi";
import ejs, { name } from 'ejs';
import path from "path";
import { Request, response, Response } from "express";
import { getRepository, Like, Not } from "typeorm";
import { handleSuccess, handleError, joiErrorHandle } from "../../utils/responseHandler";
import { Contact_Us } from "../../entities/ContactUs";
import { sendEmail } from "../../services/otpService";

const image_logo = process.env.LOGO_URL as string;

export const getAllContactUsBySearchLimit = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;

        const pageNumber = parseInt(page as string, 10);
        const pageLimit = parseInt(limit as string, 10);

        const offset = (pageNumber - 1) * pageLimit;

        const contactUsRepository = getRepository(Contact_Us);

        const [contactUs, total] = await contactUsRepository.findAndCount({
            order: { contact_id: 'desc' },
            where: search ? [
                { name: Like(`%${search}%`) },
                { contact_number: Like(`%${search}%`) },
                { email: Like(`%${search}%`) }
            ] : [],
            take: pageLimit,
            skip: offset,
        });

        const totalPages = Math.ceil(total / pageLimit);

        return handleSuccess(res, 200, "Contact Us entries retrieved successfully.", {
            contactUs, pagination: {
                total,
                totalPages,
                currentPage: pageNumber,
                pageSize: pageLimit,
            },
        });
    } catch (error: any) {
        console.error("Error in getAllContactUsBySearchLimit:", error);
        return handleError(res, 500, error.message);
    }
};

export const customerQueryResponse = async (req: Request, res: Response) => {
    try {
        const contactSchema = Joi.object({
            contact_id: Joi.number().required(),
            name: Joi.string().required(),
            email: Joi.string().required(),
            query: Joi.string().required(),
            response: Joi.string().required()
        });

        const { error, value } = contactSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { contact_id, name, email, query, response } = value;

        const contactUsRepository = getRepository(Contact_Us);

        const contact = await contactUsRepository.findOneBy({ contact_id: contact_id });
        if (!contact) return handleError(res, 404, 'Contact support entry not found.');

        contact.response = response;
        contact.is_response = true;

        await contactUsRepository.save(contact);
        const emailTemplatePath = path.resolve(__dirname, '../../views/contactUsResponse.ejs');
        const emailHtml = await ejs.renderFile(emailTemplatePath, {
            name,
            query,
            response,
            image_logo
        });
        const emailOptions = {
            to: email,
            subject: "Austria Express - Support",
            html: emailHtml
        };
        await sendEmail(emailOptions);
        return handleSuccess(res, 200, "Response send successfully.", contact);
    } catch (error: any) {
        console.error("Error in customerQueryResponse:", error);
        return handleError(res, 500, error.message);
    }
};