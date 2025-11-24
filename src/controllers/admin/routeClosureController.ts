import { Request, Response } from "express";
import { Between, getRepository, Like } from "typeorm";
import Joi from "joi";
import ejs, { name } from "ejs";
import { RouteClosure } from "../../entities/RouteClosure";
import { handleError, handleSuccess, joiErrorHandle } from "../../utils/responseHandler";
import { Booking } from "../../entities/Booking";
import moment from "moment";
import path from "path";
import { sendEmail } from "../../services/otpService";

export const createRouteClosure = async (req: Request, res: Response) => {
    try {
        const createRouteClosureSchema = Joi.object({
            route: Joi.number().required(),
            from_date: Joi.string().required(),
            to_date: Joi.string().required(),
            closure_reason: Joi.string().optional().allow(null, ''),
        });

        const { error, value } = createRouteClosureSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const routeClosureRepository = getRepository(RouteClosure);
        const bookingRepository = getRepository(Booking);

        const fromDateStr = moment(value.from_date).format('YYYY-MM-DD');
        const toDateStr = moment(value.to_date).format('YYYY-MM-DD');

        const affectedBookings = await bookingRepository.find({
            where: {
                route: value.route,
                travel_date: Between(fromDateStr, toDateStr),
                is_deleted: false,
                payment_status: true
            },
            relations: ['route', 'from', 'to']
        });

        affectedBookings.map(async val => {
            const emailTemplatePath = path.resolve(
                __dirname,
                "../../views/outOfServiceEmail.ejs"
            );
            const emailHtml = await ejs.renderFile(emailTemplatePath, {
                bookingNumber: val.booking_number,
                first_name: val.first_name,
                last_name: val.last_name,
                email: val.email,
                phone: val.phone,
                total: val?.from?.from_ukraine ? val.total + '₴' : val.total + '€',
                travel_date: val.travel_date,
                departure_time: val.departure_time,
                arrival_time: val.arrival_time,
                payment_method: val.payment_method,
                route_name: val.route?.title || '',
                from_city: val.from?.city_name || '',
                to_city: val.to?.city_name || '',
            });

            const emailOptions = {
                to: val.email,
                subject: "Your Ticket Has Been Successfully Booked",
                html: emailHtml,
            };
            await sendEmail(emailOptions);
        })
    
        const routeClosure = routeClosureRepository.create(value);
        await routeClosureRepository.save(routeClosure);

        return handleSuccess(res, 201, "Route closure created successfully.");
    } catch (error: any) {
        console.error("Error in createRouteClosure:", error);
        return handleError(res, 500, error.message);
    }
};

export const getRouteClosureSearchLimit = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        const pageNumber = parseInt(page as string, 10);
        const pageLimit = parseInt(limit as string, 10);

        const offset = (pageNumber - 1) * pageLimit;

        const routeClosureRepository = getRepository(RouteClosure);

        const [routeClosures, total] = await routeClosureRepository.findAndCount({
            where: { is_deleted: false },
            order: { closure_id: 'DESC' },
            relations: ['route'],
            take: pageLimit,
            skip: offset,
        });

        const totalPages = Math.ceil(total / pageLimit);

        return handleSuccess(res, 200, "Route closures retrieved successfully.", {
            routeClosures,
            pagination: {
                total,
                totalPages,
                currentPage: pageNumber,
                pageSize: pageLimit,
            },
        });
    } catch (error: any) {
        console.error("Error in getRouteClosureSearchLimit:", error);
        return handleError(res, 500, error.message);
    }
};

export const updateRouteClosure = async (req: Request, res: Response) => {
    try {
        const createRouteClosureSchema = Joi.object({
            closure_id: Joi.number().required(),
            route: Joi.number().required(),
            from_date: Joi.string().required(),
            to_date: Joi.string().required(),
            closure_reason: Joi.string().optional().allow(null, ''),
        });

        const { error, value } = createRouteClosureSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { closure_id, route, from_date, to_date, closure_reason } = value;

        const routeClosureRepository = getRepository(RouteClosure);

        const routeClosure = await routeClosureRepository.findOneBy({ closure_id })
        if (!routeClosure) return handleError(res, 404, "Route closure not found.");

        if (routeClosure) routeClosure.route = route;
        if (routeClosure) routeClosure.from_date = from_date;
        if (routeClosure) routeClosure.to_date = to_date;
        if (closure_reason !== undefined) routeClosure.closure_reason = closure_reason;

        await routeClosureRepository.save(routeClosure);

        return handleSuccess(res, 201, "Route closure updated successfully.", routeClosure);
    } catch (error: any) {
        console.error("Error in updateRouteClosure:", error);
        return handleError(res, 500, error.message);
    }
};

export const deleteRouteClosure = async (req: Request, res: Response) => {
    try {
        const schema = Joi.object({
            closure_id: Joi.number().required(),
        });

        const { error, value } = schema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { closure_id } = value;

        const routeClosureRepository = getRepository(RouteClosure);
        const closure = await routeClosureRepository.findOne({ where: { closure_id } });
        if (!closure) return handleError(res, 404, "Route closure not found.");

        await routeClosureRepository.delete({ closure_id });

        return handleSuccess(res, 200, "Route closure deleted successfully.");
    } catch (error: any) {
        console.error("Error in deleteRouteClosure:", error);
        return handleError(res, 500, error.message);
    }
};