import { Request, Response } from "express";
import { Between, getRepository, Like } from "typeorm";
import Joi from "joi";
import ejs, { name } from "ejs";
import { handleError, handleSuccess, joiErrorHandle } from "../../utils/responseHandler";
import moment from "moment";
import { RouteDiscount } from "../../entities/RouteDiscount";

export const addRouteDiscount = async (req: Request, res: Response) => {
    try {
        const createRouteDiscountSchema = Joi.object({
            route: Joi.number().required(),
            from_date: Joi.string().required(),
            to_date: Joi.string().required(),
            discount_type: Joi.string().valid('decrease', 'amount', 'increase').required(),
            discount_value: Joi.number().required(),
        });
        const { error, value } = createRouteDiscountSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);
        const routeDiscountRepository = getRepository(RouteDiscount);
        const newRouteDiscount = routeDiscountRepository.create({
            route: value.route,
            from_date: moment(value.from_date).format('YYYY-MM-DD'),
            to_date: moment(value.to_date).format('YYYY-MM-DD'),
            discount_type: value.discount_type,
            discount_value: value.discount_value,
        });
        await routeDiscountRepository.save(newRouteDiscount);

        return handleSuccess(res, 201, "Route discount created successfully.");
    } catch (error: any) {
        console.error("Error in createRouteClosure:", error);
        return handleError(res, 500, error.message);
    }
};

export const getRouteDiscountByRouteId = async (req: Request, res: Response) => {
    try {
        const getRouteDiscountSchema = Joi.object({
            route_id: Joi.number().required(),
        });

        const { error, value } = getRouteDiscountSchema.validate(req.query);
        if (error) return joiErrorHandle(res, error);

        const { route_id } = value;

        const routeDiscountRepository = getRepository(RouteDiscount);
        const routeDiscounts = await routeDiscountRepository.find({ where: { route: route_id, is_deleted: false } });

        return handleSuccess(res, 200, "Route discounts fetched successfully.", routeDiscounts);
    } catch (error: any) {
        console.error("Error in getRouteDiscountById:", error);
        return handleError(res, 500, error.message);
    }
};

export const updateRouteDiscount = async (req: Request, res: Response) => {
    try {
        const updateRouteDiscountSchema = Joi.object({
            discound_id: Joi.number().required(),
            route: Joi.number().required(),
            from_date: Joi.string().required(),
            to_date: Joi.string().required(),
            discount_type: Joi.string().valid('decrease', 'amount', 'increase').required(),
            discount_value: Joi.number().required(),
        });

        const { error, value } = updateRouteDiscountSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { discound_id, route, from_date, to_date, discount_type, discount_value } = value;

        const routeDiscountRepository = getRepository(RouteDiscount);
        const routeDiscount = await routeDiscountRepository.findOneBy({ discound_id })
        if (!routeDiscount) return handleError(res, 404, "Route discount not found.");

        if (routeDiscount) routeDiscount.route = route;
        if (routeDiscount) routeDiscount.from_date = from_date;
        if (routeDiscount) routeDiscount.to_date = to_date;
        if (routeDiscount) routeDiscount.discount_type = discount_type;
        if (routeDiscount) routeDiscount.discount_value = discount_value;
        
        await routeDiscountRepository.save(routeDiscount);

        return handleSuccess(res, 201, "Route discount updated successfully.", routeDiscount);
    } catch (error: any) {
        console.error("Error in updateRouteDiscount:", error);
        return handleError(res, 500, error.message);
    }
};